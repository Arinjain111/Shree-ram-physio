import { useState, useEffect, useCallback } from 'react';
import { useUI } from '@/context/UIContext';
import { ipcRenderer } from '@/lib/ipc';
import type { TreatmentSessionSummary, TreatmentSession, PainTrendPoint } from '@/types/database.types';
import { SessionLogModal } from './SessionLogModal';
import { PainTrendChart } from './PainTrendChart';
import SessionContextMenu, { type ContextMenuItem } from './SessionContextMenu';

interface TreatmentSessionPanelProps {
  patientId: number;
  patientName?: string;
}

export const TreatmentSessionPanel = ({ patientId }: TreatmentSessionPanelProps) => {
  const { showToast, showModal } = useUI();
  const [treatments, setTreatments] = useState<TreatmentSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSession, setEditingSession] = useState<{ session: TreatmentSession; treatmentName: string } | null>(null);
  const [painTrend, setPainTrend] = useState<PainTrendPoint[]>([]);
  const [showTrendFor, setShowTrendFor] = useState<number | null>(null);
  const [showHolidayForm, setShowHolidayForm] = useState<number | null>(null);
  const [holidayDate, setHolidayDate] = useState(new Date().toISOString().split('T')[0]);
  const [holidayType, setHolidayType] = useState<'holiday' | 'patient_leave' | 'doctor_leave'>('holiday');
  const [holidayNotes, setHolidayNotes] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; session: TreatmentSession; treatmentName: string } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const result = await ipcRenderer.invoke('get-patient-sessions-summary', patientId);
      if (result.success) {
        setTreatments(result.treatments);
      }
    } catch (error) {
      showToast('error', 'Failed to load session data');
    } finally {
      setLoading(false);
    }
  }, [patientId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadPainTrend = async (treatmentId: number) => {
    try {
      const result = await ipcRenderer.invoke('get-pain-trend', treatmentId);
      if (result.success) {
        setPainTrend(result.trend);
        setShowTrendFor(treatmentId);
      }
    } catch {
      showToast('error', 'Failed to load pain trend');
    }
  };

  const handleInitializeSessions = async (treatmentId: number, sessionCount: number) => {
    try {
      const result = await ipcRenderer.invoke('initialize-treatment-sessions', treatmentId, sessionCount);
      if (result.success) {
        showToast('success', `${sessionCount} sessions initialized`);
        loadData();
      } else {
        showToast('error', result.error || 'Failed to initialize sessions');
      }
    } catch {
      showToast('error', 'Failed to initialize sessions');
    }
  };

  const handleAddHoliday = async (treatmentId: number) => {
    try {
      const result = await ipcRenderer.invoke('add-holiday-leave', {
        treatmentId,
        date: holidayDate,
        type: holidayType,
        notes: holidayNotes || undefined
      });
      if (result.success) {
        showToast('success', `${holidayType.replace('_', ' ')} logged`);
        setShowHolidayForm(null);
        setHolidayNotes('');
        loadData();
      } else {
        showToast('error', result.error || 'Failed to add holiday');
      }
    } catch {
      showToast('error', 'Failed to add holiday');
    }
  };

  const handleQuickAttended = async (session: TreatmentSession) => {
    try {
      const result = await ipcRenderer.invoke('mark-session-attended', session.id, null, null);
      if (result.success) {
        showToast('success', `Session ${session.sessionNumber} marked attended`);
        loadData();
      } else {
        showToast('error', result.error || 'Failed to mark attended');
      }
    } catch {
      showToast('error', 'Failed to mark attended');
    }
  };

  const handleDeleteSession = (session: TreatmentSession) => {
    showModal({
      title: 'Delete Session',
      message: `Permanently delete session ${session.sessionNumber}? This cannot be undone.`,
      type: 'danger',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const result = await ipcRenderer.invoke('delete-treatment-session', session.id);
          if (result.success) {
            showToast('success', `Session ${session.sessionNumber} deleted`);
            loadData();
          } else {
            showToast('error', result.error || 'Failed to delete session');
          }
        } catch {
          showToast('error', 'Failed to delete session');
        }
      }
    });
  };

  const handleResetSession = (session: TreatmentSession) => {
    showModal({
      title: 'Reset Session',
      message: `Reset session ${session.sessionNumber} to pending? This will clear all logged data.`,
      type: 'warning',
      confirmText: 'Reset',
      cancelText: 'Cancel',
      onConfirm: async () => {
        try {
          const result = await ipcRenderer.invoke('reset-treatment-session', session.id);
          if (result.success) {
            showToast('success', `Session ${session.sessionNumber} reset`);
            loadData();
          } else {
            showToast('error', result.error || 'Failed to reset session');
          }
        } catch {
          showToast('error', 'Failed to reset session');
        }
      }
    });
  };

  const buildContextMenu = (session: TreatmentSession, treatmentName: string): ContextMenuItem[] => {
    const isAttended = session.attended === 1;
    const isCancelled = session.cancelled === 1;
    const isPending = !isAttended && !isCancelled;

    return [
      {
        label: 'Open full editor',
        icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
        onClick: () => setEditingSession({ session, treatmentName }),
      },
      { label: '', onClick: () => {}, separator: true },
      {
        label: 'Mark as Attended (quick)',
        icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
        onClick: () => handleQuickAttended(session),
        disabled: isAttended,
      },
      { label: '', onClick: () => {}, separator: true },
      {
        label: 'Reset to Pending',
        icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
        onClick: () => handleResetSession(session),
        disabled: isPending,
      },
      {
        label: 'Delete Session',
        icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
        onClick: () => handleDeleteSession(session),
        destructive: true,
      },
    ];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (treatments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-slate-700 mb-1">No Session Data</h3>
        <p className="text-sm text-slate-500 max-w-sm">
          Sessions are tracked per treatment. When this patient has treatments with sessions, they'll appear here.
        </p>
      </div>
    );
  }

  const totalAttended = treatments.reduce((s, t) => s + t.attendedCount, 0);
  const totalSessions = treatments.reduce((s, t) => s + t.totalSessions, 0);
  const totalPending = treatments.reduce((s, t) => s + t.pendingCount, 0);
  const totalCancelled = treatments.reduce((s, t) => s + t.cancelledCount, 0);
  const completionPct = totalSessions > 0 ? Math.round((totalAttended / totalSessions) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Completed</div>
          <div className="text-2xl font-bold text-slate-800">{totalAttended}<span className="text-sm text-slate-400 font-medium">/{totalSessions}</span></div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Completion</div>
          <div className="text-2xl font-bold text-indigo-600">{completionPct}%</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pending</div>
          <div className="text-2xl font-bold text-amber-600">{totalPending}</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-xs">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cancelled</div>
          <div className="text-2xl font-bold text-rose-600">{totalCancelled}</div>
        </div>
      </div>

      {/* Per-treatment panels */}
      {treatments.map(treatment => {
        const pct = treatment.totalSessions > 0
          ? Math.round((treatment.attendedCount / treatment.totalSessions) * 100)
          : 0;

        return (
          <div key={treatment.treatmentId} className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden">
            {/* Treatment header */}
            <div className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-base font-bold text-slate-800">{treatment.treatmentName}</h4>
                  <span className="text-xs font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                    INV #{treatment.invoiceNumber}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
                  <span className="text-emerald-600">{treatment.attendedCount} done</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <span className="text-amber-600">{treatment.pendingCount} pending</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  <span className="text-rose-600">{treatment.cancelledCount} cancelled</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {treatment.sessions.length === 0 && (
                  <button
                    onClick={() => handleInitializeSessions(treatment.treatmentId, treatment.totalSessions)}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 shadow-sm transition-all"
                  >
                    Initialize Sessions
                  </button>
                )}
                {treatment.sessions.length > 0 && (
                  <>
                    <button
                      onClick={() => loadPainTrend(treatment.treatmentId)}
                      className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      Pain Trend
                    </button>
                    <button
                      onClick={() => { setShowHolidayForm(showHolidayForm === treatment.treatmentId ? null : treatment.treatmentId); setShowTrendFor(null); }}
                      className="px-3 py-1.5 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                    >
                      + Holiday / Leave
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="px-6 pt-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-indigo-600 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-500 min-w-[3rem] text-right">{pct}%</span>
              </div>
            </div>

            {/* Pain trend chart */}
            {showTrendFor === treatment.treatmentId && painTrend.length > 0 && (
              <div className="px-6 pt-4">
                <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4">
                  <PainTrendChart trend={painTrend} />
                </div>
              </div>
            )}

            {/* Holiday form */}
            {showHolidayForm === treatment.treatmentId && (
              <div className="px-6 pt-4">
                <div className="bg-amber-50/50 rounded-2xl border border-amber-100 p-4 space-y-3">
                  <h5 className="text-xs font-bold text-amber-700 uppercase tracking-wider">Log Holiday / Leave</h5>
                  <div className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Date</label>
                      <input
                        type="date"
                        value={holidayDate}
                        onChange={e => setHolidayDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-400 transition-all"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Type</label>
                      <select
                        value={holidayType}
                        onChange={e => setHolidayType(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-400 transition-all"
                      >
                        <option value="holiday">Holiday</option>
                        <option value="patient_leave">Patient Leave</option>
                        <option value="doctor_leave">Doctor Leave</option>
                      </select>
                    </div>
                    <div className="flex-[2]">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Notes</label>
                      <input
                        type="text"
                        value={holidayNotes}
                        onChange={e => setHolidayNotes(e.target.value)}
                        placeholder="Optional note..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-400 transition-all"
                      />
                    </div>
                    <button
                      onClick={() => handleAddHoliday(treatment.treatmentId)}
                      className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-xl hover:bg-amber-500 transition-all shadow-sm whitespace-nowrap"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sessions grid */}
            {treatment.sessions.length > 0 && (
              <div className="p-6">
                <div className="flex flex-wrap gap-2">
                  {treatment.sessions.map(session => {
                    const isAttended = session.attended === 1;
                    const isCancelled = session.cancelled === 1;
                    const isPending = !isAttended && !isCancelled;

                    let ringColor = 'border-slate-200 bg-white text-slate-500';
                    if (isAttended) {
                      ringColor = 'border-emerald-300 bg-emerald-50 text-emerald-700';
                    } else if (isCancelled) {
                      const isHoliday = session.notes?.startsWith('[HOLIDAY]');
                      const isPatientLeave = session.notes?.startsWith('[PATIENT_LEAVE]');
                      const isDoctorLeave = session.notes?.startsWith('[DOCTOR_LEAVE]');
                      if (isHoliday) ringColor = 'border-purple-300 bg-purple-50 text-purple-700';
                      else if (isPatientLeave) ringColor = 'border-amber-300 bg-amber-50 text-amber-700';
                      else if (isDoctorLeave) ringColor = 'border-blue-300 bg-blue-50 text-blue-700';
                      else ringColor = 'border-rose-300 bg-rose-50 text-rose-700';
                    }

                    return (
                      <button
                        key={session.id}
                        onClick={() => setEditingSession({ session, treatmentName: treatment.treatmentName })}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ x: e.clientX, y: e.clientY, session, treatmentName: treatment.treatmentName });
                        }}
                        className={`group relative w-14 h-14 rounded-xl border-2 ${ringColor} flex flex-col items-center justify-center transition-all hover:scale-105 hover:shadow-md cursor-context-menu`}
                        title={
                          isAttended
                            ? `S${session.sessionNumber}: Attended${session.painBefore !== null ? `\nPain: ${session.painBefore} → ${session.painAfter}` : ''}\n\nLeft-click: Edit • Right-click: Actions`
                            : isCancelled
                              ? `S${session.sessionNumber}: Cancelled${session.rescheduledDate ? `\nRescheduled: ${session.rescheduledDate}` : ''}${session.notes ? `\n${session.notes}` : ''}\n\nLeft-click: Edit • Right-click: Actions`
                              : `S${session.sessionNumber}: Pending\n\nLeft-click: Edit • Right-click: Actions`
                        }
                      >
                        <span className="text-sm font-bold">{session.sessionNumber}</span>
                        {isAttended && session.painBefore !== null && (
                          <span className="text-[8px] font-semibold opacity-70">
                            {session.painBefore}→{session.painAfter}
                          </span>
                        )}
                        {isCancelled && (
                          <svg className="w-3 h-3 absolute -top-1 -right-1 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        )}
                        {isPending && (
                          <span className="text-[8px] font-semibold opacity-50">open</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {treatment.sessions.length === 0 && (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-slate-500">
                  Click "Initialize Sessions" to create {treatment.totalSessions} trackable session slots for this treatment.
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Session log modal */}
      {editingSession && (
        <SessionLogModal
          session={editingSession.session}
          treatmentName={editingSession.treatmentName}
          onClose={() => setEditingSession(null)}
          onSaved={loadData}
        />
      )}

      {/* Context menu */}
      {contextMenu && (
        <SessionContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildContextMenu(contextMenu.session, contextMenu.treatmentName)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
};
