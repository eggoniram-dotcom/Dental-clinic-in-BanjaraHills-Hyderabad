import {
  normalizeClinicData,
  type ChatMessage,
  type ClinicData,
  type LeadEnquiry,
  type LeadStatus,
  type ReceptionistNotification,
  type Ticket,
  type TicketStatus,
} from '../types.ts';
import {
  localAddTicketReply,
  localCaptureWhatsAppEnquiry,
  localClearDemoLeads,
  localCreateLead,
  localGetAllLeads,
  localGetAllNotifications,
  localGetAllTickets,
  localGetClinicData,
  localGetSessionMessages,
  localHandleChat,
  localMarkAllNotificationsRead,
  localMarkNotificationRead,
  localResetClinicData,
  localSeedDemoLeads,
  localUpdateClinicData,
  localUpdateLead,
  localUpdateTicketStatus,
} from './localClinicEngine.ts';

function notifyReceptionistBadge(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dentistae:notifications-updated'));
  }
}

let backendMode: 'unknown' | 'server' | 'static' = 'unknown';
let probePromise: Promise<boolean> | null = null;

async function isJsonResponse(res: Response): Promise<boolean> {
  const ct = res.headers.get('content-type') || '';
  return res.ok && ct.includes('application/json');
}

export async function detectBackendAvailable(): Promise<boolean> {
  if (backendMode === 'server') return true;
  if (backendMode === 'static') return false;
  if (!probePromise) {
    probePromise = (async () => {
      try {
        const res = await fetch('/api/health', { method: 'GET' });
        if (await isJsonResponse(res)) {
          const body = (await res.json()) as { ok?: boolean };
          if (body && body.ok === true) {
            backendMode = 'server';
            return true;
          }
        }
      } catch {
        // Network error -> static mode
      }
      backendMode = 'static';
      return false;
    })();
  }
  return probePromise;
}

function notifyClinicDataUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dentistae:clinic-data-updated'));
  }
}

export async function apiGetClinicData(): Promise<ClinicData> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch('/api/clinic-data', { cache: 'no-store' });
      if (await isJsonResponse(res)) {
        const data = (await res.json()) as Partial<ClinicData>;
        return normalizeClinicData(data);
      }
    } catch {
      backendMode = 'static';
    }
  }
  return localGetClinicData();
}

export async function apiUpdateClinicData(payload: Partial<ClinicData>): Promise<ClinicData> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    let lastErrorMessage: string | null = null;
    for (const method of ['PUT', 'POST'] as const) {
      try {
        const res = await fetch('/api/clinic-data', {
          method,
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (await isJsonResponse(res)) {
          const saved = normalizeClinicData((await res.json()) as Partial<ClinicData>);
          localUpdateClinicData(saved);
          notifyClinicDataUpdated();
          return saved;
        }
        // If server returned a real 4xx/5xx JSON error, capture it instead of silently swallowing
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
          lastErrorMessage = errBody?.error || `Server error (${res.status}) while saving clinic file.`;
          if (res.status !== 405) {
            throw new Error(lastErrorMessage);
          }
        } else if (res.status !== 405 && res.status !== 404) {
          lastErrorMessage = `Server returned status ${res.status} while saving clinic file.`;
        }
      } catch (err) {
        if (err instanceof Error && lastErrorMessage && err.message === lastErrorMessage) {
          throw err;
        }
        if (method === 'POST') {
          backendMode = 'static';
        }
      }
    }
    if (lastErrorMessage) {
      throw new Error(lastErrorMessage);
    }
  }
  const localSaved = localUpdateClinicData(payload);
  notifyClinicDataUpdated();
  return localSaved;
}

export async function apiResetClinicData(): Promise<ClinicData> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch('/api/clinic-data/reset', {
        method: 'POST',
        cache: 'no-store',
      });
      if (await isJsonResponse(res)) {
        const reset = normalizeClinicData((await res.json()) as Partial<ClinicData>);
        localUpdateClinicData(reset);
        notifyClinicDataUpdated();
        return reset;
      }
    } catch {
      backendMode = 'static';
    }
  }
  const localReset = localResetClinicData();
  notifyClinicDataUpdated();
  return localReset;
}

