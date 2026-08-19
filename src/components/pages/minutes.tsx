'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, updateDoc, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MeetingMinute, AgendaItem, MeetingType, Member, hydrateMember } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/hooks';
import { canManageMinutes, canApplyFines, isAdmin, isSavingsGroupMember } from '@/lib/roles';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import { EmptyState } from '@/components/ui/empty-state';
import { format } from 'date-fns';

export function MinutesContent() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [minutes, setMinutes] = useState<MeetingMinute[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selectedMinute, setSelectedMinute] = useState<MeetingMinute | null>(null);
  const [saving, setSaving] = useState(false);
  const [applyingFines, setApplyingFines] = useState(false);

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [meetingType, setMeetingType] = useState<MeetingType>('virtual');
  const [chairedBy, setChairedBy] = useState('');
  const [secretary, setSecretary] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([{ title: '', discussion: '', resolutions: '' }]);

  const canManage = canManageMinutes(user);
  const canFine = canApplyFines(user);

  useEffect(() => {
    const unsubs: (() => void)[] = [];
    unsubs.push(onSnapshot(query(collection(db, 'meetingMinutes'), orderBy('createdAt', 'desc')), (snap) => {
      setMinutes(snap.docs.map(d => ({ id: d.id, meetingType: 'virtual', ...d.data() } as MeetingMinute)));
      setLoading(false);
    }));
    unsubs.push(onSnapshot(collection(db, 'members'), (snap) => {
      setMembers(snap.docs.map(d => hydrateMember(d.id, d.data())));
    }));
    return () => unsubs.forEach(u => u());
  }, []);

  const addAgendaItem = () => setAgendaItems([...agendaItems, { title: '', discussion: '', resolutions: '' }]);
  const updateAgendaItem = (index: number, field: keyof AgendaItem, value: string) => {
    const updated = [...agendaItems];
    updated[index] = { ...updated[index], [field]: value };
    setAgendaItems(updated);
  };
  const removeAgendaItem = (index: number) => {
    if (agendaItems.length === 1) return;
    setAgendaItems(agendaItems.filter((_, i) => i !== index));
  };
  const toggleAttendee = (memberId: string) => {
    setAttendees(prev => prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canManage) return;
    if (!chairedBy.trim() || !secretary.trim()) { showToast('Chair and Secretary are required', 'error'); return; }
    if (agendaItems.some(a => !a.title.trim())) { showToast('All agenda items need a title', 'error'); return; }

    setSaving(true);
    try {
      await addDoc(collection(db, 'meetingMinutes'), {
        date, meetingType, chairedBy: chairedBy.trim(), secretary: secretary.trim(), attendees,
        agendaItems: agendaItems.filter(a => a.title.trim()),
        status: 'Draft', createdBy: user.id, createdAt: Date.now(), updatedAt: Date.now(),
      });
      showToast('Minutes saved as Draft');
      setShowForm(false);
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setMeetingType('virtual'); setChairedBy(''); setSecretary(''); setAttendees([]);
      setAgendaItems([{ title: '', discussion: '', resolutions: '' }]);
    } catch {
      showToast('Failed to save', 'error');
    }
    setSaving(false);
  };

  const markOfficial = async (minute: MeetingMinute) => {
    if (!isAdmin(user)) return;
    try {
      await updateDoc(doc(db, 'meetingMinutes', minute.id), { status: 'Official', updatedAt: Date.now() });
      showToast('Minutes marked as Official');
    } catch {
      showToast('Failed to update', 'error');
    }
  };

  const applyAbsenceFines = async (minute: MeetingMinute) => {
    if (!user || !canFine) return;
    setApplyingFines(true);
    try {
      const activeMembers = members.filter(m => m.active && isSavingsGroupMember(m));
      const absentees = activeMembers.filter(m => !minute.attendees.includes(m.id));
      if (absentees.length === 0) {
        showToast('No absentees to fine — everyone attended', 'info');
        setApplyingFines(false);
        return;
      }
      const fineAmount = minute.meetingType === 'agm' ? settings.agmAbsenceFine : settings.virtualAbsenceFine;
      const fineType = minute.meetingType === 'agm' ? 'agmAbsence' : 'virtualAbsence';
      // Skip members already fined for this specific meeting (idempotent re-clicks)
      const existing = await getDocs(query(collection(db, 'fines'), where('relatedId', '==', minute.id)));
      const alreadyFined = new Set(existing.docs.map(d => d.data().memberId));
      let count = 0;
      for (const m of absentees) {
        if (alreadyFined.has(m.id)) continue;
        await addDoc(collection(db, 'fines'), {
          memberId: m.id, memberName: m.name, type: fineType, amount: fineAmount,
          reason: `Absent from ${minute.meetingType === 'agm' ? 'AGM' : 'virtual meeting'} on ${minute.date}`,
          relatedId: minute.id, waived: false,
          createdBy: user.id, createdByName: user.name, createdAt: Date.now(),
        });
        count++;
      }
      showToast(count > 0 ? `Applied absence fines to ${count} member(s)` : 'All absentees already fined');
    } catch {
      showToast('Failed to apply fines', 'error');
    }
    setApplyingFines(false);
  };

  const downloadPdf = (minute: MeetingMinute) => {
    const attendeeNames = minute.attendees.map(id => members.find(m => m.id === id)?.name || id).join(', ');
    const html = `
      <html><head><title>Minutes - ${minute.date}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #182849; } h2 { color: #44403c; border-bottom: 1px solid #e7e5e4; padding-bottom: 4px; }
        .meta { color: #78716c; margin-bottom: 20px; }
        .agenda { margin-bottom: 20px; padding: 10px; background: #fafaf9; border-radius: 8px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .official { background: #dcfce7; color: #166534; }
        .draft { background: #fef3c7; color: #92400e; }
      </style></head><body>
      <h1>${settings.groupName} - Meeting Minutes</h1>
      <div class="meta">
        <p><strong>Date:</strong> ${format(new Date(minute.date), 'EEEE, dd MMMM yyyy')} (${minute.meetingType === 'agm' ? 'Annual General Meeting' : 'Virtual monthly meeting'})</p>
        <p><strong>Status:</strong> <span class="badge ${minute.status === 'Official' ? 'official' : 'draft'}">${minute.status}</span></p>
        <p><strong>Chaired by:</strong> ${minute.chairedBy}</p>
        <p><strong>Secretary:</strong> ${minute.secretary}</p>
        <p><strong>Attendees:</strong> ${attendeeNames || 'Not recorded'}</p>
      </div>
      <h2>Agenda Items</h2>
      ${minute.agendaItems.map((item, i) => `
        <div class="agenda">
          <h3>${i + 1}. ${item.title}</h3>
          <p><strong>Discussion:</strong> ${item.discussion || 'None recorded'}</p>
          <p><strong>Resolutions:</strong> ${item.resolutions || 'None recorded'}</p>
        </div>
      `).join('')}
      <hr><p style="color: #a8a29e; font-size: 12px;">Generated from ${settings.groupName} platform</p>
      </body></html>
    `;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.onload = () => win.print();
  };

  if (loading) return <Loading />;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-stone-800">Meeting Minutes</h2>
        {canManage && <Button onClick={() => setShowForm(true)} size="sm">+ New Minutes</Button>}
      </div>

      {minutes.length === 0 ? (
        <EmptyState title="No meeting minutes" description="Create your first meeting record" />
      ) : (
        <div className="space-y-2">
          {minutes.map(m => (
            <Card key={m.id}>
              <div className="cursor-pointer" onClick={() => { setSelectedMinute(m); setShowDetail(true); }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-stone-800">{format(new Date(m.date), 'dd MMM yyyy')}</p>
                      <Badge variant={m.meetingType === 'agm' ? 'gold' : 'default'}>{m.meetingType === 'agm' ? 'AGM' : 'Virtual'}</Badge>
                    </div>
                    <p className="text-sm text-stone-500">Chair: {m.chairedBy}</p>
                    <p className="text-xs text-stone-400">{m.agendaItems.length} agenda item(s) · {m.attendees.length} attended</p>
                  </div>
                  <Badge variant={m.status === 'Official' ? 'success' : 'warning'}>{m.status}</Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showDetail} onClose={() => { setShowDetail(false); setSelectedMinute(null); }} title="Meeting Minutes" size="lg">
        {selectedMinute && (
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p><strong>Date:</strong> {format(new Date(selectedMinute.date), 'EEEE, dd MMMM yyyy')} ({selectedMinute.meetingType === 'agm' ? 'AGM' : 'Virtual'})</p>
              <p><strong>Chaired by:</strong> {selectedMinute.chairedBy}</p>
              <p><strong>Secretary:</strong> {selectedMinute.secretary}</p>
              <p><strong>Attendees:</strong> {
                selectedMinute.attendees.length > 0
                  ? selectedMinute.attendees.map(id => members.find(m => m.id === id)?.name || id).join(', ')
                  : 'Not recorded'
              }</p>
            </div>

            <div className="space-y-3">
              {selectedMinute.agendaItems.map((item, i) => (
                <div key={i} className="bg-stone-50 rounded-lg p-3">
                  <p className="font-medium text-stone-800">{i + 1}. {item.title}</p>
                  {item.discussion && <p className="text-sm text-stone-600 mt-1"><strong>Discussion:</strong> {item.discussion}</p>}
                  {item.resolutions && <p className="text-sm text-stone-600 mt-1"><strong>Resolutions:</strong> {item.resolutions}</p>}
                </div>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button variant="secondary" onClick={() => downloadPdf(selectedMinute)} className="flex-1">Download PDF</Button>
              {selectedMinute.status === 'Draft' && isAdmin(user) && (
                <Button onClick={() => { markOfficial(selectedMinute); setShowDetail(false); }} className="flex-1">Mark Official</Button>
              )}
            </div>
            {canFine && (
              <Button variant="secondary" loading={applyingFines} onClick={() => applyAbsenceFines(selectedMinute)} className="w-full">
                Apply Absence Fines (KES {(selectedMinute.meetingType === 'agm' ? settings.agmAbsenceFine : settings.virtualAbsenceFine).toLocaleString()} each)
              </Button>
            )}
          </div>
        )}
      </Modal>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Meeting Minutes" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            label="Meeting Type"
            value={meetingType}
            onChange={e => setMeetingType(e.target.value as MeetingType)}
            options={[{ value: 'virtual', label: 'Virtual monthly meeting' }, { value: 'agm', label: 'Annual General Meeting' }]}
          />
          <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Input label="Chaired By" placeholder="Chairperson name" value={chairedBy} onChange={e => setChairedBy(e.target.value)} />
          <Input label="Secretary" placeholder="Secretary name" value={secretary} onChange={e => setSecretary(e.target.value)} />

          <div>
            <p className="text-sm font-medium text-stone-700 mb-2">Attendees</p>
            <div className="flex flex-wrap gap-2">
              {members.filter(m => m.active).map(m => (
                <button
                  key={m.id} type="button" onClick={() => toggleAttendee(m.id)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors
                    ${attendees.includes(m.id) ? 'bg-amber-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-stone-700">Agenda Items</p>
              <button type="button" onClick={addAgendaItem} className="text-sm text-amber-700 font-medium">+ Add Item</button>
            </div>
            {agendaItems.map((item, i) => (
              <div key={i} className="bg-stone-50 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-stone-600">Item {i + 1}</span>
                  {agendaItems.length > 1 && <button type="button" onClick={() => removeAgendaItem(i)} className="text-xs text-red-500">Remove</button>}
                </div>
                <Input placeholder="Agenda title" value={item.title} onChange={e => updateAgendaItem(i, 'title', e.target.value)} />
                <Textarea placeholder="Discussion..." rows={2} value={item.discussion} onChange={e => updateAgendaItem(i, 'discussion', e.target.value)} />
                <Textarea placeholder="Resolutions..." rows={2} value={item.resolutions} onChange={e => updateAgendaItem(i, 'resolutions', e.target.value)} />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={saving} className="flex-1">Save Draft</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
