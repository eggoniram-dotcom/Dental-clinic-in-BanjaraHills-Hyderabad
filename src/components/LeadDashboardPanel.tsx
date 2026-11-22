import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck,
  Database,
  Download,
  MessageCircle,
  Phone,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  apiClearDemoLeads,
  apiGetLeads,
  apiSeedDemoLeads,
  apiUpdateLead,
} from '../lib/clinicApi.ts';
import { buildWhatsAppLink } from '../lib/clinicCatalog.ts';
import type { ClinicData, LeadEnquiry, LeadStatus } from '../types.ts';

interface LeadDashboardPanelProps {
  clinicData: ClinicData;
}

const LEAD_STATUSES: LeadStatus[] = ['New', 'Contacted', 'Appointment', 'Converted'];

function formatLeadWhatsApp(
  clinicData: ClinicData,
  lead: LeadEnquiry,
  template: 'confirm' | 'remind' | 'feedback',
): string {
  const digits = lead.phone.replace(/\D/g, '');
  const normalized = digits.startsWith('91') ? digits : `91${digits}`;
  let msg = '';
  if (template === 'confirm') {
    msg = `Hello ${lead.patientName}, thank you for contacting ${clinicData.clinicName}, Banjara Hills regarding ${lead.treatment}. We have noted your preferred slot (${lead.preferredDate}${lead.preferredTime ? `, ${lead.preferredTime}` : ''}). Please reply YES to confirm or let us know another convenient time.`;
  } else if (template === 'remind') {
    msg = `Reminder from ${clinicData.clinicName} (Road No. 12, Banjara Hills): Your ${lead.treatment} visit is scheduled for ${lead.preferredDate}${lead.preferredTime ? ` (${lead.preferredTime})` : ''}. Reply here if you need to reschedule at least 24 hours in advance.`;
  } else {
    msg = `Hello ${lead.patientName}, thank you for visiting ${clinicData.clinicName}, Banjara Hills. With your consent, we would appreciate your brief feedback on your visit so we can keep improving patient care.`;
  }
  if (digits.length >= 10) {
    return `https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`;
  }
  return buildWhatsAppLink(clinicData, msg);
}

function getStatusTone(status: LeadStatus): string {
  switch (status) {
    case 'New':
      return 'text-amber-800 font-semibold';
    case 'Contacted':
      return 'text-sky-800 font-semibold';
    case 'Appointment':
      return 'text-emerald-800 font-semibold';
    case 'Converted':
      return 'text-emerald-950 font-bold';
  }
}