export async function apiGetSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}`);
      if (await isJsonResponse(res)) {
        const data = (await res.json()) as { messages?: ChatMessage[] };
        if (Array.isArray(data.messages)) {
          return data.messages;
        }
      }
    } catch {
      backendMode = 'static';
    }
  }
  return localGetSessionMessages(sessionId);
}

export async function apiSendChatMessage(params: {
  sessionId: string;
  message: string;
}): Promise<{ sessionId: string; messages: ChatMessage[] }> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (await isJsonResponse(res)) {
        const data = (await res.json()) as {
          sessionId: string;
          messages: ChatMessage[];
        };
        if (Array.isArray(data.messages)) {
          return data;
        }
      }
    } catch {
      backendMode = 'static';
    }
  }
  const localRes = localHandleChat(params.sessionId, params.message);
  return { sessionId: localRes.sessionId, messages: localRes.messages };
}

export async function apiGetTickets(): Promise<Ticket[]> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch('/api/tickets');
      if (await isJsonResponse(res)) {
        const data = (await res.json()) as { tickets?: Ticket[] };
        if (Array.isArray(data.tickets)) {
          return data.tickets;
        }
      }
    } catch {
      backendMode = 'static';
    }
  }
  return localGetAllTickets();
}

export async function apiReplyToTicket(
  ticketId: string,
  reply: string,
  status: TicketStatus = 'answered',
): Promise<boolean> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply, status }),
      });
      if (await isJsonResponse(res)) {
        return true;
      }
    } catch {
      backendMode = 'static';
    }
  }
  return Boolean(localAddTicketReply(ticketId, reply, status));
}

export async function apiUpdateTicketStatus(
  ticketId: string,
  status: TicketStatus,
): Promise<boolean> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (await isJsonResponse(res)) {
        return true;
      }
    } catch {
      backendMode = 'static';
    }
  }
  return Boolean(localUpdateTicketStatus(ticketId, status));
}

export async function apiGetLeads(): Promise<LeadEnquiry[]> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch('/api/leads');
      if (await isJsonResponse(res)) {
        const data = (await res.json()) as { leads?: LeadEnquiry[] };
        if (Array.isArray(data.leads)) {
          return data.leads;
        }
      }
    } catch {
      backendMode = 'static';
    }
  }
  return localGetAllLeads();
}

export async function apiCreateLead(input: {
  patientName: string;
  phone: string;
  treatment: string;
  preferredDate: string;
  preferredTime?: string;
  message?: string;
  source?: 'appointment-form' | 'treatment-page' | 'chat-booking';
}): Promise<{ lead: LeadEnquiry; ticket?: Ticket }> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (await isJsonResponse(res)) {
        const created = (await res.json()) as { lead: LeadEnquiry; ticket?: Ticket };
        notifyReceptionistBadge();
        return created;
      }
    } catch {
      backendMode = 'static';
    }
  }
  const localCreated = localCreateLead(input);
  notifyReceptionistBadge();
  return localCreated;
}

export async function apiUpdateLead(
  leadId: string,
  patch: {
    status?: LeadStatus;
    followUpNote?: string;
    followUpDate?: string;
    reminderSentAt?: string;
  },
): Promise<LeadEnquiry | null> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch(`/api/leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (await isJsonResponse(res)) {
        const data = (await res.json()) as { lead?: LeadEnquiry };
        return data.lead ?? null;
      }
    } catch {
      backendMode = 'static';
    }
  }
  return localUpdateLead(leadId, patch);
}

export async function apiSeedDemoLeads(): Promise<LeadEnquiry[]> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch('/api/leads/seed-demo', { method: 'POST' });
      if (await isJsonResponse(res)) {
        const data = (await res.json()) as { leads?: LeadEnquiry[] };
        if (Array.isArray(data.leads)) {
          return data.leads;
        }
      }
    } catch {
      backendMode = 'static';
    }
  }
  return localSeedDemoLeads();
}

export async function apiClearDemoLeads(): Promise<LeadEnquiry[]> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch('/api/leads/demo', { method: 'DELETE' });
      if (await isJsonResponse(res)) {
        const data = (await res.json()) as { leads?: LeadEnquiry[] };
        if (Array.isArray(data.leads)) {
          return data.leads;
        }
      }
    } catch {
      backendMode = 'static';
    }
  }
  return localClearDemoLeads();
}

export async function apiCaptureWhatsAppEnquiry(input: {
  treatment?: string;
  sourcePage?: string;
  prefilledMessage: string;
  patientName?: string;
  phone?: string;
}): Promise<{
  lead: LeadEnquiry;
  ticket: Ticket;
  notification: ReceptionistNotification;
}> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch('/api/whatsapp-enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (await isJsonResponse(res)) {
        const data = (await res.json()) as {
          lead: LeadEnquiry;
          ticket: Ticket;
          notification: ReceptionistNotification;
        };
        notifyReceptionistBadge();
        return data;
      }
    } catch {
      backendMode = 'static';
    }
  }
  const localData = localCaptureWhatsAppEnquiry(input);
  notifyReceptionistBadge();
  return localData;
}

export async function apiGetNotifications(): Promise<ReceptionistNotification[]> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch('/api/notifications');
      if (await isJsonResponse(res)) {
        const data = (await res.json()) as { notifications?: ReceptionistNotification[] };
        if (Array.isArray(data.notifications)) {
          return data.notifications;
        }
      }
    } catch {
      backendMode = 'static';
    }
  }
  return localGetAllNotifications();
}

export async function apiMarkNotificationRead(
  id: string,
): Promise<ReceptionistNotification | null> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
        method: 'PATCH',
      });
      if (await isJsonResponse(res)) {
        const data = (await res.json()) as { notification?: ReceptionistNotification };
        notifyReceptionistBadge();
        return data.notification ?? null;
      }
    } catch {
      backendMode = 'static';
    }
  }
  const localRes = localMarkNotificationRead(id);
  notifyReceptionistBadge();
  return localRes;
}

export async function apiMarkAllNotificationsRead(): Promise<ReceptionistNotification[]> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch('/api/notifications/read-all', { method: 'POST' });
      if (await isJsonResponse(res)) {
        const data = (await res.json()) as { notifications?: ReceptionistNotification[] };
        notifyReceptionistBadge();
        if (Array.isArray(data.notifications)) {
          return data.notifications;
        }
      }
    } catch {
      backendMode = 'static';
    }
  }
  const localRes = localMarkAllNotificationsRead();
  notifyReceptionistBadge();
  return localRes;
}

