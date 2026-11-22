import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  MessageCircle,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  apiGetNotifications,
  apiGetTickets,
  apiMarkAllNotificationsRead,
  apiMarkNotificationRead,
  apiReplyToTicket,
  apiResetClinicData,
  apiUpdateClinicData,
  apiUpdateTicketStatus,
} from '../lib/clinicApi.ts';
import {
  normalizeClinicData,
  type ClinicData,
  type ReceptionistNotification,
  type Ticket,
  type TicketStatus,
} from '../types.ts';
import { LeadDashboardPanel } from './LeadDashboardPanel.tsx';

interface StaffPortalPageProps {
  clinicData: ClinicData;
  onClinicDataUpdated: (updated: ClinicData) => void;
}

type StaffTab = 'tickets' | 'leads' | 'clinic-file';
type StatusFilter = 'all' | TicketStatus;

function formatAge(createdAt: string, nowMs: number): { label: string; minutes: number } {
  const diffMs = Math.max(0, nowMs - new Date(createdAt).getTime());
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return { label: 'Just now', minutes: 0 };
  if (minutes < 60) return { label: `${minutes}m ago`, minutes };
  const hours = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  if (hours < 24) return { label: `${hours}h ${remMins}m ago`, minutes };
  const days = Math.floor(hours / 24);
  return { label: `${days}d ${hours % 24}h ago`, minutes };
}

function getPriorityText(ticket: Ticket, ageMinutes: number): {
  label: string;
  toneClass: string;
} {
  if (ticket.status === 'urgent') {
    return { label: 'P1 · Urgent Emergency', toneClass: 'text-rose-700 font-semibold' };
  }
  if (ticket.status === 'needs human') {
    if (ageMinutes >= 120) {
      return { label: 'P2 · Overdue (>2h SLA)', toneClass: 'text-rose-700 font-semibold' };
    }
    return { label: 'P2 · Needs Human (2h SLA)', toneClass: 'text-amber-700 font-semibold' };
  }
  if (ticket.status === 'answered') {
    return { label: 'Answered by Staff', toneClass: 'text-emerald-800 font-medium' };
  }
  return { label: 'Closed', toneClass: 'text-slate-500 font-medium' };
}

