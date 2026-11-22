import fs from 'fs';
import path from 'path';
import { DEFAULT_CLINIC_DATA } from './defaultClinicData.ts';
import type {
  ChatMessage,
  ClinicData,
  LeadEnquiry,
  LeadStatus,
  Ticket,
  TicketStatus,
} from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CLINIC_FILE_PATH = path.join(DATA_DIR, 'clinic-data.json');
const TICKETS_FILE_PATH = path.join(DATA_DIR, 'tickets.json');
const SESSIONS_FILE_PATH = path.join(DATA_DIR, 'sessions.json');
const LEADS_FILE_PATH = path.join(DATA_DIR, 'leads.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as T;
    }
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error);
  }
  return fallback;
}

function writeJsonFile(filePath: string, data: unknown): void {
  ensureDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

let clinicDataCache: ClinicData | null = null;
let ticketsCache: Ticket[] | null = null;
let sessionsCache: Record<string, ChatMessage[]> | null = null;
let leadsCache: LeadEnquiry[] | null = null;

export function normalizeClinicData(input: Partial<ClinicData> | null | undefined): ClinicData {
  const base = structuredClone(DEFAULT_CLINIC_DATA);
  if (!input || typeof input !== 'object') {
    return base;
  }
  return {
    clinicName: typeof input.clinicName === 'string' && input.clinicName.trim() ? input.clinicName : base.clinicName,
    tagline: typeof input.tagline === 'string' ? input.tagline : base.tagline,
    address: typeof input.address === 'string' ? input.address : base.address,
    landmark: typeof input.landmark === 'string' ? input.landmark : base.landmark,
    phone: typeof input.phone === 'string' ? input.phone : base.phone,
    emergencyPhone: typeof input.emergencyPhone === 'string' ? input.emergencyPhone : base.emergencyPhone,
    email: typeof input.email === 'string' ? input.email : base.email,
    timings: {
      weekdays: typeof input.timings?.weekdays === 'string' ? input.timings.weekdays : base.timings.weekdays,
      sunday: typeof input.timings?.sunday === 'string' ? input.timings.sunday : base.timings.sunday,
      lunchBreak: typeof input.timings?.lunchBreak === 'string' ? input.timings.lunchBreak : base.timings.lunchBreak,
    },
    doctors: Array.isArray(input.doctors)
      ? input.doctors.map((doc) => {
          const fallbackDoc = base.doctors.find((d) => d.id === doc.id);
          return {
            ...doc,
            registrationNumber:
              typeof doc.registrationNumber === 'string' && doc.registrationNumber.trim()
                ? doc.registrationNumber
                : fallbackDoc?.registrationNumber || '',
            expertise:
              Array.isArray(doc.expertise) && doc.expertise.length > 0
                ? doc.expertise
                : fallbackDoc?.expertise || [],
          };
        })
      : base.doctors,
    services: Array.isArray(input.services) ? input.services : base.services,
    policies: Array.isArray(input.policies) ? input.policies : base.policies,
    insurance: {
      summary: typeof input.insurance?.summary === 'string' ? input.insurance.summary : base.insurance.summary,
      partners: Array.isArray(input.insurance?.partners) ? input.insurance.partners : base.insurance.partners,
    },
    parkingAndAccess: typeof input.parkingAndAccess === 'string' ? input.parkingAndAccess : base.parkingAndAccess,
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : new Date().toISOString(),
  };
}

export function getClinicData(): ClinicData {
  if (!clinicDataCache) {
    ensureDataDir();
    if (!fs.existsSync(CLINIC_FILE_PATH)) {
      clinicDataCache = structuredClone(DEFAULT_CLINIC_DATA);
      writeJsonFile(CLINIC_FILE_PATH, clinicDataCache);
    } else {
      const loaded = readJsonFile<Partial<ClinicData>>(
        CLINIC_FILE_PATH,
        structuredClone(DEFAULT_CLINIC_DATA),
      );
      clinicDataCache = normalizeClinicData(loaded);
    }
  }
  return clinicDataCache;
}

export function updateClinicData(next: Partial<ClinicData>): ClinicData {
  const updated: ClinicData = {
    ...normalizeClinicData(next),
    updatedAt: new Date().toISOString(),
  };
  clinicDataCache = updated;
  writeJsonFile(CLINIC_FILE_PATH, updated);
  return updated;
}

export function resetClinicData(): ClinicData {
  const fresh: ClinicData = {
    ...structuredClone(DEFAULT_CLINIC_DATA),
    updatedAt: new Date().toISOString(),
  };
  clinicDataCache = fresh;
  writeJsonFile(CLINIC_FILE_PATH, fresh);
  return fresh;
}

function loadTickets(): Ticket[] {
  if (!ticketsCache) {
    ensureDataDir();
    ticketsCache = readJsonFile<Ticket[]>(TICKETS_FILE_PATH, []);
  }
  return ticketsCache;
}

function saveTickets(tickets: Ticket[]): void {
  ticketsCache = tickets;
  writeJsonFile(TICKETS_FILE_PATH, tickets);
}

function loadSessions(): Record<string, ChatMessage[]> {
  if (!sessionsCache) {
    ensureDataDir();
    sessionsCache = readJsonFile<Record<string, ChatMessage[]>>(SESSIONS_FILE_PATH, {});
  }
  return sessionsCache;
}

function saveSessions(sessions: Record<string, ChatMessage[]>): void {
  sessionsCache = sessions;
  writeJsonFile(SESSIONS_FILE_PATH, sessions);
}

export function getSessionMessages(sessionId: string): ChatMessage[] {
  const sessions = loadSessions();
  return sessions[sessionId] ?? [];
}

export function appendSessionMessage(message: ChatMessage): ChatMessage[] {
  const sessions = loadSessions();
  const list = sessions[message.sessionId] ?? [];
  list.push(message);
  sessions[message.sessionId] = list;
  saveSessions(sessions);
  return list;
}

const PRIORITY_WEIGHT: Record<TicketStatus, number> = {
  urgent: 0,
  'needs human': 1,
  answered: 2,
  closed: 3,
};

export function getAllTickets(): Ticket[] {
  const tickets = loadTickets();
  return [...tickets].sort((a, b) => {
    const pDiff = PRIORITY_WEIGHT[a.status] - PRIORITY_WEIGHT[b.status];
    if (pDiff !== 0) return pDiff;
    // Open tickets: oldest first (highest ageing priority); resolved: newest first
    if (a.status === 'urgent' || a.status === 'needs human') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function createTicket(input: {
  sessionId: string;
  patientName?: string;
  question: string;
  status: TicketStatus;
  category: Ticket['category'];
  bookingTime?: string;
}): Ticket {
  const tickets = loadTickets();
  const now = new Date().toISOString();
  const ticket: Ticket = {
    id: `TKT-${String(tickets.length + 101)}`,
    sessionId: input.sessionId,
    patientName: input.patientName?.trim() || 'Patient',
    question: input.question,
    status: input.status,
    category: input.category,
    bookingTime: input.bookingTime,
    createdAt: now,
    updatedAt: now,
    replies: [],
  };
  tickets.push(ticket);
  saveTickets(tickets);
  return ticket;
}

export function addTicketReply(
  ticketId: string,
  replyText: string,
  nextStatus: TicketStatus = 'answered',
): { ticket: Ticket; messages: ChatMessage[] } | null {
  const tickets = loadTickets();
  const index = tickets.findIndex((t) => t.id === ticketId);
  if (index === -1) return null;

  const now = new Date().toISOString();
  const ticket = tickets[index];
  ticket.replies.push({
    id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sender: 'staff',
    text: replyText.trim(),
    timestamp: now,
  });
  ticket.status = nextStatus;
  ticket.updatedAt = now;
  tickets[index] = ticket;
  saveTickets(tickets);

  const messages = appendSessionMessage({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sessionId: ticket.sessionId,
    sender: 'staff',
    text: replyText.trim(),
    timestamp: now,
    ticketId: ticket.id,
  });

  return { ticket, messages };
}

export function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
): Ticket | null {
  const tickets = loadTickets();
  const index = tickets.findIndex((t) => t.id === ticketId);
  if (index === -1) return null;
  tickets[index].status = status;
  tickets[index].updatedAt = new Date().toISOString();
  saveTickets(tickets);
  return tickets[index];
}

function loadLeads(): LeadEnquiry[] {
  if (!leadsCache) {
    ensureDataDir();
    leadsCache = readJsonFile<LeadEnquiry[]>(LEADS_FILE_PATH, []);
  }
  return leadsCache;
}

function saveLeads(leads: LeadEnquiry[]): void {
  leadsCache = leads;
  writeJsonFile(LEADS_FILE_PATH, leads);
}

export function getAllLeads(): LeadEnquiry[] {
  const leads = loadLeads();
  return [...leads].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function createLead(input: {
  patientName: string;
  phone: string;
  treatment: string;
  preferredDate: string;
  preferredTime?: string;
  message?: string;
  source?: LeadEnquiry['source'];
}): { lead: LeadEnquiry; ticket: Ticket } {
  const leads = loadLeads();
  const now = new Date().toISOString();
  const bookingSlot = [input.preferredDate, input.preferredTime]
    .filter(Boolean)
    .join(' · ');

  const ticket = createTicket({
    sessionId: `lead-${Date.now()}`,
    patientName: input.patientName.trim(),
    question: `Appointment enquiry for ${input.treatment} (${bookingSlot || 'Date TBC'}). Phone: ${input.phone.trim()}${input.message?.trim() ? ` — Note: ${input.message.trim()}` : ''}`,
    status: 'needs human',
    category: 'booking',
    bookingTime: bookingSlot || 'Callback requested',
  });

  const lead: LeadEnquiry = {
    id: `LD-${String(leads.length + 201)}`,
    patientName: input.patientName.trim(),
    phone: input.phone.trim(),
    treatment: input.treatment.trim(),
    preferredDate: input.preferredDate.trim(),
    preferredTime: input.preferredTime?.trim() || undefined,
    message: input.message?.trim() || undefined,
    source: input.source || 'appointment-form',
    status: 'New',
    ticketId: ticket.id,
    createdAt: now,
    updatedAt: now,
  };

  leads.push(lead);
  saveLeads(leads);
  return { lead, ticket };
}

export function updateLead(
  leadId: string,
  patch: {
    status?: LeadStatus;
    followUpNote?: string;
    followUpDate?: string;
    reminderSentAt?: string;
  },
): LeadEnquiry | null {
  const leads = loadLeads();
  const idx = leads.findIndex((l) => l.id === leadId);
  if (idx === -1) return null;

  const current = leads[idx];
  const updated: LeadEnquiry = {
    ...current,
    status: patch.status ?? current.status,
    followUpNote:
      patch.followUpNote !== undefined ? patch.followUpNote : current.followUpNote,
    followUpDate:
      patch.followUpDate !== undefined ? patch.followUpDate : current.followUpDate,
    reminderSentAt:
      patch.reminderSentAt !== undefined
        ? patch.reminderSentAt
        : current.reminderSentAt,
    updatedAt: new Date().toISOString(),
  };

  leads[idx] = updated;
  saveLeads(leads);
  return updated;
}

export function seedDemoLeads(): LeadEnquiry[] {
  const leads = loadLeads();
  const hasDemo = leads.some((l) => l.source === 'demo-sample');
  if (hasDemo) return getAllLeads();

  const now = Date.now();
  const tomorrow = new Date(now + 86400000).toISOString().slice(0, 10);
  const inTwoDays = new Date(now + 2 * 86400000).toISOString().slice(0, 10);

  const samples: LeadEnquiry[] = [
    {
      id: 'LD-DEMO-1',
      patientName: 'Demo Patient 1 (Illustrative)',
      phone: '+91 98490 00001',
      treatment: 'Titanium Dental Implant (Fixture)',
      preferredDate: tomorrow,
      preferredTime: '11:30 AM',
      message: 'Sample enquiry for single molar implant consultation.',
      source: 'demo-sample',
      status: 'Appointment',
      followUpNote: 'Confirmed slot with Dr. Vikramaditya Rao.',
      followUpDate: tomorrow,
      createdAt: new Date(now - 3 * 3600000).toISOString(),
      updatedAt: new Date(now - 2 * 3600000).toISOString(),
    },
    {
      id: 'LD-DEMO-2',
      patientName: 'Demo Patient 2 (Illustrative)',
      phone: '+91 98490 00002',
      treatment: 'Root Canal Treatment (RCT)',
      preferredDate: tomorrow,
      preferredTime: '4:30 PM',
      message: 'Sample enquiry asking about single-sitting RCT availability.',
      source: 'demo-sample',
      status: 'New',
      followUpNote: 'Call back within 2 working hours.',
      followUpDate: tomorrow,
      createdAt: new Date(now - 90 * 60000).toISOString(),
      updatedAt: new Date(now - 90 * 60000).toISOString(),
    },
    {
      id: 'LD-DEMO-3',
      patientName: 'Demo Patient 3 (Illustrative)',
      phone: '+91 98490 00003',
      treatment: 'In-Office Teeth Whitening',
      preferredDate: inTwoDays,
      preferredTime: '6:00 PM',
      message: 'Sample enquiry before a family wedding.',
      source: 'demo-sample',
      status: 'Contacted',
      followUpNote: 'Shared published tariff on WhatsApp; awaiting slot confirmation.',
      followUpDate: tomorrow,
      createdAt: new Date(now - 26 * 3600000).toISOString(),
      updatedAt: new Date(now - 6 * 3600000).toISOString(),
    },
    {
      id: 'LD-DEMO-4',
      patientName: 'Demo Patient 4 (Illustrative)',
      phone: '+91 98490 00004',
      treatment: 'Clear Aligners',
      preferredDate: inTwoDays,
      preferredTime: '3:00 PM',
      message: 'Sample enquiry for 3D aligner scan.',
      source: 'demo-sample',
      status: 'Converted',
      followUpNote: 'Completed consultation & 3D scan with Dr. Karthikeya Sharma.',
      createdAt: new Date(now - 52 * 3600000).toISOString(),
      updatedAt: new Date(now - 12 * 3600000).toISOString(),
    },
  ];

  saveLeads([...samples, ...leads]);
  return getAllLeads();
}

export function clearDemoLeads(): LeadEnquiry[] {
  const filtered = loadLeads().filter((l) => l.source !== 'demo-sample');
  saveLeads(filtered);
  return getAllLeads();
}

