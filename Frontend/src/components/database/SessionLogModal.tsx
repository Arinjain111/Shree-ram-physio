import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useUI } from '@/context/UIContext';
import type { TreatmentSession } from '@/types/database.types';
import { ipcRenderer } from '@/lib/ipc';
import ExercisesAutocomplete from './ExercisesAutocomplete';

interface SessionLogModalProps {
  session: TreatmentSession;
  treatmentName: string;
  onClose: () => void;
  onSaved: () => void;
}

const PainScale = ({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) => {
  const levels = Array.from({ length: 11 }, (_, i) => i);
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">{label}</label>
      <div className="flex gap-1 flex-wrap">
        {levels.map(n => {
          const color = n === 0 ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
            : n <= 3 ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
            : n <= 5 ? 'bg-amber-50 text-amber-600 border-amber-100'
            : n <= 7 ? 'bg-orange-50 text-orange-600 border-orange-100'
            : 'bg-rose-50 text-rose-600 border-rose-100';
          const isActive = value === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(isActive ? null : n)}
              className={`w-9 h-9 rounded-lg text-xs font-bold border transition-all ${
                isActive ? `${color} ring-2 ring-offset-1 ring-indigo-400 shadow-sm scale-110` : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      {value !== null && (
        <p className="mt-1.5 text-[11px] text-slate-400 font-medium">
          {value === 0 ? 'No pain' : value <= 3 ? 'Mild pain' : value <= 5 ? 'Moderate pain' : value <= 7 ? 'Severe pain' : 'Very severe / worst'}
        </p>
      )}
    </div>
  );
};

export const SessionLogModal = ({ session, treatmentName, onClose, onSaved }: SessionLogModalProps) => {
  const { showToast, showModal } = useUI();
  const [attended, setAttended] = useState<number>(session.attended);
  const [painBefore, setPainBefore] = useState<number | null>(session.painBefore);
  const [painAfter, setPainAfter] = useState<number | null>(session.painAfter);
  const [exercisesPerformed, setExercisesPerformed] = useState(session.exercisesPerformed || '');
  const [notes, setNotes] = useState(session.notes || '');
  const [progress, setProgress] = useState<string | null>(session.progress || null);
  const [cancelled, setCancelled] = useState<number>(session.cancelled);
  const [rescheduledDate, setRescheduledDate] = useState<string | null>(session.rescheduledDate || null);
  const [sessionDate, setSessionDate] = useState<string | null>(session.date || new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await ipcRenderer.invoke('update-treatment-session', session.id, {
        attended: cancelled === 1 ? 0 : attended,
        painBefore: attended === 1 ? painBefore : null,
        painAfter: attended === 1 ? painAfter : null,
        exercisesPerformed: attended === 1 ? exercisesPerformed : '',
        notes,
        progress: progress || null,
        cancelled,
        rescheduledDate: cancelled === 1 ? rescheduledDate : null,
        date: sessionDate,
      });

      if (result.success) {
        showToast('success', `Session ${session.sessionNumber} updated`);
        onSaved();
        onClose();
      } else {
        showToast('error', result.error || 'Failed to update session');
      }
    } catch (error) {
      showToast('error', 'Failed to save session data');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    showModal({
      title: 'Reset Session',
      message: `Reset session ${session.sessionNumber} to pending? This will clear all logged data (pain scores, exercises, notes, status).`,
      type: 'warning',
      confirmText: 'Reset',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const result = await ipcRenderer.invoke('reset-treatment-session', session.id);
          if (result.success) {
            showToast('success', `Session ${session.sessionNumber} reset`);
            onSaved();
            onClose();
          } else {
            showToast('error', result.error || 'Failed to reset session');
          }
        } catch {
          showToast('error', 'Failed to reset session');
        }
      }
    });
  };

  const handleDelete = () => {
    showModal({
      title: 'Delete Session',
      message: `Permanently delete session ${session.sessionNumber}? This cannot be undone. The session slot will be removed from this treatment.`,
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const result = await ipcRenderer.invoke('delete-treatment-session', session.id);
          if (result.success) {
            showToast('success', `Session ${session.sessionNumber} deleted`);
            onSaved();
            onClose();
          } else {
            showToast('error', result.error || 'Failed to delete session');
          }
        } catch {
          showToast('error', 'Failed to delete session');
        }
      }
    });
  };

  const isModified = session.attended === 1 || session.cancelled === 1 ||
    (session.painBefore !== null) || (session.notes && session.notes.length > 0);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-xl border border-slate-100 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex justify-between items-center z-10 rounded-t-3xl">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Session {session.sessionNumber}</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{treatmentName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Session Date</label>
            <input
              type="date"
              value={sessionDate || ''}
              onChange={e => setSessionDate(e.target.value || null)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Status</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setAttended(1); setCancelled(0); }}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  attended === 1 && cancelled === 0
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                Attended
              </button>
              <button
                type="button"
                onClick={() => { setCancelled(1); setAttended(0); }}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  cancelled === 1
                    ? 'bg-rose-50 border-rose-300 text-rose-700 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                Cancelled
              </button>
              <button
                type="button"
                onClick={() => { setAttended(0); setCancelled(0); }}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${
                  attended === 0 && cancelled === 0
                    ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                Pending
              </button>
            </div>
          </div>

          {cancelled === 1 && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Rescheduled To</label>
              <input
                type="date"
                value={rescheduledDate || ''}
                onChange={e => setRescheduledDate(e.target.value || null)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all"
              />
            </div>
          )}

          {attended === 1 && cancelled === 0 && (
            <>
              <PainScale label="Pain Before Treatment (0-10)" value={painBefore} onChange={setPainBefore} />
              <PainScale label="Pain After Treatment (0-10)" value={painAfter} onChange={setPainAfter} />

              {painBefore !== null && painAfter !== null && (
                <div className={`px-4 py-2.5 rounded-xl text-sm font-semibold border ${
                  (painBefore - painAfter) >= 3 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                  (painBefore - painAfter) >= 1 ? 'bg-blue-50 border-blue-200 text-blue-700' :
                  (painBefore - painAfter) > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' :
                  (painBefore - painAfter) === 0 ? 'bg-slate-50 border-slate-200 text-slate-700' :
                  'bg-rose-50 border-rose-200 text-rose-700'
                }`}>
                  Pain relief: {painBefore - painAfter >= 0 ? '-' : '+'}{Math.abs(painBefore - painAfter)} points
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Exercises Performed</label>
                <ExercisesAutocomplete
                  value={exercisesPerformed}
                  onChange={setExercisesPerformed}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Progress</label>
                <div className="flex gap-2">
                  {[
                    { value: 'improving', label: 'Improving', color: 'emerald' },
                    { value: 'stable', label: 'Stable', color: 'blue' },
                    { value: 'worsening', label: 'Worsening', color: 'rose' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setProgress(progress === opt.value ? null : opt.value)}
                      className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        progress === opt.value
                          ? opt.color === 'emerald' ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : opt.color === 'blue' ? 'bg-blue-50 border-blue-300 text-blue-700'
                            : 'bg-rose-50 border-rose-300 text-rose-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Session Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Additional observations, patient feedback..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-all resize-none"
              rows={2}
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex gap-3 justify-between rounded-b-3xl">
          <div className="flex gap-2">
            {isModified && (
              <button
                onClick={handleReset}
                disabled={saving}
                className="px-3 py-2.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors disabled:opacity-50"
                title="Reset to pending — clears all logged data"
              >
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Reset
                </span>
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-3 py-2.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors disabled:opacity-50"
              title="Permanently delete this session slot"
            >
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete
              </span>
            </button>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Session'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