export function StaffPortalPage({
  clinicData,
  onClinicDataUpdated,
}: StaffPortalPageProps) {
  const [activeTab, setActiveTab] = useState<StaffTab>('tickets');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [ticketFeedback, setTicketFeedback] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ReceptionistNotification[]>([]);

  // Clinic file editor state
  const [draftClinic, setDraftClinic] = useState<ClinicData>(() =>
    normalizeClinicData(clinicData),
  );
  const [rawJsonMode, setRawJsonMode] = useState(false);
  const [rawJsonText, setRawJsonText] = useState(() =>
    JSON.stringify(normalizeClinicData(clinicData), null, 2),
  );
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSavingClinic, setIsSavingClinic] = useState(false);

  useEffect(() => {
    const normalized = normalizeClinicData(clinicData);
    setDraftClinic(normalized);
    setRawJsonText(JSON.stringify(normalized, null, 2));
  }, [clinicData]);

  // Tick ageing timer every 10s
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 10000);
    return () => window.clearInterval(t);
  }, []);

  const fetchTickets = useCallback(async () => {
    try {
      const list = await apiGetTickets();
      setTickets(list);
    } catch {
      // Retry on next poll
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const list = await apiGetNotifications();
      setNotifications(list);
    } catch {
      // Retry on next poll
    }
  }, []);

  useEffect(() => {
    void fetchTickets();
    void fetchNotifications();
    const timer = window.setInterval(() => {
      void fetchTickets();
      void fetchNotifications();
    }, 3000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'dentistae_tickets_v1') {
        void fetchTickets();
      }
      if (e.key === 'dentistae_notifications_v1') {
        void fetchNotifications();
      }
    };
    const onLocalAlert = () => {
      void fetchNotifications();
      void fetchTickets();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('dentistae:notifications-updated', onLocalAlert);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('dentistae:notifications-updated', onLocalAlert);
    };
  }, [fetchTickets, fetchNotifications]);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read),
    [notifications],
  );

  const counts = useMemo(() => {
    return {
      all: tickets.length,
      urgent: tickets.filter((t) => t.status === 'urgent').length,
      'needs human': tickets.filter((t) => t.status === 'needs human').length,
      answered: tickets.filter((t) => t.status === 'answered').length,
      closed: tickets.filter((t) => t.status === 'closed').length,
    };
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.question.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q) ||
        (t.bookingTime && t.bookingTime.toLowerCase().includes(q)) ||
        t.replies.some((r) => r.text.toLowerCase().includes(q))
      );
    });
  }, [tickets, statusFilter, searchQuery]);

  const handleSendReply = async (ticketId: string) => {
    const text = (replyDrafts[ticketId] || '').trim();
    if (!text || submittingId) return;

    setSubmittingId(ticketId);
    setTicketFeedback(null);
    try {
      const ok = await apiReplyToTicket(ticketId, text, 'answered');
      if (!ok) {
        throw new Error('Failed to send reply.');
      }
      setReplyDrafts((prev) => ({ ...prev, [ticketId]: '' }));
      setTicketFeedback(`Reply sent to patient for ${ticketId}.`);
      await fetchTickets();
    } catch (err) {
      setTicketFeedback(
        err instanceof Error ? err.message : 'Unable to send staff reply.',
      );
    } finally {
      setSubmittingId(null);
    }
  };

  const handleStatusChange = async (ticketId: string, status: TicketStatus) => {
    try {
      const ok = await apiUpdateTicketStatus(ticketId, status);
      if (ok) {
        await fetchTickets();
      }
    } catch {
      // Ignore transient error
    }
  };

  const handleSaveClinicFile = async () => {
    setSaveStatus(null);
    setSaveError(null);
    setIsSavingClinic(true);
    try {
      const parsed = rawJsonMode
        ? (JSON.parse(rawJsonText) as Partial<ClinicData>)
        : draftClinic;
      const payload = normalizeClinicData(parsed);

      const updated = await apiUpdateClinicData(payload);
      onClinicDataUpdated(updated);
      setSaveStatus('Clinic file saved. Bot and fallback replies now use the updated data.');
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Invalid JSON or failed to save.',
      );
    } finally {
      setIsSavingClinic(false);
    }
  };

  const handleResetClinicFile = async () => {
    setSaveStatus(null);
    setSaveError(null);
    try {
      const fresh = await apiResetClinicData();
      onClinicDataUpdated(fresh);
      setSaveStatus('Clinic file restored to default Banjara Hills records.');
    } catch {
      setSaveError('Failed to reset clinic file.');
    }
  };

  const handleUploadJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = normalizeClinicData(JSON.parse(text) as Partial<ClinicData>);
      setDraftClinic(parsed);
      setRawJsonText(JSON.stringify(parsed, null, 2));
      setSaveStatus(`Loaded ${file.name}. Click "Save Clinic File" to apply.`);
      setSaveError(null);
    } catch {
      setSaveError('Uploaded file is not valid clinic-data JSON.');
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(draftClinic, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clinic-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Staff Header & View Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-emerald-950 tracking-tight">
            Front Desk Staff Portal
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Triage patient escalations, confirm bookings, and maintain the clinic file.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('tickets')}
            className={`px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'tickets'
                ? 'bg-white text-emerald-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ticket Queue ({tickets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('leads')}
            className={`px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'leads'
                ? 'bg-white text-emerald-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lead Dashboard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('clinic-file')}
            className={`px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'clinic-file'
                ? 'bg-white text-emerald-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Clinic File Editor
          </button>
        </div>
      </div>

      {/* Live Receptionist Alerts Banner (WhatsApp & Booking Auto-Capture) */}
      {unreadNotifications.length > 0 && (
        <section
          aria-label="Receptionist notifications"
          className="rounded-2xl bg-emerald-50/90 border border-emerald-900/20 p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-emerald-950">
              <Bell className="w-4 h-4 text-emerald-800 shrink-0" aria-hidden="true" />
              <h2 className="text-sm font-bold">
                Receptionist Alerts ({unreadNotifications.length} unread)
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('leads')}
                className="px-3 py-1.5 min-h-[34px] rounded-lg bg-emerald-900 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors cursor-pointer"
              >
                Open Lead Dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  void apiMarkAllNotificationsRead().then((updated) => setNotifications(updated));
                }}
                className="px-3 py-1.5 min-h-[34px] rounded-lg border border-emerald-900/20 bg-white text-xs font-medium text-emerald-950 hover:bg-emerald-50 transition-colors cursor-pointer"
              >
                Mark All Read
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {unreadNotifications.slice(0, 4).map((alert) => {
              const age = formatAge(alert.createdAt, nowMs);
              return (
                <div
                  key={alert.id}
                  className="rounded-xl bg-white border border-emerald-950/10 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-900">
                        <MessageCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{alert.title}</span>
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500 tabular-nums">{age.label}</span>
                      {alert.leadId && (
                        <>
                          <span className="text-slate-400">·</span>
                          <span className="font-mono text-slate-600">{alert.leadId}</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-700">{alert.summary}</p>
                    {alert.prefilledMessage && (
                      <p className="text-[11px] text-slate-500 italic truncate">
                        “{alert.prefilledMessage}”
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void apiMarkNotificationRead(alert.id).then(() => fetchNotifications());
                    }}
                    className="self-start sm:self-center px-2.5 py-1.5 min-h-[32px] rounded-lg border border-slate-200 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === 'leads' ? (
        <LeadDashboardPanel clinicData={clinicData} />
      ) : activeTab === 'tickets' ? (
        <section aria-label="Ticket queue workspace" className="space-y-4">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <p className="text-xs text-slate-500">Urgent</p>
              <p className="text-2xl font-bold text-rose-700 tabular-nums mt-0.5">
                {counts.urgent}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <p className="text-xs text-slate-500">Needs Human</p>
              <p className="text-2xl font-bold text-amber-700 tabular-nums mt-0.5">
                {counts['needs human']}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <p className="text-xs text-slate-500">Answered</p>
              <p className="text-2xl font-bold text-emerald-800 tabular-nums mt-0.5">
                {counts.answered}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3.5">
              <p className="text-xs text-slate-500">Closed</p>
              <p className="text-2xl font-bold text-slate-700 tabular-nums mt-0.5">
                {counts.closed}
              </p>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'urgent', label: 'Urgent' },
                  { id: 'needs human', label: 'Needs Human' },
                  { id: 'answered', label: 'Answered' },
                  { id: 'closed', label: 'Closed' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-2 min-h-[40px] text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === tab.id
                      ? 'bg-white text-emerald-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label} ({counts[tab.id]})
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tickets..."
                aria-label="Search tickets"
                className="w-full md:w-64 h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
              <button
                type="button"
                onClick={() => void fetchTickets()}
                aria-label="Refresh tickets"
                className="h-10 min-w-[40px] px-3 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors shrink-0"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {ticketFeedback && (
            <div
              role="status"
              className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-medium text-emerald-900"
            >
              {ticketFeedback}
            </div>
          )}

          {/* Ticket Queue Container */}
          <div id="ticket-queue" className="space-y-4">
            {loadingTickets ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-slate-500">
                Loading front desk tickets...
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-700 mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900">
                  No tickets match this view
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Unanswered patient questions, booking requests, and emergencies will appear
                  here automatically.
                </p>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const age = formatAge(ticket.createdAt, nowMs);
                const priority = getPriorityText(ticket, age.minutes);
                const priorityCode =
                  ticket.status === 'urgent'
                    ? 'P1'
                    : ticket.status === 'needs human'
                      ? 'P2'
                      : ticket.status === 'answered'
                        ? 'P3'
                        : 'P4';

                return (
                  <article
                    key={ticket.id}
                    data-ticket={ticket.id}
                    data-status={ticket.status}
                    data-priority={priorityCode}
                    data-age-minutes={age.minutes}
                    data-booking-time={ticket.bookingTime || ''}
                    className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4"
                  >
                    {/* Metadata Row (Unboxed clean typography with separators) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2 text-slate-500">
                        <span className="font-mono font-semibold text-slate-900 tabular-nums">
                          {ticket.id}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className={priority.toneClass}>
                          {ticket.status === 'urgent' && (
                            <AlertTriangle
                              className="w-3.5 h-3.5 inline mr-1 -mt-0.5"
                              aria-hidden="true"
                            />
                          )}
                          {priority.label}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          Age: {age.label} ({new Date(ticket.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })})
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Status: {ticket.status}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {ticket.status !== 'closed' && (
                          <button
                            type="button"
                            onClick={() => void handleStatusChange(ticket.id, 'closed')}
                            className="px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
                          >
                            Close Ticket
                          </button>
                        )}
                        {ticket.status === 'closed' && (
                          <button
                            type="button"
                            onClick={() => void handleStatusChange(ticket.id, 'needs human')}
                            className="px-2.5 py-1.5 min-h-[36px] text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
                          >
                            Reopen
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Patient Question */}
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Patient Inquiry</p>
                      <p className="text-sm sm:text-base font-medium text-slate-900 leading-relaxed">
                        {ticket.question}
                      </p>
                      {ticket.bookingTime && (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-900">
                          <CalendarClock className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>Requested booking time: {ticket.bookingTime}</span>
                        </p>
                      )}
                    </div>

                    {/* Existing Staff Replies */}
                    {ticket.replies.length > 0 && (
                      <div className="border-t border-slate-100 pt-3 space-y-2">
                        <p className="text-xs font-medium text-slate-500">Staff Replies Sent</p>
                        {ticket.replies.map((rep) => (
                          <div
                            key={rep.id}
                            className="bg-emerald-50/70 border border-emerald-200/70 rounded-xl px-3.5 py-2.5 text-sm text-emerald-950"
                          >
                            <p className="whitespace-pre-wrap">{rep.text}</p>
                            <p className="text-[11px] text-emerald-800/70 mt-1 tabular-nums">
                              Sent {new Date(rep.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Staff Reply Input (#staff-reply and #staff-send on each ticket) */}
                    <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row gap-2.5">
                      <textarea
                        id="staff-reply"
                        rows={2}
                        value={replyDrafts[ticket.id] || ''}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({
                            ...prev,
                            [ticket.id]: e.target.value,
                          }))
                        }
                        placeholder="Type human reply to appear in the patient's chat..."
                        aria-label={`Staff reply for ticket ${ticket.id}`}
                        className="flex-1 min-w-0 p-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      />
                      <button
                        id="staff-send"
                        type="button"
                        disabled={submittingId === ticket.id || !(replyDrafts[ticket.id] || '').trim()}
                        onClick={() => void handleSendReply(ticket.id)}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] sm:self-end rounded-xl bg-emerald-900 text-white text-sm font-medium hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" aria-hidden="true" />
                        <span>{submittingId === ticket.id ? 'Sending...' : 'Send Reply'}</span>
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      ) : (
        /* Clinic File Editor */
        <section aria-label="Clinic file editor" className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-emerald-950">
                  Clinic Knowledge File
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Changes saved here apply immediately to both AI replies and offline clinic file
                  matching.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!rawJsonMode) {
                      setRawJsonText(JSON.stringify(draftClinic, null, 2));
                      setSaveError(null);
                      setRawJsonMode(true);
                    } else {
                      try {
                        const parsed = normalizeClinicData(
                          JSON.parse(rawJsonText) as Partial<ClinicData>,
                        );
                        setDraftClinic(parsed);
                        setSaveError(null);
                        setRawJsonMode(false);
                      } catch {
                        setSaveError(
                          'Invalid JSON syntax. Fix the JSON before switching back to the structured form.',
                        );
                      }
                    }
                  }}
                  className="px-3 py-2 min-h-[40px] rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  {rawJsonMode ? 'Structured Form' : 'Raw JSON Editor'}
                </button>
                <label className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap">
                  <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Import JSON</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => void handleUploadJsonFile(e)}
                    className="sr-only"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleDownloadJson}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {saveStatus && (
              <div
                role="status"
                className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-medium text-emerald-900"
              >
                {saveStatus}
              </div>
            )}
            {saveError && (
              <div
                role="alert"
                className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs font-medium text-rose-800"
              >
                {saveError}
              </div>
            )}

            {rawJsonMode ? (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  clinic-data.json
                </label>
                <textarea
                  rows={20}
                  value={rawJsonText}
                  onChange={(e) => setRawJsonText(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-slate-300 font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Basic Info & Timings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Clinic Name
                    </label>
                    <input
                      type="text"
                      value={draftClinic.clinicName}
                      onChange={(e) =>
                        setDraftClinic({ ...draftClinic, clinicName: e.target.value })
                      }
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Front Desk Phone
                    </label>
                    <input
                      type="text"
                      value={draftClinic.phone}
                      onChange={(e) =>
                        setDraftClinic({ ...draftClinic, phone: e.target.value })
                      }
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Emergency Phone (24/7)
                    </label>
                    <input
                      type="text"
                      value={draftClinic.emergencyPhone}
                      onChange={(e) =>
                        setDraftClinic({ ...draftClinic, emergencyPhone: e.target.value })
                      }
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Address
                    </label>
                    <input
                      type="text"
                      value={draftClinic.address}
                      onChange={(e) =>
                        setDraftClinic({ ...draftClinic, address: e.target.value })
                      }
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Weekday & Saturday Timings
                    </label>
                    <input
                      type="text"
                      value={draftClinic.timings?.weekdays ?? ''}
                      onChange={(e) =>
                        setDraftClinic({
                          ...draftClinic,
                          timings: {
                            ...(draftClinic.timings ?? {
                              weekdays: '',
                              sunday: '',
                              lunchBreak: '',
                            }),
                            weekdays: e.target.value,
                          },
                        })
                      }
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Sunday Timings
                    </label>
                    <input
                      type="text"
                      value={draftClinic.timings?.sunday ?? ''}
                      onChange={(e) =>
                        setDraftClinic({
                          ...draftClinic,
                          timings: {
                            ...(draftClinic.timings ?? {
                              weekdays: '',
                              sunday: '',
                              lunchBreak: '',
                            }),
                            sunday: e.target.value,
                          },
                        })
                      }
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Lunch Break
                    </label>
                    <input
                      type="text"
                      value={draftClinic.timings?.lunchBreak ?? ''}
                      onChange={(e) =>
                        setDraftClinic({
                          ...draftClinic,
                          timings: {
                            ...(draftClinic.timings ?? {
                              weekdays: '',
                              sunday: '',
                              lunchBreak: '',
                            }),
                            lunchBreak: e.target.value,
                          },
                        })
                      }
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Landmark
                    </label>
                    <input
                      type="text"
                      value={draftClinic.landmark}
                      onChange={(e) =>
                        setDraftClinic({ ...draftClinic, landmark: e.target.value })
                      }
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={draftClinic.email}
                      onChange={(e) =>
                        setDraftClinic({ ...draftClinic, email: e.target.value })
                      }
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Parking & Accessibility
                    </label>
                    <input
                      type="text"
                      value={draftClinic.parkingAndAccess}
                      onChange={(e) =>
                        setDraftClinic({
                          ...draftClinic,
                          parkingAndAccess: e.target.value,
                        })
                      }
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                    />
                  </div>
                </div>

                {/* Doctors Editor */}
                <div className="border-t border-slate-100 pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Doctors (Qualifications, Registration &amp; Timings)
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftClinic({
                          ...draftClinic,
                          doctors: [
                            ...draftClinic.doctors,
                            {
                              id: `doc-${Date.now()}`,
                              name: 'Dr. New Specialist',
                              qualification: 'BDS, MDS',
                              registrationNumber: 'TSDC Reg. No. A-00000 · Telangana State Dental Council',
                              specialty: 'General Dentistry',
                              expertise: ['Oral Check-Ups', 'Preventive Dentistry'],
                              schedule: 'Mon–Fri, 10:00 AM – 5:00 PM',
                            },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Add Doctor</span>
                    </button>
                  </div>
                  <div className="space-y-3">
                    {draftClinic.doctors.map((doc, idx) => (
                      <div
                        key={doc.id}
                        className="border border-slate-200 rounded-xl p-3.5 space-y-2.5 bg-slate-50/40"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.2fr_1.2fr_auto] gap-2 items-center">
                          <input
                            type="text"
                            value={doc.name}
                            placeholder="Doctor Name"
                            aria-label="Doctor name"
                            onChange={(e) => {
                              const next = [...draftClinic.doctors];
                              next[idx] = { ...doc, name: e.target.value };
                              setDraftClinic({ ...draftClinic, doctors: next });
                            }}
                            className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium"
                          />
                          <input
                            type="text"
                            value={doc.qualification}
                            placeholder="Qualifications (BDS / MDS)"
                            aria-label="Doctor qualification"
                            onChange={(e) => {
                              const next = [...draftClinic.doctors];
                              next[idx] = { ...doc, qualification: e.target.value };
                              setDraftClinic({ ...draftClinic, doctors: next });
                            }}
                            className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                          />
                          <input
                            type="text"
                            value={doc.registrationNumber || ''}
                            placeholder="Registration Details (e.g. TSDC Reg. No.)"
                            aria-label="Doctor registration details"
                            onChange={(e) => {
                              const next = [...draftClinic.doctors];
                              next[idx] = { ...doc, registrationNumber: e.target.value };
                              setDraftClinic({ ...draftClinic, doctors: next });
                            }}
                            className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs tabular-nums"
                          />
                          <button
                            type="button"
                            aria-label={`Remove ${doc.name}`}
                            onClick={() =>
                              setDraftClinic({
                                ...draftClinic,
                                doctors: draftClinic.doctors.filter((_, i) => i !== idx),
                              })
                            }
                            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={doc.specialty}
                            placeholder="Primary Specialisation"
                            aria-label="Doctor specialty"
                            onChange={(e) => {
                              const next = [...draftClinic.doctors];
                              next[idx] = { ...doc, specialty: e.target.value };
                              setDraftClinic({ ...draftClinic, doctors: next });
                            }}
                            className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                          />
                          <input
                            type="text"
                            value={(doc.expertise || []).join(', ')}
                            placeholder="Clinical Expertise (comma-separated)"
                            aria-label="Doctor clinical expertise"
                            onChange={(e) => {
                              const next = [...draftClinic.doctors];
                              next[idx] = {
                                ...doc,
                                expertise: e.target.value
                                  .split(',')
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              };
                              setDraftClinic({ ...draftClinic, doctors: next });
                            }}
                            className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                          />
                          <input
                            type="text"
                            value={doc.schedule}
                            placeholder="Consultation Timings"
                            aria-label="Doctor schedule"
                            onChange={(e) => {
                              const next = [...draftClinic.doctors];
                              next[idx] = { ...doc, schedule: e.target.value };
                              setDraftClinic({ ...draftClinic, doctors: next });
                            }}
                            className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs tabular-nums"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Services & Prices Editor */}
                <div className="border-t border-slate-100 pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Services & Tariffs
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setDraftClinic({
                          ...draftClinic,
                          services: [
                            ...draftClinic.services,
                            {
                              id: `srv-${Date.now()}`,
                              name: 'New Treatment',
                              price: '₹1,000',
                              notes: '',
                            },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Add Service</span>
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {draftClinic.services.map((srv, idx) => (
                      <div
                        key={srv.id}
                        className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_1.5fr_auto] gap-2 items-center border border-slate-200 rounded-xl p-3"
                      >
                        <input
                          type="text"
                          value={srv.name}
                          aria-label="Service name"
                          onChange={(e) => {
                            const next = [...draftClinic.services];
                            next[idx] = { ...srv, name: e.target.value };
                            setDraftClinic({ ...draftClinic, services: next });
                          }}
                          className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs"
                        />
                        <input
                          type="text"
                          value={srv.price}
                          aria-label="Service price"
                          onChange={(e) => {
                            const next = [...draftClinic.services];
                            next[idx] = { ...srv, price: e.target.value };
                            setDraftClinic({ ...draftClinic, services: next });
                          }}
                          className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs tabular-nums"
                        />
                        <input
                          type="text"
                          value={srv.notes || ''}
                          placeholder="Notes"
                          aria-label="Service notes"
                          onChange={(e) => {
                            const next = [...draftClinic.services];
                            next[idx] = { ...srv, notes: e.target.value };
                            setDraftClinic({ ...draftClinic, services: next });
                          }}
                          className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs"
                        />
                        <button
                          type="button"
                          aria-label={`Remove ${srv.name}`}
                          onClick={() =>
                            setDraftClinic({
                              ...draftClinic,
                              services: draftClinic.services.filter((_, i) => i !== idx),
                            })
                          }
                          className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Insurance & Policies */}
                <div className="border-t border-slate-100 pt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Insurance Summary
                    </label>
                    <textarea
                      rows={4}
                      value={draftClinic.insurance?.summary ?? ''}
                      onChange={(e) =>
                        setDraftClinic({
                          ...draftClinic,
                          insurance: {
                            ...(draftClinic.insurance ?? { summary: '', partners: [] }),
                            summary: e.target.value,
                          },
                        })
                      }
                      className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
                    />
                    <label className="block text-xs font-medium text-slate-700 mt-3 mb-1">
                      Insurance Partners (one per line)
                    </label>
                    <textarea
                      rows={4}
                      value={(draftClinic.insurance?.partners ?? []).join('\n')}
                      onChange={(e) =>
                        setDraftClinic({
                          ...draftClinic,
                          insurance: {
                            ...(draftClinic.insurance ?? { summary: '', partners: [] }),
                            partners: e.target.value
                              .split('\n')
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                      className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Clinic Policies (one per line)
                    </label>
                    <textarea
                      rows={9}
                      value={(draftClinic.policies ?? []).join('\n')}
                      onChange={(e) =>
                        setDraftClinic({
                          ...draftClinic,
                          policies: e.target.value
                            .split('\n')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      className="w-full p-2.5 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                </div>

                {/* Verified Google Reviews (With Source Links Only — No Fabricated Reviews) */}
                <div className="border-t border-slate-100 pt-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Verified Google Reviews (With Source Links)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Only paste genuine patient reviews copied from Google Maps along with their
                        direct review source URL. Leave empty to link patients directly to Google Maps.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const existing = draftClinic.googleReviews?.reviews ?? [];
                        setDraftClinic({
                          ...draftClinic,
                          googleReviews: {
                            placeUrl: draftClinic.googleReviews?.placeUrl ?? '',
                            reviews: [
                              ...existing,
                              {
                                id: `grev-${Date.now()}`,
                                authorName: '',
                                rating: 5,
                                dateLabel: '',
                                treatmentContext: '',
                                quote: '',
                                sourceUrl: '',
                              },
                            ],
                          },
                        });
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Add Verified Google Review</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Google Business Profile / Maps Reviews URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={draftClinic.googleReviews?.placeUrl ?? ''}
                      placeholder="https://maps.google.com/?cid=..."
                      onChange={(e) =>
                        setDraftClinic({
                          ...draftClinic,
                          googleReviews: {
                            placeUrl: e.target.value,
                            reviews: draftClinic.googleReviews?.reviews ?? [],
                          },
                        })
                      }
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>

                  {(draftClinic.googleReviews?.reviews ?? []).length > 0 && (
                    <div className="space-y-3">
                      {(draftClinic.googleReviews?.reviews ?? []).map((rev, idx) => (
                        <div
                          key={rev.id}
                          className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/40"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_1fr_1fr_auto] gap-2 items-center">
                            <input
                              type="text"
                              value={rev.authorName}
                              placeholder="Reviewer Name"
                              aria-label="Reviewer name"
                              onChange={(e) => {
                                const next = [...(draftClinic.googleReviews?.reviews ?? [])];
                                next[idx] = { ...rev, authorName: e.target.value };
                                setDraftClinic({
                                  ...draftClinic,
                                  googleReviews: {
                                    placeUrl: draftClinic.googleReviews?.placeUrl ?? '',
                                    reviews: next,
                                  },
                                });
                              }}
                              className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                            />
                            <select
                              value={rev.rating}
                              aria-label="Review star rating"
                              onChange={(e) => {
                                const next = [...(draftClinic.googleReviews?.reviews ?? [])];
                                next[idx] = { ...rev, rating: Number(e.target.value) };
                                setDraftClinic({
                                  ...draftClinic,
                                  googleReviews: {
                                    placeUrl: draftClinic.googleReviews?.placeUrl ?? '',
                                    reviews: next,
                                  },
                                });
                              }}
                              className="h-9 px-2 rounded-lg border border-slate-300 bg-white text-xs tabular-nums"
                            >
                              {[5, 4, 3, 2, 1].map((n) => (
                                <option key={n} value={n}>
                                  {n} ★
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={rev.dateLabel}
                              placeholder="Date (e.g. Oct 2025)"
                              aria-label="Review date"
                              onChange={(e) => {
                                const next = [...(draftClinic.googleReviews?.reviews ?? [])];
                                next[idx] = { ...rev, dateLabel: e.target.value };
                                setDraftClinic({
                                  ...draftClinic,
                                  googleReviews: {
                                    placeUrl: draftClinic.googleReviews?.placeUrl ?? '',
                                    reviews: next,
                                  },
                                });
                              }}
                              className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                            />
                            <input
                              type="text"
                              value={rev.treatmentContext || ''}
                              placeholder="Visit Context (Optional)"
                              aria-label="Review treatment context"
                              onChange={(e) => {
                                const next = [...(draftClinic.googleReviews?.reviews ?? [])];
                                next[idx] = { ...rev, treatmentContext: e.target.value };
                                setDraftClinic({
                                  ...draftClinic,
                                  googleReviews: {
                                    placeUrl: draftClinic.googleReviews?.placeUrl ?? '',
                                    reviews: next,
                                  },
                                });
                              }}
                              className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                            />
                            <button
                              type="button"
                              aria-label="Remove review"
                              onClick={() => {
                                const next = (draftClinic.googleReviews?.reviews ?? []).filter(
                                  (_, i) => i !== idx,
                                );
                                setDraftClinic({
                                  ...draftClinic,
                                  googleReviews: {
                                    placeUrl: draftClinic.googleReviews?.placeUrl ?? '',
                                    reviews: next,
                                  },
                                });
                              }}
                              className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            value={rev.quote}
                            placeholder="Exact Google review text..."
                            aria-label="Review text"
                            onChange={(e) => {
                              const next = [...(draftClinic.googleReviews?.reviews ?? [])];
                              next[idx] = { ...rev, quote: e.target.value };
                              setDraftClinic({
                                ...draftClinic,
                                googleReviews: {
                                  placeUrl: draftClinic.googleReviews?.placeUrl ?? '',
                                  reviews: next,
                                },
                              });
                            }}
                            className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                          />
                          <input
                            type="url"
                            value={rev.sourceUrl}
                            placeholder="Direct Google Maps review source URL (https://maps.google.com/...)"
                            aria-label="Google review source URL"
                            onChange={(e) => {
                              const next = [...(draftClinic.googleReviews?.reviews ?? [])];
                              next[idx] = { ...rev, sourceUrl: e.target.value };
                              setDraftClinic({
                                ...draftClinic,
                                googleReviews: {
                                  placeUrl: draftClinic.googleReviews?.placeUrl ?? '',
                                  reviews: next,
                                },
                              });
                            }}
                            className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void handleResetClinicFile()}
                className="px-3.5 py-2 min-h-[40px] rounded-lg border border-slate-300 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              >
                Reset to Default Clinic File
              </button>
              <button
                type="button"
                disabled={isSavingClinic}
                onClick={() => void handleSaveClinicFile()}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 min-h-[44px] rounded-xl bg-emerald-900 text-white text-sm font-medium hover:bg-emerald-800 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" aria-hidden="true" />
                <span>{isSavingClinic ? 'Saving...' : 'Save Clinic File'}</span>
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