export function LeadDashboardPanel({ clinicData }: LeadDashboardPanelProps) {
  const [leads, setLeads] = useState<LeadEnquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    try {
      const list = await apiGetLeads();
      setLeads(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads();
    const timer = window.setInterval(() => void loadLeads(), 4000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'dentistae_leads_v1') {
        void loadLeads();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', onStorage);
    };
  }, [loadLeads]);

  const metrics = useMemo(() => {
    const total = leads.length;
    const appointments = leads.filter(
      (l) => l.status === 'Appointment' || l.status === 'Converted',
    ).length;
    const pendingFollowUp = leads.filter(
      (l) => l.status === 'New' || l.status === 'Contacted',
    ).length;
    const converted = leads.filter((l) => l.status === 'Converted').length;

    const byTreatment = new Map<string, number>();
    for (const lead of leads) {
      byTreatment.set(lead.treatment, (byTreatment.get(lead.treatment) || 0) + 1);
    }
    const topTreatments = [...byTreatment.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    return { total, appointments, pendingFollowUp, converted, topTreatments };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (statusFilter === 'all') return leads;
    return leads.filter((l) => l.status === statusFilter);
  }, [leads, statusFilter]);

  const hasDemoSamples = leads.some((l) => l.source === 'demo-sample');

  const handleStatusChange = async (leadId: string, nextStatus: LeadStatus) => {
    setSavingId(leadId);
    setFeedbackBanner(null);
    try {
      await apiUpdateLead(leadId, { status: nextStatus });
      await loadLeads();
      setFeedbackBanner(`Updated ${leadId} status to ${nextStatus}.`);
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveFollowUp = async (lead: LeadEnquiry) => {
    const note = (noteDrafts[lead.id] ?? lead.followUpNote ?? '').trim();
    setSavingId(lead.id);
    setFeedbackBanner(null);
    try {
      await apiUpdateLead(lead.id, { followUpNote: note });
      await loadLeads();
      setFeedbackBanner(`Saved follow-up note for ${lead.patientName}.`);
    } finally {
      setSavingId(null);
    }
  };

  const handleMarkReminder = async (leadId: string) => {
    await apiUpdateLead(leadId, { reminderSentAt: new Date().toISOString() });
    await loadLeads();
  };

  const handleSeedDemo = async () => {
    const updated = await apiSeedDemoLeads();
    setLeads(updated);
    setFeedbackBanner(
      'Loaded illustrative sample leads for clinic demonstration. Real submissions remain separate.',
    );
  };

  const handleClearDemo = async () => {
    const updated = await apiClearDemoLeads();
    setLeads(updated);
    setFeedbackBanner('Cleared illustrative sample leads.');
  };

  const handleExportCsv = () => {
    const headers = [
      'Lead ID',
      'Patient Name',
      'Phone',
      'Treatment',
      'Preferred Date',
      'Preferred Time',
      'Status',
      'Source',
      'Follow-up Note',
      'Created At',
    ];
    const escapeCell = (val: string | undefined) =>
      `"${(val || '').replace(/"/g, '""')}"`;

    const rows = leads.map((l) =>
      [
        l.id,
        l.patientName,
        l.phone,
        l.treatment,
        l.preferredDate,
        l.preferredTime,
        l.status,
        l.source,
        l.followUpNote,
        l.createdAt,
      ]
        .map(escapeCell)
        .join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dentistae-leads-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-label="Lead management dashboard" className="space-y-5">
      {/* Top Toolbar: Demo Toggle & Google Sheets CSV Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-emerald-950/10 rounded-2xl p-4 sm:p-5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-emerald-950">
            Patient Enquiries &amp; Lead Pipeline
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            Track website enquiries, update conversion stages, send WhatsApp confirmations or
            reminders, and export CSV for Google Sheets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!hasDemoSamples ? (
            <button
              type="button"
              onClick={() => void handleSeedDemo()}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border border-emerald-900/20 bg-emerald-50 text-emerald-950 text-xs font-semibold hover:bg-emerald-100 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Load Sample Demo Data</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleClearDemo()}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear Sample Data</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={leads.length === 0}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-900 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Export CSV (Sheets)</span>
          </button>

          <button
            type="button"
            onClick={() => void loadLeads()}
            aria-label="Refresh leads"
            className="inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* KPI Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-white border border-emerald-950/10 p-4 sm:p-5">
          <p className="text-xs text-slate-500">Total Enquiries</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-emerald-950 tabular-nums">
            {metrics.total}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {hasDemoSamples ? 'Includes illustrative sample rows' : 'Live captured enquiries'}
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-emerald-950/10 p-4 sm:p-5">
          <p className="text-xs text-slate-500">Appointments Booked</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-emerald-900 tabular-nums">
            {metrics.appointments}
          </p>
          <p className="mt-1 text-xs text-slate-500">Scheduled &amp; converted visits</p>
        </div>

        <div className="rounded-2xl bg-white border border-emerald-950/10 p-4 sm:p-5">
          <p className="text-xs text-slate-500">Pending Follow-Ups</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-amber-800 tabular-nums">
            {metrics.pendingFollowUp}
          </p>
          <p className="mt-1 text-xs text-slate-500">New or awaiting confirmation</p>
        </div>

        <div className="rounded-2xl bg-white border border-emerald-950/10 p-4 sm:p-5">
          <p className="text-xs text-slate-500">Converted Patients</p>
          <p className="mt-1 text-2xl sm:text-3xl font-bold text-emerald-950 tabular-nums">
            {metrics.converted}
          </p>
          <p className="mt-1 text-xs text-slate-500">Completed consultation / treatment</p>
        </div>
      </div>

      {/* Treatment Demand Breakdown */}
      {metrics.topTreatments.length > 0 && (
        <div className="rounded-2xl bg-white border border-emerald-950/10 p-4 sm:p-5">
          <p className="text-xs font-semibold text-slate-500">
            Top Enquired Treatments
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics.topTreatments.map(([name, count]) => (
              <div
                key={name}
                className="flex items-center justify-between gap-2 border-b sm:border-b-0 sm:border-r last:border-0 border-slate-100 pb-2 sm:pb-0 sm:pr-4"
              >
                <span className="text-xs sm:text-sm font-medium text-slate-800 truncate">
                  {name}
                </span>
                <span className="text-sm font-bold text-emerald-900 tabular-nums shrink-0">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {feedbackBanner && (
        <div
          role="status"
          className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-medium text-emerald-900"
        >
          {feedbackBanner}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit overflow-x-auto max-w-full">
        {(['all', ...LEAD_STATUSES] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 min-h-[38px] rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              statusFilter === st
                ? 'bg-white text-emerald-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {st === 'all' ? `All (${leads.length})` : st}
          </button>
        ))}
      </div>

      {/* Lead Cards List */}
      {loading ? (
        <div className="rounded-2xl bg-white border border-emerald-950/10 p-8 text-center text-sm text-slate-500">
          Loading patient enquiries...
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="rounded-2xl bg-white border border-emerald-950/10 p-8 text-center space-y-3">
          <CalendarCheck className="w-8 h-8 text-emerald-800/60 mx-auto" aria-hidden="true" />
          <p className="text-sm font-semibold text-emerald-950">No enquiries in this view yet</p>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            Submit an appointment enquiry on the homepage or treatment pages to see real leads
            appear here, or click “Load Sample Demo Data” above for a clinic presentation.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLeads.map((lead) => {
            const draftNote = noteDrafts[lead.id] ?? lead.followUpNote ?? '';
            return (
              <article
                key={lead.id}
                className="rounded-2xl bg-white border border-emerald-950/10 p-4 sm:p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                      <span className="font-mono font-medium text-slate-700">{lead.id}</span>
                      <span aria-hidden="true">·</span>
                      <span className={getStatusTone(lead.status)}>{lead.status}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {lead.source === 'demo-sample'
                          ? 'Illustrative Demo Row'
                          : lead.source === 'treatment-page'
                            ? 'Treatment Page Enquiry'
                            : 'Website Appointment Form'}
                      </span>
                      {lead.ticketId && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">Ticket {lead.ticketId}</span>
                        </>
                      )}
                    </div>

                    <h3 className="mt-1.5 text-base font-bold text-emerald-950">
                      {lead.patientName}
                    </h3>

                    <p className="mt-1 text-sm text-slate-700">
                      <span className="font-medium text-slate-900">{lead.treatment}</span>
                      <span className="mx-2 text-slate-300">|</span>
                      <span className="tabular-nums">
                        Preferred: {lead.preferredDate}
                        {lead.preferredTime ? ` (${lead.preferredTime})` : ''}
                      </span>
                    </p>

                    <p className="mt-1 text-xs text-slate-600 tabular-nums">
                      Phone:{' '}
                      <a
                        href={`tel:${lead.phone.replace(/\s+/g, '')}`}
                        className="font-medium text-emerald-900 hover:underline"
                      >
                        {lead.phone}
                      </a>
                    </p>

                    {lead.message && (
                      <p className="mt-2 text-xs text-slate-600 bg-stone-50 border border-slate-100 rounded-lg px-3 py-2">
                        {lead.message}
                      </p>
                    )}
                  </div>

                  {/* Status Switcher */}
                  <div className="shrink-0 flex flex-col items-start sm:items-end gap-2">
                    <label className="text-[11px] font-medium text-slate-500">
                      Lead Stage
                      <select
                        value={lead.status}
                        disabled={savingId === lead.id}
                        onChange={(e) =>
                          void handleStatusChange(lead.id, e.target.value as LeadStatus)
                        }
                        className="mt-1 block h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                      >
                        {LEAD_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>

                {/* Follow-Up Notes & WhatsApp Automation Actions */}
                <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={draftNote}
                      onChange={(e) =>
                        setNoteDrafts((prev) => ({ ...prev, [lead.id]: e.target.value }))
                      }
                      placeholder="Add follow-up note or next callback time..."
                      aria-label={`Follow-up note for ${lead.patientName}`}
                      className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-slate-200 bg-stone-50/70 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    />
                    <button
                      type="button"
                      disabled={savingId === lead.id}
                      onClick={() => void handleSaveFollowUp(lead)}
                      className="h-10 px-3.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Save Note
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <a
                      href={`tel:${lead.phone.replace(/\s+/g, '')}`}
                      className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:text-emerald-950 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Call</span>
                    </a>
                    <a
                      href={formatLeadWhatsApp(clinicData, lead, 'confirm')}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => void handleMarkReminder(lead.id)}
                      className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-900/15 text-xs font-semibold text-emerald-950 hover:bg-emerald-100 whitespace-nowrap"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                      <span>WhatsApp Confirm</span>
                    </a>
                    <a
                      href={formatLeadWhatsApp(clinicData, lead, 'remind')}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => void handleMarkReminder(lead.id)}
                      className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-emerald-50 whitespace-nowrap"
                    >
                      <span>Send Reminder</span>
                    </a>
                    <a
                      href={formatLeadWhatsApp(clinicData, lead, 'feedback')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-emerald-50 whitespace-nowrap"
                    >
                      <span>Ask Feedback</span>
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
