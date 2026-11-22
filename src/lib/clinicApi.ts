import {
  normalizeClinicData,
  type ChatMessage,
  type ClinicData,
  type LeadEnquiry,
  type LeadStatus,
  type Ticket,
  type TicketStatus,
} from '../types.ts';
import {
  localAddTicketReply,
  localClearDemoLeads,
  localCreateLead,
  localGetAllLeads,
  localGetAllTickets,
  localGetClinicData,
  localGetSessionMessages,
  localHandleChat,
  localResetClinicData,
  localSeedDemoLeads,
  localUpdateClinicData,
  localUpdateLead,
  localUpdateTicketStatus,
} from './localClinicEngine.ts';

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

export async function apiGetClinicData(): Promise<ClinicData> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch('/api/clinic-data');
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
    try {
      const res = await fetch('/api/clinic-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (await isJsonResponse(res)) {
        return normalizeClinicData((await res.json()) as Partial<ClinicData>);
      }
    } catch {
      backendMode = 'static';
    }
  }
  return localUpdateClinicData(payload);
}

export async function apiResetClinicData(): Promise<ClinicData> {
  const hasBackend = await detectBackendAvailable();
  if (hasBackend) {
    try {
      const res = await fetch('/api/clinic-data/reset', { method: 'POST' });
      if (await isJsonResponse(res)) {
        return normalizeClinicData((await res.json()) as Partial<ClinicData>);
      }
    } catch {
      backendMode = 'static';
    }
  }
  return localResetClinicData();
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
        return (await res.json()) as { lead: LeadEnquiry; ticket?: Ticket };
      }
    } catch {
      backendMode = 'static';
    }
  }
  return localCreateLead(input);
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

