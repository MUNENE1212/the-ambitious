'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/hooks';
import { createExitRequest } from '@/lib/exit-actions';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';

export function ProfileContent() {
  const { user, changePin, updateProfile } = useAuth();
  const { settings } = useSettings();
  const { showToast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [savingName, setSavingName] = useState(false);

  const [showExitModal, setShowExitModal] = useState(false);
  const [exitReason, setExitReason] = useState('');
  const [requestingExit, setRequestingExit] = useState(false);

  const handleRequestExit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setRequestingExit(true);
    try {
      await createExitRequest({
        memberId: user.id,
        memberName: user.name,
        initiatedBy: 'member',
        initiatedById: user.id,
        initiatedByName: user.name,
        reason: exitReason,
        exitDeductionPct: settings.exitDeductionPct,
      });
      showToast('Exit request submitted — see Exit Requests in More');
      setShowExitModal(false);
      setExitReason('');
    } catch {
      showToast('Failed to submit exit request', 'error');
    }
    setRequestingExit(false);
  };

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changingPin, setChangingPin] = useState(false);
  const [pinError, setPinError] = useState('');

  const handleNameSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { showToast('Name cannot be empty', 'error'); return; }
    if (name.trim() === user?.name) { showToast('No changes to save', 'info'); return; }

    setSavingName(true);
    const result = await updateProfile({ name: name.trim() });
    if (result.success) {
      showToast('Name updated');
    } else {
      showToast(result.error || 'Failed to update', 'error');
    }
    setSavingName(false);
  };

  const handlePinChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');

    if (currentPin.length !== 4) { setPinError('Current PIN must be 4 digits'); return; }
    if (newPin.length !== 4) { setPinError('New PIN must be 4 digits'); return; }
    if (newPin !== confirmPin) { setPinError('PINs do not match'); return; }
    if (newPin === currentPin) { setPinError('New PIN must be different'); return; }

    setChangingPin(true);
    const result = await changePin(currentPin, newPin);
    if (result.success) {
      showToast('PIN changed successfully');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } else {
      setPinError(result.error || 'Failed to change PIN');
    }
    setChangingPin(false);
  };

  if (!user) return null;

  const titles = user.titles ?? [];

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold text-stone-800">Profile</h2>

      <Card>
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={user.role === 'admin' ? 'warning' : user.role === 'manager' ? 'info' : 'default'}>
              {user.role}
            </Badge>
            {titles.map(t => (
              <Badge key={t} variant="success">{t}</Badge>
            ))}
          </div>
          <p className="text-sm text-stone-500">{user.phone}</p>
        </div>
      </Card>

      <Card title="Edit Name">
        <form onSubmit={handleNameSave} className="space-y-3">
          <Input
            label="Name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
          />
          <Button type="submit" loading={savingName} className="w-full">Save Name</Button>
        </form>
      </Card>

      <Card title="Change PIN">
        <form onSubmit={handlePinChange} className="space-y-3">
          <Input
            label="Current PIN"
            type="password"
            placeholder="••••"
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
            value={currentPin}
            onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
          />
          <Input
            label="New PIN"
            type="password"
            placeholder="••••"
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
            value={newPin}
            onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
          />
          <Input
            label="Confirm New PIN"
            type="password"
            placeholder="••••"
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
            value={confirmPin}
            onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ''))}
          />
          {pinError && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2 border border-red-200">
              {pinError}
            </div>
          )}
          <Button type="submit" loading={changingPin} className="w-full">Change PIN</Button>
        </form>
      </Card>

      <Card title="Leaving the group">
        <p className="text-sm text-stone-500 mb-3">
          Starts the constitution&apos;s 3-month notice. Your refund is auto-calculated and shown to the committee
          for a majority vote before payout.
        </p>
        <Button variant="danger" onClick={() => setShowExitModal(true)} className="w-full">Request to Exit</Button>
      </Card>

      <Modal open={showExitModal} onClose={() => setShowExitModal(false)} title="Request to Exit">
        <form onSubmit={handleRequestExit} className="space-y-4">
          <Textarea
            label="Reason (optional)"
            placeholder="Let the committee know why you're leaving..."
            value={exitReason}
            onChange={e => setExitReason(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setShowExitModal(false)} className="flex-1">Cancel</Button>
            <Button type="submit" variant="danger" loading={requestingExit} className="flex-1">Submit Request</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
