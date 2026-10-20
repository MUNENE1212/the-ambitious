'use client';

import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Member, Role, MemberTitle, hydrateMember } from '@/lib/types';
import { ALL_TITLES, TITLE_LABELS } from '@/lib/constants';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/hooks';
import { useToast } from '@/components/ui/toast';
import { canAdminister } from '@/lib/roles';
import { createExitRequest } from '@/lib/exit-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Loading } from '@/components/ui/loading';
import Link from 'next/link';

/**
 * Member administration goes through /api/admin/*, not straight to Firestore.
 *
 * This page used to hash PINs in the browser and write them into the member
 * document. Combined with `allow update: if true` in the rules, that meant any
 * member could reset the treasurer's PIN or set their own `role` to admin. The
 * server re-checks the caller's role and hashes the PIN where the browser can
 * never see it.
 */
async function adminAction<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function AdminContent() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [pin, setPin] = useState('');
  const [selectedTitles, setSelectedTitles] = useState<MemberTitle[]>([]);
  const [secondary, setSecondary] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<Role>('member');
  const [editTitles, setEditTitles] = useState<MemberTitle[]>([]);
  const [editSecondary, setEditSecondary] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  const [showExitModal, setShowExitModal] = useState(false);
  const [exitTarget, setExitTarget] = useState<Member | null>(null);
  const [exitReason, setExitReason] = useState('');
  const [exitSaving, setExitSaving] = useState(false);

  const isAdmin = canAdminister(user);

  useEffect(() => {
    return onSnapshot(query(collection(db, 'members')), (snap) => {
      setMembers(snap.docs.map(d => hydrateMember(d.id, d.data())));
      setLoading(false);
    });
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!name.trim() || !phone.trim() || pin.length !== 4) {
      showToast('Name, phone, and 4-digit PIN required', 'error');
      return;
    }
    const activeCount = members.filter(m => m.active).length;
    if (activeCount >= settings.memberCap) {
      showToast(`Member cap reached (${settings.memberCap}) — adjust it in Settings if the group agreed to raise it`, 'error');
      return;
    }

    setSaving(true);
    try {
      await adminAction('/api/admin/members', {
        name: name.trim(),
        phone,
        pin,
        role,
        titles: role !== 'manager' ? selectedTitles : [],
        secondary,
        entryFee: settings.entryFee,
      });

      showToast(`Member ${name.trim()} added — entry fee of KES ${settings.entryFee.toLocaleString()} invoiced`);
      setShowForm(false);
      setName(''); setPhone(''); setPin(''); setRole('member'); setSelectedTitles([]); setSecondary(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add member', 'error');
    }
    setSaving(false);
  };

  const toggleActive = async (member: Member) => {
    if (!isAdmin) return;
    try {
      await adminAction(`/api/admin/members/${member.id}`, {
        action: member.active ? 'deactivate' : 'activate',
      });
      showToast(`${member.name} ${member.active ? 'deactivated' : 'activated'}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    }
  };

  const resetPin = async (member: Member) => {
    if (!isAdmin) return;
    const newPin = prompt('Enter new 4-digit PIN:');
    if (!newPin || !/^\d{4}$/.test(newPin)) { showToast('PIN must be 4 digits', 'error'); return; }
    try {
      await adminAction(`/api/admin/members/${member.id}`, { action: 'reset-pin', pin: newPin });
      showToast(`PIN reset for ${member.name} — any existing sessions were signed out`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to reset PIN', 'error');
    }
  };

  const unlockAccount = async (member: Member) => {
    if (!isAdmin) return;
    try {
      await adminAction(`/api/admin/members/${member.id}`, { action: 'unlock' });
      showToast(`Account unlocked for ${member.name}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to unlock', 'error');
    }
  };

  const openEditModal = (member: Member) => {
    setEditMember(member);
    setEditName(member.name);
    setEditPhone(member.phone);
    setEditRole(member.role);
    setEditTitles(member.titles ?? []);
    setEditSecondary(member.secondary ?? false);
    setShowEditModal(true);
  };

  const handleEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editMember) return;
    if (!editName.trim() || !editPhone.trim()) { showToast('Name and phone are required', 'error'); return; }

    setEditSaving(true);
    try {
      await adminAction(`/api/admin/members/${editMember.id}`, {
        action: 'update',
        name: editName.trim(),
        phone: editPhone,
        role: editRole,
        titles: editRole === 'manager' ? [] : editTitles,
        secondary: editSecondary,
      });
      showToast(`${editName.trim()} updated`);
      setShowEditModal(false);
      setEditMember(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update member', 'error');
    }
    setEditSaving(false);
  };

  const openExitModal = (member: Member) => {
    setExitTarget(member);
    setExitReason('');
    setShowExitModal(true);
  };

  const handleInitiateExit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !user || !exitTarget) return;
    setExitSaving(true);
    try {
      await createExitRequest({
        memberId: exitTarget.id,
        memberName: exitTarget.name,
        initiatedBy: 'admin',
        initiatedById: user.id,
        initiatedByName: user.name,
        reason: exitReason,
        exitDeductionPct: settings.exitDeductionPct,
      });
      showToast(`Exit request opened for ${exitTarget.name} — see Exit Requests in More`);
      setShowExitModal(false);
      setExitTarget(null);
    } catch {
      showToast('Failed to initiate exit', 'error');
    }
    setExitSaving(false);
  };

  if (loading) return <Loading />;
  if (!isAdmin) return <div className="p-4"><Card><p className="text-stone-500 text-center">Admin access only</p></Card></div>;

  const activeCount = members.filter(m => m.active).length;

  // A member needs setup while their PIN hash is still in the document every
  // member can read — until then anyone can sign in as them. Note this is NOT
  // the same as "hasn't claimed a seat": the admin's own account and any seat
  // set up by hand are included until their hash is cleared.
  const pendingSetup = members.filter(m => m.active && m.needsSetup);
  const setUpCount = members.filter(m => m.active && !m.needsSetup).length;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-stone-800">Members</h2>
          <p className="text-xs text-stone-400">{activeCount} / {settings.memberCap} active</p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm">+ Add Member</Button>
      </div>

      {pendingSetup.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/60">
          <div className="flex items-start gap-3">
            <span aria-hidden className="text-xl leading-none">⚠️</span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-stone-800 text-sm">
                {pendingSetup.length} member{pendingSetup.length === 1 ? '' : 's'} not set up yet
              </p>
              <p className="text-xs text-stone-600 mt-1">
                While a member&apos;s PIN hash sits in a record every member can read, anyone
                could sign in as them. Ask them to open the app and choose{' '}
                <strong>Set up your account</strong> on the sign-in screen — or reset their
                PIN from here, which clears it just as well.
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {pendingSetup.map(m => (
                  <li key={m.id}>
                    <Badge variant="warning">{m.name}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {pendingSetup.length === 0 && setUpCount > 0 && (
        <Card className="border-emerald-200 bg-emerald-50/60">
          <p className="text-sm text-stone-700">
            <span aria-hidden className="mr-1">✓</span>
            All {setUpCount} active members have their PIN hash stored where other members
            cannot read it.
          </p>
        </Card>
      )}


      <Link href="/exit-requests" className="block text-sm text-amber-700 font-medium">
        View Exit Requests →
      </Link>

      <div className="space-y-2">
        {members.map(m => (
          <Card key={m.id}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-stone-800">{m.name}</p>
                  <Badge variant={m.active ? 'success' : 'danger'}>{m.active ? 'Active' : 'Inactive'}</Badge>
                  <Badge variant={m.role === 'admin' ? 'warning' : m.role === 'manager' ? 'info' : 'default'}>{m.role}</Badge>
                  {m.needsSetup && m.active && <Badge variant="warning">Not set up</Badge>}
                  {m.secondary && <Badge variant="default">Secondary</Badge>}
                  {(m.titles ?? []).map(t => <Badge key={t} variant="gold">{TITLE_LABELS[t]}</Badge>)}
                </div>
                <p className="text-sm text-stone-500">{m.phone}</p>
                {m.isLocked && <p className="text-xs text-red-500">Account locked</p>}
              </div>
              <div className="flex flex-col gap-1 items-end">
                <button onClick={() => openEditModal(m)} className="text-xs text-blue-600 hover:text-blue-700">Edit</button>
                <button onClick={() => toggleActive(m)} className="text-xs text-stone-500 hover:text-stone-700">{m.active ? 'Deactivate' : 'Activate'}</button>
                <button onClick={() => resetPin(m)} className="text-xs text-amber-600 hover:text-amber-700">Reset PIN</button>
                {m.isLocked && <button onClick={() => unlockAccount(m)} className="text-xs text-emerald-600 hover:text-emerald-700">Unlock</button>}
                {m.active && <button onClick={() => openExitModal(m)} className="text-xs text-red-500 hover:text-red-600">Initiate Exit</button>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Add Member">
        <form onSubmit={handleAddMember} className="space-y-4">
          <Input label="Name" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
          <Input label="Phone" type="tel" placeholder="0712345678" value={phone} onChange={e => setPhone(e.target.value)} />
          <Select
            label="Role" value={role} onChange={e => setRole(e.target.value as Role)}
            options={[{ value: 'member', label: 'Member' }, { value: 'manager', label: 'Manager' }, { value: 'admin', label: 'Admin' }]}
          />
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={secondary} onChange={e => setSecondary(e.target.checked)} />
            Secondary (minor) member — higher monthly dues
          </label>
          <Input
            label="4-Digit PIN" type="password" inputMode="numeric" maxLength={4} pattern="[0-9]*"
            placeholder="••••" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
          />
          {role !== 'manager' && (
            <div>
              <p className="text-sm font-medium text-stone-700 mb-2">Titles (interchangeable — a member can hold more than one)</p>
              <div className="flex flex-wrap gap-2">
                {ALL_TITLES.map(t => (
                  <button
                    key={t} type="button"
                    onClick={() => setSelectedTitles(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${selectedTitles.includes(t) ? 'bg-amber-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                  >
                    {TITLE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-stone-400">Entry fee of KES {settings.entryFee.toLocaleString()} will be invoiced automatically.</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
            <Button type="submit" loading={saving} className="flex-1">Add Member</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showEditModal} onClose={() => { setShowEditModal(false); setEditMember(null); }} title="Edit Member">
        {editMember && (
          <form onSubmit={handleEditMember} className="space-y-4">
            <Input label="Name" value={editName} onChange={e => setEditName(e.target.value)} />
            <Input label="Phone" type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
            <Select
              label="Role" value={editRole}
              onChange={e => { const r = e.target.value as Role; setEditRole(r); if (r === 'manager') setEditTitles([]); }}
              options={[{ value: 'member', label: 'Member' }, { value: 'manager', label: 'Manager' }, { value: 'admin', label: 'Admin' }]}
            />
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={editSecondary} onChange={e => setEditSecondary(e.target.checked)} />
              Secondary (minor) member
            </label>
            {editRole !== 'manager' && (
              <div>
                <p className="text-sm font-medium text-stone-700 mb-2">Titles</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_TITLES.map(t => (
                    <button
                      key={t} type="button"
                      onClick={() => setEditTitles(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${editTitles.includes(t) ? 'bg-amber-700 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                    >
                      {TITLE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => { setShowEditModal(false); setEditMember(null); }} className="flex-1">Cancel</Button>
              <Button type="submit" loading={editSaving} className="flex-1">Save</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={showExitModal} onClose={() => setShowExitModal(false)} title="Initiate Exit">
        {exitTarget && (
          <form onSubmit={handleInitiateExit} className="space-y-4">
            <p className="text-sm text-stone-600">
              Opening an exit request for <strong>{exitTarget.name}</strong>. The refund is auto-calculated and
              needs a majority of active members to approve.
            </p>
            <Textarea label="Reason" placeholder="e.g. following up a verbal notice from the member..." value={exitReason} onChange={e => setExitReason(e.target.value)} rows={3} />
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setShowExitModal(false)} className="flex-1">Cancel</Button>
              <Button type="submit" variant="danger" loading={exitSaving} className="flex-1">Open Exit Request</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
