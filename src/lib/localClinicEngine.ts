import {
  normalizeClinicData,
  type ChatMessage,
  type ClinicData,
  type LanguageCode,
  type LeadEnquiry,
  type LeadStatus,
  type ReceptionistNotification,
  type Ticket,
  type TicketStatus,
} from '../types.ts';
import { DEFAULT_CLINIC_DATA } from './defaultClinicData.ts';

const LS_CLINIC_KEY = 'dentistae_clinic_data_v1';
const LS_TICKETS_KEY = 'dentistae_tickets_v1';
const LS_SESSIONS_KEY = 'dentistae_sessions_v1';
const LS_LEADS_KEY = 'dentistae_leads_v1';
const LS_NOTIFICATIONS_KEY = 'dentistae_notifications_v1';

const PRIORITY_WEIGHT: Record<TicketStatus, number> = {
  urgent: 0,
  'needs human': 1,
  answered: 2,
  closed: 3,
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function localGetClinicData(): ClinicData {
  const stored = readStorage<Partial<ClinicData> | null>(LS_CLINIC_KEY, null);
  if (!stored) {
    const fresh = normalizeClinicData(DEFAULT_CLINIC_DATA);
    writeStorage(LS_CLINIC_KEY, fresh);
    return fresh;
  }
  return normalizeClinicData(stored);
}

export function localUpdateClinicData(next: Partial<ClinicData>): ClinicData {
  const updated: ClinicData = {
    ...normalizeClinicData(next),
    updatedAt: new Date().toISOString(),
  };
  writeStorage(LS_CLINIC_KEY, updated);
  return updated;
}

export function localResetClinicData(): ClinicData {
  const fresh: ClinicData = {
    ...normalizeClinicData(DEFAULT_CLINIC_DATA),
    updatedAt: new Date().toISOString(),
  };
  writeStorage(LS_CLINIC_KEY, fresh);
  return fresh;
}

export function localGetSessionMessages(sessionId: string): ChatMessage[] {
  const sessions = readStorage<Record<string, ChatMessage[]>>(LS_SESSIONS_KEY, {});
  return sessions[sessionId] ?? [];
}

function localAppendSessionMessage(message: ChatMessage): ChatMessage[] {
  const sessions = readStorage<Record<string, ChatMessage[]>>(LS_SESSIONS_KEY, {});
  const list = sessions[message.sessionId] ?? [];
  list.push(message);
  sessions[message.sessionId] = list;
  writeStorage(LS_SESSIONS_KEY, sessions);
  return list;
}

export function localGetAllTickets(): Ticket[] {
  const tickets = readStorage<Ticket[]>(LS_TICKETS_KEY, []);
  return [...tickets].sort((a, b) => {
    const pDiff = PRIORITY_WEIGHT[a.status] - PRIORITY_WEIGHT[b.status];
    if (pDiff !== 0) return pDiff;
    if (a.status === 'urgent' || a.status === 'needs human') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function localCreateTicket(input: {
  sessionId: string;
  patientName?: string;
  question: string;
  status: TicketStatus;
  category: Ticket['category'];
  bookingTime?: string;
}): Ticket {
  const tickets = readStorage<Ticket[]>(LS_TICKETS_KEY, []);
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
  writeStorage(LS_TICKETS_KEY, tickets);
  return ticket;
}

export function localAddTicketReply(
  ticketId: string,
  replyText: string,
  nextStatus: TicketStatus = 'answered',
): { ticket: Ticket; messages: ChatMessage[] } | null {
  const tickets = readStorage<Ticket[]>(LS_TICKETS_KEY, []);
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
  writeStorage(LS_TICKETS_KEY, tickets);

  const messages = localAppendSessionMessage({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sessionId: ticket.sessionId,
    sender: 'staff',
    text: replyText.trim(),
    timestamp: now,
    ticketId: ticket.id,
  });

  return { ticket, messages };
}

export function localUpdateTicketStatus(
  ticketId: string,
  status: TicketStatus,
): Ticket | null {
  const tickets = readStorage<Ticket[]>(LS_TICKETS_KEY, []);
  const index = tickets.findIndex((t) => t.id === ticketId);
  if (index === -1) return null;
  tickets[index].status = status;
  tickets[index].updatedAt = new Date().toISOString();
  writeStorage(LS_TICKETS_KEY, tickets);
  return tickets[index];
}

function detectLanguage(text: string): LanguageCode {
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  const lower = text.toLowerCase();
  const teluguHints = [
    'entha',
    'eppudu',
    'ekkada',
    'ekada',
    'evaru',
    'enti',
    'ela',
    'meeku',
    'meeru',
    'noppi',
    'pallu',
    'raktham',
    'vapu',
    'cheppandi',
    'kavali',
    'samayam',
    'namaskaram',
    'telugu',
    'repu',
    'ivvala',
    'mandulu',
    'udhayam',
    'udayam',
    'sayantram',
    'madhyahnam',
    'gantalaku',
  ];
  const hindiHints = [
    'kitna',
    'kharch',
    'paisa',
    'daant',
    'dant',
    'dard',
    'sujan',
    'khoon',
    'batao',
    'bataiye',
    'chahiye',
    'samay',
    'kahan',
    'khulta',
    'khula',
    'band',
    'namaste',
    'kal subah',
    'kal shaam',
    'aaj',
    'subah',
    'shaam',
    'baje',
    'dawai',
    'hindi',
    'aapka',
    'kaise',
    'chhutti',
  ];
  if (teluguHints.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(lower))) return 'te';
  if (hindiHints.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(lower))) return 'hi';
  return 'en';
}

function isRuleOverrideOrDiscountDemand(text: string): boolean {
  const lower = text.toLowerCase();
  const overridePatterns = [
    /ignore\s+(all\s+)?(your\s+|previous\s+)?(rules|instructions|guidelines|system)/i,
    /forget\s+(all\s+)?(your\s+|previous\s+)?(rules|instructions|guidelines)/i,
    /disregard\s+(all\s+)?(your\s+)?(rules|instructions)/i,
    /override\s+(your\s+)?(rules|policy|policies)/i,
    /bypass\s+(your\s+)?(rules|policy)/i,
    /system\s*prompt/i,
    /jailbreak/i,
    /you\s+are\s+now\s+/i,
    /pretend\s+you\s+(can|are)/i,
  ];
  if (overridePatterns.some((p) => p.test(lower))) return true;
  const discountDemandPatterns = [
    /promise\s+(me\s+)?(a\s+)?discount/i,
    /give\s+(me\s+)?(a\s+)?(\d+%?\s*)?discount/i,
    /\b\d+%\s*(off|discount)\b/i,
    /special\s+discount/i,
    /waive\s+(the\s+)?fee/i,
    /free\s+(root\s+canal|cleaning|scaling|implant|treatment|filling|crown)/i,
    /reduce\s+(the\s+)?(price|cost|fee|charges)/i,
    /discount\s+(milega|de\s+do|isthara|kavali|please)/i,
    /can\s+i\s+get\s+(a\s+)?discount/i,
    /any\s+discount/i,
    /offer\s+(a\s+)?discount/i,
  ];
  return discountDemandPatterns.some((p) => p.test(lower));
}

function isEmergencyMessage(text: string): boolean {
  const lower = text.toLowerCase();
  const patterns = [
    /knocked[\s-]?out/i,
    /tooth\s+(fell|came|popped|got\s+knocked)\s+out/i,
    /avulsed/i,
    /lost\s+(a|my|his|her)\s+(front\s+)?tooth\s+(in\s+an?\s+accident|just\s+now|falling|fell)/i,
    /(heavy|severe|uncontrolled|non[\s-]?stop|continuous|excessive|lot\s+of|profuse)\s+bleeding/i,
    /bleeding\s+(heavily|non[\s-]?stop|continuously|won't\s+stop|will\s+not\s+stop|not\s+stopping|a\s+lot|for\s+\d+\s+hour|badly|profusely)/i,
    /(won't|will\s+not|not|can't|cannot)\s+stop\s+bleeding/i,
    /blood\s+(won't|will\s+not|not)\s+stop/i,
    /bleeding\s+(from|in)\s+(my\s+|the\s+|his\s+|her\s+)?(mouth|socket|tooth|extraction)/i,
    /(facial|face|jaw|cheek|neck|eye|throat)\s+(is\s+|has\s+)?(very\s+|badly\s+|severely\s+)?(swelling|swollen)/i,
    /(swelling|swollen)\s+(in|on|of|around)\s+(my\s+|the\s+|his\s+|her\s+)?(face|facial|jaw|cheek|neck|eye|throat)/i,
    /(swelling|swollen).*(fever|breathing|swallow|spread)/i,
    /(fever|breathing|swallow).*(swelling|swollen)/i,
    /(can't|cannot|hard\s+to|trouble|difficulty|unable\s+to)\s+(breathe|breathing|swallow|swallowing|open\s+my\s+mouth)/i,
    /(jaw|tooth|teeth)\s+(is\s+|was\s+|got\s+)?(fractured?|broken|shattered|cracked\s+in\s+half)/i,
    /(broke|fractured|shattered)\s+(my|a|his|her|the)\s+(jaw|front\s+tooth|tooth)/i,
    /(car|bike|road|fall|sports|cricket|playground)\s+(accident|trauma|injury)/i,
    /(dental|mouth|oral|tooth)\s+(trauma|injury|accident)/i,
    /fell\s+(down\s+)?and\s+(broke|hit|chipped|knocked)/i,
    /(unbearable|excruciating|extreme|severe|intense)\s+(tooth\s+|dental\s+|jaw\s+)?pain/i,
    /\bemergency\b/i,
    /\burgent\s+(help|dental|care|bleeding|pain|swelling|accident)\b/i,
    /khoon\s+(beh|aa\s+raha|nahi\s+ruk|band\s+nahi)/i,
    /bahut\s+zyada\s+(dard|sujan|khoon)/i,
    /daant\s+toot\s+gaya/i,
    /రక్తం\s*(ఆగడం\s*లేదు|ఎక్కువగా)/,
    /తీవ్రమైన\s*(నొప్పి|వాపు)/,
    /ప్రమాదం/,
    /పన్ను\s*(విరిగి|ఊడి)/,
  ];
  return patterns.some((p) => p.test(lower));
}

function isMedicalAdviceOrSymptom(text: string): boolean {
  const lower = text.toLowerCase();
  const symptomPatterns = [
    /tooth\s*ache/i,
    /\bpain\b/i,
    /\bache\b/i,
    /\bhurts?\b/i,
    /\bhurting\b/i,
    /\bthrobbing\b/i,
    /\bswelling\b/i,
    /\bswollen\b/i,
    /\bpus\b/i,
    /\babscess\b/i,
    /bleeding\s+gums?/i,
    /gums?\s+bleed/i,
    /\bsensitiv(e|ity)\b/i,
    /(cold|hot)\s+(water|drink|food)/i,
    /do\s+i\s+have\s+(a\s+)?(cavity|infection|abscess|decay|gum\s+disease)/i,
    /do\s+i\s+need\s+(a\s+)?(root\s+canal|extraction|filling|antibiotic)/i,
    /why\s+(does|is)\s+my\s+(tooth|teeth|gum|gums|jaw)/i,
    /what\s+is\s+wrong\s+with\s+my/i,
    /\b(diagnose|diagnosis|symptom|symptoms|infection|ulcer)\b/i,
    /\b(antibiotic|amoxicillin|augmentin|metronidazole|painkiller|ibuprofen|paracetamol|dolo|combiflam|ketorol|aceclofenac|diclofenac|tablet|medicine|medication|pill|prescribe|prescription|dosage|clove\s+oil|home\s+remedy)\b/i,
    /should\s+i\s+take/i,
    /which\s+(medicine|tablet|painkiller|antibiotic)/i,
    /can\s+i\s+take/i,
    /\bdard\b/i,
    /\bdawai\b/i,
    /\bgoli\b/i,
    /\bnoppi\b/i,
    /\bmandulu\b/i,
    /నొప్పి/,
    /వాపు/,
    /మందు/,
    /दर्द/,
    /सूजन/,
    /दवा/,
  ];
  return symptomPatterns.some((p) => p.test(lower));
}

const LOCAL_DAY_PATTERN =
  /\b(today|tomorrow|day\s+after\s+tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun|kal|aaj|repu|ivvala|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*)\b|आज|कल|ఈరోజు|రేపు/i;

const LOCAL_CLOCK_TIME_PATTERN =
  /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))\b|\bat\s+(\d{1,2}(?::\d{2})?(?:\s*(?:am|pm|a\.m\.|p\.m\.))?)\b|\b(\d{1,2}:\d{2})\b|\b(\d{1,2}(?::\d{2})?\s*(?:baje|gantalaku))\b/i;

const LOCAL_PART_OF_DAY_PATTERN =
  /\b(morning|afternoon|evening|subah|shaam|dopahar|udayam|udhayam|sayantram|madhyahnam)\b|सुबह|शाम|दोपहर|ఉదయం|సాయంత్రం|మధ్యాహ్నం/i;

function extractBookingRequest(
  text: string,
  clinicData: ClinicData,
  previousMessages: ChatMessage[] = [],
): {
  isBooking: boolean;
  hasTime: boolean;
  bookingTime?: string;
  preferredDay?: string;
  doctorName?: string;
} {
  const lower = text.toLowerCase();

  const isPolicyOrScheduleInfoQuestion =
    /\b(cancel|cancellation|reschedule\s+policy|walk[\s-]?in|policy|policies|fee|fees|cost|price|prices|charge|charges|how\s+much|which\s+doctor|who\s+is\s+(the\s+)?(saturday|sunday|braces|available)|who\s+(works?|comes?|is\s+available)|doctor'?s?\s+schedule|clinic\s+schedule|what\s+(are|is)\s+(the|your)\s+(timings|hours|schedule))\b/i.test(
      lower,
    ) && !/\b(book|booking|reserve|fix\s+an?\s+appointment|make\s+an?\s+appointment)\b/i.test(lower);

  if (isPolicyOrScheduleInfoQuestion) {
    return { isBooking: false, hasTime: false };
  }

  const dayMatch = text.match(LOCAL_DAY_PATTERN);
  const clockTimeMatch = text.match(LOCAL_CLOCK_TIME_PATTERN);
  const partOfDayMatch = text.match(LOCAL_PART_OF_DAY_PATTERN);
  const timeMatch = clockTimeMatch || partOfDayMatch;
  const matchedDoc = clinicData.doctors.find((doc) => {
    const tokens = doc.name
      .toLowerCase()
      .replace(/^dr\.?\s*/i, '')
      .split(/\s+/)
      .filter((t) => t.length > 2);
    return tokens.some((token) => lower.includes(token));
  });

  const explicitBookingIntent =
    /\b(book|booking|reserve)\b/i.test(lower) ||
    /\b(schedule|fix|make|request|get|need|want)\s+(an?\s+|my\s+)?(appointment|slot|visit|consultation|check[\s-]?up)\b/i.test(
      lower,
    ) ||
    /\b(want|would\s+like|like|need)\s+to\s+(schedule|visit|come\s+in|consult|see\s+(?:dr|a\s+doctor|the\s+dentist)|meet\s+(?:dr|doctor))\b/i.test(
      lower,
    ) ||
    /\bcan\s+i\s+(come\s+in|get\s+an?\s+appointment|get\s+a\s+slot|see\s+(?:dr|the\s+dentist))\b/i.test(
      lower,
    ) ||
    /\bappointment\s+(for|on|at|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      lower,
    ) ||
    /appointment\s+chahiye|book\s+karna|मिलना\s+है|अपॉइंटमेंट|बुक/i.test(text) ||
    /అపాయింట్మెంట్|బుక్\s+చేయండి|కలవాలి/i.test(text);

  const lastBotMsg = [...previousMessages].reverse().find((m) => m.sender === 'bot');
  const awaitingBookingTime = Boolean(
    lastBotMsg &&
      /preferred\s+(day\s+and\s+)?time|what\s+(day\s+and\s+)?time|पसंदीदा\s+दिन\s+और\s+समय|అనుకూలమైన\s+రోజు\s+మరియు\s+సమయాన్ని/i.test(
        lastBotMsg.text,
      ),
  );

  const lastPatientMsg = [...previousMessages].reverse().find((m) => m.sender === 'patient');
  const inheritedDay =
    !dayMatch && awaitingBookingTime && lastPatientMsg
      ? lastPatientMsg.text.match(LOCAL_DAY_PATTERN)?.[0]?.trim()
      : undefined;
  const inheritedDoc =
    !matchedDoc && awaitingBookingTime && lastPatientMsg
      ? clinicData.doctors.find((doc) => {
          const tokens = doc.name
            .toLowerCase()
            .replace(/^dr\.?\s*/i, '')
            .split(/\s+/)
            .filter((t) => t.length > 2);
          return tokens.some((token) => lastPatientMsg.text.toLowerCase().includes(token));
        })
      : undefined;

  const isStandaloneSlotMessage =
    text.trim().length <= 64 &&
    Boolean(dayMatch && timeMatch) &&
    !/\b(open|close|closing|timing|timings|hours|price|cost|fee|when|who|which)\b|\?/i.test(text);

  const isFollowUpTimeReply =
    awaitingBookingTime &&
    text.trim().length <= 80 &&
    Boolean(timeMatch || dayMatch) &&
    !/\b(price|cost|fee|insurance|parking|landmark|where|who|which\s+doctor)\b/i.test(lower);

  if (!explicitBookingIntent && !isStandaloneSlotMessage && !isFollowUpTimeReply) {
    return { isBooking: false, hasTime: false };
  }

  const resolvedDay = dayMatch?.[0]?.trim() || inheritedDay;
  const resolvedDoc = matchedDoc || inheritedDoc;

  if (!timeMatch) {
    return {
      isBooking: true,
      hasTime: false,
      preferredDay: resolvedDay,
      doctorName: resolvedDoc?.name,
    };
  }

  const timeValue = (
    timeMatch[1] ||
    timeMatch[2] ||
    timeMatch[3] ||
    timeMatch[4] ||
    timeMatch[0]
  ).trim();

  const parts: string[] = [];
  if (resolvedDay) parts.push(resolvedDay);
  parts.push(timeValue);
  if (resolvedDoc) parts.push(`with ${resolvedDoc.name}`);

  return {
    isBooking: true,
    hasTime: true,
    bookingTime: parts.join(' · '),
    preferredDay: resolvedDay,
    doctorName: resolvedDoc?.name,
  };
}

function formatAskForBookingTime(
  clinicData: ClinicData,
  lang: LanguageCode,
  preferredDay?: string,
  doctorName?: string,
): string {
  const docPart = doctorName ? ` with ${doctorName}` : '';
  const dayPart = preferredDay ? ` on ${preferredDay}` : '';
  if (lang === 'hi') {
    return `मैं ${clinicData.clinicName} में आपका अपॉइंटमेंट बुक करने में खुशी से मदद करूँगा${docPart}। कृपया अपना पसंदीदा दिन और समय बताएं ताकि मैं आपकी बुकिंग दर्ज कर सकूँ। (क्लिनिक समय: ${clinicData.timings.weekdays}; ${clinicData.timings.sunday})`;
  }
  if (lang === 'te') {
    return `${clinicData.clinicName} లో మీ అపాయింట్‌మెంట్ బుక్ చేయడానికి నేను సంతోషంగా సహాయం చేస్తాను${docPart}. దయచేసి మీకు అనుకూలమైన రోజు మరియు సమయాన్ని తెలియజేయండి. (క్లినిక్ వేళలు: ${clinicData.timings.weekdays}; ${clinicData.timings.sunday})`;
  }
  if (preferredDay) {
    return `I would be happy to book an appointment for you${docPart}${dayPart} at ${clinicData.clinicName}. What preferred time would work best for you? (Clinic timings: ${clinicData.timings.weekdays}; ${clinicData.timings.sunday})`;
  }
  return `I would be happy to book an appointment for you${docPart} at ${clinicData.clinicName}. What preferred day and time would work best for you? (Clinic timings: ${clinicData.timings.weekdays}; ${clinicData.timings.sunday})`;
}

function tokenize(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'are', 'how', 'much', 'what', 'when',
  'where', 'does', 'have', 'cost', 'price', 'fees', 'fee', 'charges', 'charge',
  'rate', 'rates', 'clinic', 'dental', 'doctor', 'doctors', 'tell', 'about', 'can',
  'will', 'take', 'any', 'this', 'that', 'from', 'banjara', 'hills', 'hyderabad',
  'dentistae', 'please', 'there', 'here', 'get', 'give', 'need', 'want', 'know',
  'offer', 'provide', 'available', 'long', 'time',
]);

const GENERIC_PRICE_WORDS = new Set([
  'price', 'prices', 'cost', 'costs', 'fee', 'fees', 'tariff', 'tariffs',
  'charge', 'charges', 'rate', 'rates', 'menu', 'list', 'chart', 'treatment',
  'treatments', 'service', 'services', 'procedure', 'procedures', 'much', 'all',
  'standard', 'general', 'offered', 'provided', 'share', 'show', 'info',
  'information', 'details', 'detail',
]);

const NOISY_NOTE_WORDS = new Set([
  'single', 'includes', 'include', 'initial', 'oral', 'plan', 'varies', 'depends',
  'only', 'separately', 'billed', 'priced', 'session', 'final', 'quote', 'after',
  'monthly', 'full', 'arch', 'tooth', 'teeth', 'digital', 'takes', 'about',
  'minutes', 'valid', 'months', 'last', 'recent', 'repeat', 'within', 'covered',
  'advised', 'accepted', 'handled', 'separate', 'custom', 'fixed', 'missing',
  'replacement', 'gentle', 'check', 'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday', 'karthikeya', 'sharma',
]);

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type DayKey = (typeof DAY_ORDER)[number];

function extractRequestedDays(lower: string): DayKey[] {
  const map: Array<[RegExp, DayKey]> = [
    [/\b(monday|mon)\b/i, 'mon'],
    [/\b(tuesday|tue|tues)\b/i, 'tue'],
    [/\b(wednesday|wed)\b/i, 'wed'],
    [/\b(thursday|thu|thur|thurs)\b/i, 'thu'],
    [/\b(friday|fri)\b/i, 'fri'],
    [/\b(saturday|sat)\b/i, 'sat'],
    [/\b(sunday|sun)\b/i, 'sun'],
  ];
  return map.filter(([re]) => re.test(lower)).map(([, day]) => day);
}

function doctorWorksOnDay(schedule: string, targetDay: DayKey): boolean {
  const s = schedule.toLowerCase();
  const rangeRegex =
    /\b(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\s*(?:to|-|–|—)\s*(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/gi;
  const normalizeDay = (tok: string): DayKey => tok.slice(0, 3) as DayKey;
  let match: RegExpExecArray | null;
  while ((match = rangeRegex.exec(s)) !== null) {
    const startIdx = DAY_ORDER.indexOf(normalizeDay(match[1]));
    const endIdx = DAY_ORDER.indexOf(normalizeDay(match[2]));
    const targetIdx = DAY_ORDER.indexOf(targetDay);
    if (startIdx !== -1 && endIdx !== -1 && targetIdx !== -1) {
      if (startIdx <= endIdx && targetIdx >= startIdx && targetIdx <= endIdx) {
        return true;
      }
    }
  }
  return extractRequestedDays(s).includes(targetDay);
}

function formatUnanswered(clinicData: ClinicData, lang: LanguageCode): string {
  if (lang === 'hi') {
    return `क्षमा करें, मुझे इसका सटीक उत्तर हमारी क्लिनिक फाइल में नहीं मिला (I am not sure)। मैंने फ्रंट डेस्क के लिए टिकट (needs human) बना दिया है, और कोई व्यक्ति 2 कार्य घंटों के भीतर (within 2 working hours) आपको कॉल बैक करेगा।`;
  }
  if (lang === 'te') {
    return `క్షమించండి, ఈ సమాచారం మా క్లినిక్ ఫైల్‌లో అందుబాటులో లేదు (I am not sure). మా ఫ్రంట్ డెస్క్ కోసం టికెట్ (needs human) ఓపెన్ చేయబడింది, మరియు 2 పని గంటలలోపు (within 2 working hours) ఎవరైనా మీకు తిరిగి కాల్ చేస్తారు.`;
  }
  return `I am not sure about that as it is not listed in our clinic file at ${clinicData.clinicName}. I have opened a ticket for our front desk team, and someone will call back within 2 working hours.`;
}

function answerFromClinicFile(
  message: string,
  clinicData: ClinicData,
  lang: LanguageCode,
): { matched: boolean; reply: string } {
  const lower = message.toLowerCase();
  const serializedLower = JSON.stringify(clinicData).toLowerCase();

  if (
    /\b(personal\s+(phone|mobile|number|email)|home\s+address|private\s+number|gst\s+number|pan\s+number|wifi\s+password|franchise|job\s+opening|salary|internship|where\s+did\s+dr\.?\s+\w+\s+study|college|university|married|age\s+of\s+dr)\b/i.test(
      lower,
    )
  ) {
    return { matched: false, reply: formatUnanswered(clinicData, lang) };
  }

  const outOfFileCandidates: Array<[RegExp, string]> = [
    [/\bemi\b|installment|instalment|financing|loan|bajaj\s+finserv/i, 'emi'],
    [/\bhome\s+visit|house\s+call|visit\s+my\s+home/i, 'home visit'],
    [/\b(second\s+|other\s+)?branch(es)?\b|\bjubilee\s+hills\b|\bgachibowli\b|\bmadhapur\b|\bsecunderabad\b|\bkondapur\b|\bhitech\s+city\b|\bkukatpally\b/i, 'branch'],
    [/\b(laughing\s+gas|nitrous\s+oxide|general\s+anesthesia|general\s+anaesthesia|iv\s+sedation|conscious\s+sedation|sedation)\b/i, 'sedation'],
    [/\b(botox|liposuction|hair\s+transplant|lasik|mri|ct\s+scan|cbct|stem\s+cell|tooth\s+gem|tooth\s+jewel|dental\s+jewel|sleep\s+apnea|night\s+guard|mouth\s+guard|dentures?|laser\s+gum|gum\s+depigmentation)\b/i, 'special'],
    [/\b(amex|american\s+express|cheque|crypto|bitcoin|sodexo)\b/i, 'payment-special'],
    [/\b(wi-?fi|cafeteria|pharmacy|medical\s+store|ambulance|kids?\s+play\s+area|pet\s+friendly)\b/i, 'amenity'],
    [/\b(warranty|guarantee|refund\s+policy|money\s+back)\b/i, 'warranty'],
    [/\b(cghs|ehs|aarogyasri|ayushman|esic|govt\s+scheme|government\s+scheme)\b/i, 'govt-scheme'],
  ];
  for (const [pattern] of outOfFileCandidates) {
    const m = lower.match(pattern);
    if (m && !serializedLower.includes(m[0].toLowerCase())) {
      return { matched: false, reply: formatUnanswered(clinicData, lang) };
    }
  }

  const knownUnlistedInsurers = [
    'mediassist', 'medi assist', 'acko', 'niva bupa', 'max bupa', 'care health',
    'religare', 'aditya birla', 'sbi general', 'united india', 'new india assurance',
    'oriental insurance', 'tata aig', 'manipalcigna', 'cigna', 'digit insurance',
    'national insurance',
  ];
  const mentionedUnlistedInsurer = knownUnlistedInsurers.find(
    (ins) =>
      lower.includes(ins) &&
      !clinicData.insurance.partners.some((p) => p.toLowerCase().includes(ins)),
  );
  if (mentionedUnlistedInsurer) {
    return { matched: false, reply: formatUnanswered(clinicData, lang) };
  }

  const requestedDays = extractRequestedDays(lower);
  const asksAboutDoctorAvailability =
    /\b(doctors?|dentists?|specialists?|orthodontist|endodontist|surgeon|staff|team|who\s+is|who\s+works?|who\s+comes?|who\s+does|who\s+handles?|which\s+doctor|available|on\s+duty|qualification|qualifications|bds|mds|registration|tsdc|dci|credentials?)\b/i.test(
      lower,
    ) || /evaru|డాక్టర్|వైద్యుల|వైద్యుడ|డెంటిస్ట్|डॉक्टर|चिकित्सक|डेंटिस्ट/i.test(message);

  let matchedDoctors = clinicData.doctors.filter((doc) => {
    const nameTokens = tokenize(doc.name).filter((t) => t !== 'dr');
    const specTokens = tokenize(
      `${doc.specialty} ${doc.qualification} ${(doc.expertise || []).join(' ')}`,
    ).filter((t) => !STOPWORDS.has(t));
    const docTextLower = `${doc.specialty} ${doc.qualification} ${(doc.expertise || []).join(' ')}`.toLowerCase();

    const synonymDocMatch =
      ((lower.includes('orthodont') || lower.includes('brace') || lower.includes('aligner')) &&
        (docTextLower.includes('orthodont') || docTextLower.includes('brace'))) ||
      ((lower.includes('endodont') || lower.includes('root canal') || /\brct\b/.test(lower)) &&
        (docTextLower.includes('endodont') || docTextLower.includes('root canal'))) ||
      ((lower.includes('surgeon') || lower.includes('implant') || lower.includes('wisdom')) &&
        (docTextLower.includes('implant') || docTextLower.includes('surgery')));

    return (
      nameTokens.some((t) => lower.includes(t)) ||
      synonymDocMatch ||
      (asksAboutDoctorAvailability &&
        specTokens.some((t) => t.length >= 6 && lower.includes(t)))
    );
  });

  if (matchedDoctors.length === 0 && requestedDays.length > 0 && asksAboutDoctorAvailability) {
    matchedDoctors = clinicData.doctors.filter((doc) =>
      requestedDays.some((day) => doctorWorksOnDay(doc.schedule, day)),
    );
  }

  const asksDoctorsGeneral =
    /\b(doctors?|dentists?|specialists?|orthodontist|endodontist|surgeon|staff|team|who\s+is|who\s+works?|who\s+comes?|which\s+doctor|qualification|qualifications|bds|mds|registration|tsdc|dci|credentials?)\b/i.test(
      lower,
    ) || /evaru|డాక్టర్|వైద్యుల|వైద్యుడ|డెంటిస్ట్|डॉक्टर|चिकित्सक|डेंटिस्ट/i.test(message);

  const msgTokens = tokenize(message).filter((t) => !STOPWORDS.has(t));
  const matchesServiceByNameOrSynonym = (srv: ClinicData['services'][number]): boolean => {
    const srvLower = srv.name.toLowerCase();
    if (lower.includes(srvLower)) return true;

    const srvNameTokens = tokenize(srv.name).filter(
      (t) => !STOPWORDS.has(t) && t.length >= 3,
    );
    const isWisdomQuery = lower.includes('wisdom');
    const synonymMatches =
      ((lower.includes('rct') || /रूट\s*कैनाल|రూట్\s*కెనాల్/.test(message)) &&
        srvLower.includes('root canal')) ||
      ((lower.includes('clean') ||
        lower.includes('polish') ||
        lower.includes('scal') ||
        lower.includes('tartar') ||
        lower.includes('plaque') ||
        lower.includes('wash') ||
        /सफाई|క్లీనింగ్|శుభ్రం/.test(message)) &&
        srvLower.includes('scaling')) ||
      ((lower.includes('cap') || lower.includes('crown') || /कैप|क्राउन|క్రౌన్/.test(message)) &&
        srvLower.includes('crown')) ||
      (!isWisdomQuery &&
        (lower.includes('pull') ||
          lower.includes('remove') ||
          lower.includes('extract') ||
          /निकालना|తీసివేత/.test(message)) &&
        srvLower.includes('extract')) ||
      (isWisdomQuery && srvLower.includes('wisdom')) ||
      ((lower.includes('x-ray') ||
        lower.includes('xray') ||
        lower.includes('x ray') ||
        lower.includes('rvg') ||
        lower.includes('radiograph') ||
        /एक्स[\s-]?रे|ఎక్స్[\s-]?రే/.test(message)) &&
        srvLower.includes('x-ray')) ||
      ((lower.includes('aligner') || lower.includes('invisalign')) &&
        srvLower.includes('aligner')) ||
      ((lower.includes('ceramic brace') ||
        (lower.includes('ceramic') && lower.includes('brace'))) &&
        srvLower.includes('ceramic brace')) ||
      ((lower.includes('brace') || /ब्रेसेस|బ్రేసెస్/.test(message)) &&
        srvLower.includes('brace') &&
        !(lower.includes('ceramic') && srvLower.includes('metal'))) ||
      ((lower.includes('whiten') ||
        lower.includes('bleach') ||
        /व्हाइटनिंग|వైటెనింగ్/.test(message)) &&
        srvLower.includes('whiten')) ||
      ((lower.includes('implant') || /इम्प्लांट|ఇంప్లాంట్/.test(message)) &&
        srvLower.includes('implant')) ||
      ((lower.includes('fill') || lower.includes('cavity') || /फिलिंग|ఫిల్లింగ్/.test(message)) &&
        srvLower.includes('filling')) ||
      ((lower.includes('veneer') || lower.includes('smile design')) &&
        srvLower.includes('veneer')) ||
      (lower.includes('bridge') && srvLower.includes('bridge')) ||
      ((lower.includes('pediatric') ||
        lower.includes('paediatric') ||
        lower.includes('kids') ||
        lower.includes('child') ||
        lower.includes('fluoride')) &&
        srvLower.includes('pediatric')) ||
      ((lower.includes('checkup') ||
        lower.includes('check-up') ||
        lower.includes('consult') ||
        /कंसल्टेशन|చెక్[\s-]?అప్|కన్సల్టేషన్/.test(message)) &&
        srvLower.includes('consult'));

    if (synonymMatches) return true;
    if (
      srvLower.includes('crown') &&
      lower.includes('brace') &&
      !lower.includes('crown') &&
      !lower.includes('cap')
    ) {
      return false;
    }
    return srvNameTokens.some((st) =>
      msgTokens.some((mt) => mt === st || (mt.length >= 5 && st.includes(mt))),
    );
  };

  let matchedServices = clinicData.services.filter(matchesServiceByNameOrSynonym);
  if (matchedServices.length === 0) {
    matchedServices = clinicData.services.filter((srv) => {
      const notesTokens = tokenize(srv.notes || '').filter(
        (t) => !STOPWORDS.has(t) && !NOISY_NOTE_WORDS.has(t) && t.length >= 5,
      );
      return notesTokens.some((nt) => msgTokens.includes(nt));
    });
  }

  const hasRootCanalMatch = matchedServices.some((s) =>
    s.name.toLowerCase().includes('root canal'),
  );
  if (hasRootCanalMatch && !matchedServices.some((s) => s.name.toLowerCase().includes('crown'))) {
    const crownService = clinicData.services.find((s) =>
      s.name.toLowerCase().includes('crown'),
    );
    if (crownService) {
      matchedServices = [...matchedServices, crownService];
    }
  }

  const asksPricesGeneral =
    /\b(price|prices|cost|fee|fees|tariff|tariffs|charges|rate|rates|menu|how\s+much)\b/i.test(
      lower,
    ) || /kitna|kharch|paisa|entha|ధర|ఖర్చు|ఫీజు|ఫీస్|రేటు|చార్జీ|कितना|खर्च|फीस|चार्ज|दाम|पैसे|रुपये/i.test(message);

  const asksTimings =
    /\b(timing|timings|hours|open|close|closing|opening|sunday|saturday|weekday|weekends?|lunch|schedule)\b/i.test(
      lower,
    ) || /samay|kab|khulta|eppudu|samayam|సమయ|వేళ|ఎప్పుడు|తెరిచి|మూసి|ఆదివారం|టైమింగ్|समय|कब|खुलता|बंद|रविवार|टाइमिंग/i.test(message);

  const asksLocation =
    /\b(where\s+(are\s+you|is\s+(the\s+)?(clinic|dentistae|it|your\s+clinic)|located|to\s+park|can\s+i\s+park)|location|address|directions?|landmark|green\s+leaf|road\s*no|parking|basement|valet|wheelchair|how\s+to\s+reach|map|near\s*by|opposite)\b/i.test(
      lower,
    ) || /kahan|ekkada|ఎక్కడ|చిరునామా|అడ్రస్|లొకేషన్|పార్కింగ్|బంజారా|कहाँ|कहां|पता|लोकेशन|पार्किंग|बंजारा/i.test(message);

  const asksInsurance =
    /\b(insurance|cashless|reimbursement|claim|bill|invoice|tpa|star\s+health|hdfc|icici|bajaj|opd\s+cover)\b/i.test(
      lower,
    ) || /బీమా|ఇన్సూరెన్స్|క్యాష్‌లెస్|రీయింబర్స్|बीमा|इंश्योरेंस|कैशलेस/i.test(message);

  const asksPolicies =
    /\b(polic|cancel|reschedul|walk[\s-]?in|payment|upi|gpay|phonepe|paytm|debit\s+card|credit\s+card|cash|sterilis|steriliz|autoclave|senior\s+citizen)\b/i.test(
      lower,
    ) || /నియమ|పాలసీ|చెల్లింపు|పేమెంట్|రద్దు|నగదు|యూపీఐ|नियम|पॉलिसी|पेमेंट|भुगतान|रद्द|कैंसिल/i.test(message);

  const asksContact =
    /\b(phone|number|call|contact|email|helpline)\b/i.test(lower) ||
    /ఫోన్|నంబర్|కాల్|సంప్రదింపు|ఇమెయిల్|फोन|नंबर|कॉल|संपर्क|ईमेल/i.test(message);

  const sections: string[] = [];

  if (matchedServices.length > 0) {
    const list = matchedServices
      .map((s) => `• ${s.name}: ${s.price}${s.notes ? ` — ${s.notes}` : ''}`)
      .join('\n');
    sections.push(
      lang === 'hi'
        ? `उपचार और शुल्क (Clinic File):\n${list}`
        : lang === 'te'
          ? `చికిత్స మరియు ధరలు (Clinic File):\n${list}`
          : `Treatment & Fee Details:\n${list}`,
    );
  } else if (asksPricesGeneral && !asksLocation && !asksInsurance && !asksPolicies) {
    const specificUnknownTokens = msgTokens.filter((t) => !GENERIC_PRICE_WORDS.has(t));
    if (specificUnknownTokens.length > 0) {
      return { matched: false, reply: formatUnanswered(clinicData, lang) };
    }
    const list = clinicData.services.map((s) => `• ${s.name}: ${s.price}`).join('\n');
    sections.push(
      lang === 'hi'
        ? `हमारे क्लिनिक के मानक शुल्क:\n${list}`
        : lang === 'te'
          ? `మా క్లినిక్ ప్రామాణిక ధరలు:\n${list}`
          : `Clinic Treatment Tariffs:\n${list}`,
    );
  }

  if (matchedDoctors.length > 0) {
    const list = matchedDoctors
      .map(
        (d) =>
          `• ${d.name} (${d.qualification})${d.registrationNumber ? ` | ${d.registrationNumber}` : ''} — ${d.specialty}. Days & Timings: ${d.schedule}`,
      )
      .join('\n');
    sections.push(
      lang === 'hi'
        ? `डॉक्टर विवरण:\n${list}`
        : lang === 'te'
          ? `డాక్టర్ వివరాలు:\n${list}`
          : `Doctor Details:\n${list}`,
    );
  } else if (asksDoctorsGeneral) {
    const namedUnknownDoctor = /\bdr\.?\s+[a-z]{3,}/i.test(lower);
    if (namedUnknownDoctor) {
      return { matched: false, reply: formatUnanswered(clinicData, lang) };
    }
    const list = clinicData.doctors
      .map(
        (d) =>
          `• ${d.name} (${d.qualification})${d.registrationNumber ? ` | ${d.registrationNumber}` : ''} — ${d.specialty} | ${d.schedule}`,
      )
      .join('\n');
    sections.push(
      lang === 'hi'
        ? `हमारे डॉक्टर:\n${list}`
        : lang === 'te'
          ? `మా వైద్యులు:\n${list}`
          : `Our Dental Specialists:\n${list}`,
    );
  }

  if (asksTimings && matchedDoctors.length === 0) {
    const t = clinicData.timings;
    sections.push(
      lang === 'hi'
        ? `क्लिनिक का समय:\n• ${t.weekdays}\n• ${t.sunday}\n• ${t.lunchBreak}`
        : lang === 'te'
          ? `క్లినిక్ వేళలు:\n• ${t.weekdays}\n• ${t.sunday}\n• ${t.lunchBreak}`
          : `Clinic Timings:\n• ${t.weekdays}\n• ${t.sunday}\n• ${t.lunchBreak}`,
    );
  }

  if (asksLocation) {
    sections.push(
      lang === 'hi'
        ? `पता और पार्किंग:\n• ${clinicData.address}\n• लैंडमार्क: ${clinicData.landmark}\n• ${clinicData.parkingAndAccess}`
        : lang === 'te'
          ? `చిరునామా మరియు పార్కింగ్:\n• ${clinicData.address}\n• ల్యాండ్‌మార్క్: ${clinicData.landmark}\n• ${clinicData.parkingAndAccess}`
          : `Location & Access:\n• ${clinicData.address}\n• Landmark: ${clinicData.landmark}\n• ${clinicData.parkingAndAccess}`,
    );
  }

  if (asksInsurance) {
    const partners = clinicData.insurance.partners.map((p) => `• ${p}`).join('\n');
    sections.push(
      lang === 'hi'
        ? `बीमा (Insurance) जानकारी:\n${clinicData.insurance.summary}\nसूचीबद्ध पार्टनर:\n${partners}`
        : lang === 'te'
          ? `ఇన్సూరెన్స్ వివరాలు:\n${clinicData.insurance.summary}\nజాబితా చేయబడిన భాగస్వాములు:\n${partners}`
          : `Insurance & Reimbursement:\n${clinicData.insurance.summary}\nSupported Corporate OPD Plans:\n${partners}`,
    );
  }

  if (asksPolicies) {
    const pol = clinicData.policies.map((p) => `• ${p}`).join('\n');
    sections.push(
      lang === 'hi'
        ? `क्लिनिक नीतियां (Policies):\n${pol}`
        : lang === 'te'
          ? `క్లినిక్ నియమాలు (Policies):\n${pol}`
          : `Clinic Policies:\n${pol}`,
    );
  }

  if (asksContact) {
    sections.push(
      lang === 'hi'
        ? `संपर्क विवरण:\n• फ्रंट डेस्क: ${clinicData.phone}\n• 24/7 आपातकालीन डेंटल लाइन: ${clinicData.emergencyPhone}\n• ईमेल: ${clinicData.email}`
        : lang === 'te'
          ? `సంప్రదింపు వివరాలు:\n• ఫ్రంట్ డెస్క్: ${clinicData.phone}\n• 24/7 ఎమర్జెన్సీ డెంటల్ లైన్: ${clinicData.emergencyPhone}\n• ఇమెయిల్: ${clinicData.email}`
          : `Contact Details:\n• Front Desk: ${clinicData.phone}\n• Emergency Dental Line: ${clinicData.emergencyPhone}\n• Email: ${clinicData.email}`,
    );
  }

  if (sections.length === 0) {
    return { matched: false, reply: formatUnanswered(clinicData, lang) };
  }
  return { matched: true, reply: sections.join('\n\n') };
}

export function localHandleChat(sessionId: string, message: string): {
  sessionId: string;
  reply: string;
  fallbackUsed: boolean;
  sourceLabel?: string;
  language: LanguageCode;
  ticket: Ticket | null;
  messages: ChatMessage[];
} {
  const clinicData = localGetClinicData();
  const trimmed = message.trim();
  const lang = detectLanguage(trimmed);
  const previousMessages = localGetSessionMessages(sessionId);

  localAppendSessionMessage({
    id: `msg-${Date.now()}-p`,
    sessionId,
    sender: 'patient',
    text: trimmed,
    timestamp: new Date().toISOString(),
  });

  let reply = '';
  let ticket: Ticket | null = null;

  if (isRuleOverrideOrDiscountDemand(trimmed)) {
    reply =
      lang === 'hi'
        ? `मैं क्लिनिक के नियमों को बदल नहीं सकता और न ही किसी प्रकार की छूट (discount) का वादा कर सकता हूँ। ${clinicData.clinicName} में सभी उपचारों के लिए मानक क्लिनिक शुल्क लागू होते हैं।`
        : lang === 'te'
          ? `నేను క్లినిక్ నియమాలను మార్చలేను మరియు డిస్కౌంట్ హామీ ఇవ్వలేను. ${clinicData.clinicName} వద్ద అన్ని చికిత్సలకు ప్రామాణిక క్లినిక్ ధరలు వర్తిస్తాయి.`
          : `I cannot override clinic guidelines or offer or promise any discounts. Standard clinic tariffs apply to all treatments at ${clinicData.clinicName}. (Senior citizens aged 65+ receive a complimentary Digital X-Ray with a paid consultation.)`;
  } else if (isEmergencyMessage(trimmed)) {
    ticket = localCreateTicket({
      sessionId,
      question: trimmed,
      status: 'urgent',
      category: 'emergency',
    });
    reply =
      lang === 'hi'
        ? `आपातकालीन नंबर (Emergency): ${clinicData.emergencyPhone}\n\nकृपया तुरंत हमारे 24/7 आपातकालीन डेंटल नंबर ${clinicData.emergencyPhone} पर कॉल करें या ${clinicData.address} स्थित क्लिनिक पहुँचें। मैंने प्राथमिकता (urgent) टिकट बना दिया है।`
        : lang === 'te'
          ? `అత్యవసర నంబర్ (Emergency): ${clinicData.emergencyPhone}\n\nదయచేసి వెంటనే మా 24/7 ఎమర్జెన్సీ డెంటల్ నంబర్ ${clinicData.emergencyPhone} కు కాల్ చేయండి లేదా ${clinicData.address} లోని క్లినిక్‌కు రండి. urgent టికెట్ ఓపెన్ చేయబడింది.`
          : `Emergency Dental Line: ${clinicData.emergencyPhone}\n\nThis sounds like a dental emergency. Please call our 24/7 emergency line at ${clinicData.emergencyPhone} immediately or visit ${clinicData.clinicName} at ${clinicData.address}. I have opened an urgent ticket so our on-call team is alerted right away.`;
  } else {
    const booking = extractBookingRequest(trimmed, clinicData, previousMessages);
    if (isMedicalAdviceOrSymptom(trimmed)) {
      if (booking.isBooking && booking.hasTime && booking.bookingTime) {
        ticket = localCreateTicket({
          sessionId,
          question: trimmed,
          status: 'needs human',
          category: 'booking',
          bookingTime: booking.bookingTime,
        });
      }
      const consult = clinicData.services.find((s) =>
        s.name.toLowerCase().includes('consult'),
      );
      const consultFee = consult ? consult.price : '₹500';
      const confirmedTime = booking.hasTime ? booking.bookingTime : undefined;
      reply =
        lang === 'hi'
          ? `मैं चिकित्सीय सलाह, निदान या दवा की सिफारिश नहीं दे सकता। किसी भी दर्द या लक्षण के लिए हमारे दंत चिकित्सक द्वारा व्यक्तिगत जांच आवश्यक है (कंसल्टेशन शुल्क: ${consultFee})। ${confirmedTime ? `मैंने "${confirmedTime}" के लिए आपका अपॉइंटमेंट अनुरोध दर्ज कर लिया है।` : 'कृपया अपॉइंटमेंट बुक करने के लिए अपना पसंदीदा दिन और समय बताएं।'}`
          : lang === 'te'
            ? `నేను వైద్య సలహా, రోగ నిర్ధారణ లేదా మందుల సూచనలు ఇవ్వలేను. నొప్పి లేదా లక్షణాల కోసం దంతవైద్యుడు స్వయంగా పరీక్షించాల్సి ఉంటుంది (కన్సల్టేషన్ ఫీజు: ${consultFee}). ${confirmedTime ? `"${confirmedTime}" కోసం మీ అపాయింట్‌మెంట్ అభ్యర్థనను నమోదు చేశాము.` : 'దయచేసి అపాయింట్‌మెంట్ కోసం మీకు అనుకూలమైన రోజు మరియు సమయాన్ని తెలియజేయండి.'}`
            : `I cannot provide medical advice, a diagnosis, or recommend medications. Because you are experiencing symptoms or pain, a dentist must examine you in person. ${confirmedTime ? `I have also logged your appointment request for ${confirmedTime}, and our front desk will confirm your slot shortly.` : `Would you like me to book an appointment? Please share your preferred day and time (Consultation fee: ${consultFee}; Hours: ${clinicData.timings.weekdays}).`}`;
    } else if (booking.isBooking) {
      if (!booking.hasTime || !booking.bookingTime) {
        reply = formatAskForBookingTime(
          clinicData,
          lang,
          booking.preferredDay,
          booking.doctorName,
        );
      } else {
        ticket = localCreateTicket({
          sessionId,
          question: trimmed,
          status: 'needs human',
          category: 'booking',
          bookingTime: booking.bookingTime,
        });
        reply =
          lang === 'hi'
            ? `धन्यवाद! मैंने ${clinicData.clinicName} में अपॉइंटमेंट अनुरोध दर्ज कर लिया है (पसंदीदा समय: ${booking.bookingTime})। हमारे फ्रंट डेस्क से कोई व्यक्ति 2 कार्य घंटों के भीतर पुष्टि के लिए कॉल करेगा।`
            : lang === 'te'
              ? `ధన్యవాదాలు! ${clinicData.clinicName} లో మీ అపాయింట్‌మెంట్ అభ్యర్థన నమోదు చేయబడింది (సమయం: ${booking.bookingTime}). మా ఫ్రంట్ డెస్క్ సిబ్బంది 2 పని గంటలలోపు నిర్ధారించడానికి కాల్ చేస్తారు.`
              : `I have logged your appointment booking request for ${booking.bookingTime} at ${clinicData.clinicName}. Our front desk team will confirm your slot and someone will call back within 2 working hours (Front desk: ${clinicData.phone}).`;
      }
    } else {
      const matched = answerFromClinicFile(trimmed, clinicData, lang);
      reply = matched.reply;
      if (!matched.matched) {
        ticket = localCreateTicket({
          sessionId,
          question: trimmed,
          status: 'needs human',
          category: 'unanswered',
        });
      }
    }
  }

  const messages = localAppendSessionMessage({
    id: `msg-${Date.now()}-b`,
    sessionId,
    sender: 'bot',
    text: reply,
    timestamp: new Date().toISOString(),
    fallbackUsed: true,
    sourceLabel: 'Answered from the clinic file',
    language: lang,
    ticketId: ticket?.id,
  });

  return {
    sessionId,
    reply,
    fallbackUsed: true,
    sourceLabel: 'Answered from the clinic file',
    language: lang,
    ticket,
    messages,
  };
}

export function localGetAllLeads(): LeadEnquiry[] {
  const leads = readStorage<LeadEnquiry[]>(LS_LEADS_KEY, []);
  return [...leads].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function localCreateLead(input: {
  patientName: string;
  phone: string;
  treatment: string;
  preferredDate: string;
  preferredTime?: string;
  message?: string;
  source?: LeadEnquiry['source'];
}): { lead: LeadEnquiry; ticket: Ticket } {
  const leads = readStorage<LeadEnquiry[]>(LS_LEADS_KEY, []);
  const now = new Date().toISOString();
  const bookingSlot = [input.preferredDate, input.preferredTime]
    .filter(Boolean)
    .join(' · ');

  const ticket = localCreateTicket({
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
  writeStorage(LS_LEADS_KEY, leads);

  localAddNotification({
    channel: input.source === 'whatsapp-click' ? 'whatsapp' : 'booking',
    title:
      input.source === 'whatsapp-click'
        ? 'New WhatsApp Enquiry Captured'
        : 'New Appointment Enquiry',
    summary: `${lead.patientName} requested ${lead.treatment}${lead.preferredDate ? ` (${lead.preferredDate})` : ''}.`,
    treatment: lead.treatment,
    patientName: lead.patientName,
    phone: lead.phone,
    leadId: lead.id,
    ticketId: ticket.id,
  });

  return { lead, ticket };
}

export function localGetAllNotifications(): ReceptionistNotification[] {
  const items = readStorage<ReceptionistNotification[]>(LS_NOTIFICATIONS_KEY, []);
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function localAddNotification(input: {
  channel: ReceptionistNotification['channel'];
  title: string;
  summary: string;
  treatment?: string;
  sourcePage?: string;
  prefilledMessage?: string;
  patientName?: string;
  phone?: string;
  leadId?: string;
  ticketId?: string;
}): ReceptionistNotification {
  const items = readStorage<ReceptionistNotification[]>(LS_NOTIFICATIONS_KEY, []);
  const notif: ReceptionistNotification = {
    id: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    channel: input.channel,
    title: input.title,
    summary: input.summary,
    treatment: input.treatment,
    sourcePage: input.sourcePage,
    prefilledMessage: input.prefilledMessage,
    patientName: input.patientName,
    phone: input.phone,
    leadId: input.leadId,
    ticketId: input.ticketId,
    read: false,
    createdAt: new Date().toISOString(),
  };
  writeStorage(LS_NOTIFICATIONS_KEY, [notif, ...items].slice(0, 60));
  return notif;
}

export function localMarkNotificationRead(id: string): ReceptionistNotification | null {
  const items = readStorage<ReceptionistNotification[]>(LS_NOTIFICATIONS_KEY, []);
  const idx = items.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], read: true };
  writeStorage(LS_NOTIFICATIONS_KEY, items);
  return items[idx];
}

export function localMarkAllNotificationsRead(): ReceptionistNotification[] {
  const items = readStorage<ReceptionistNotification[]>(LS_NOTIFICATIONS_KEY, []).map((n) => ({
    ...n,
    read: true,
  }));
  writeStorage(LS_NOTIFICATIONS_KEY, items);
  return localGetAllNotifications();
}

export function localCaptureWhatsAppEnquiry(input: {
  treatment?: string;
  sourcePage?: string;
  prefilledMessage: string;
  patientName?: string;
  phone?: string;
}): { lead: LeadEnquiry; ticket: Ticket; notification: ReceptionistNotification } {
  const leads = readStorage<LeadEnquiry[]>(LS_LEADS_KEY, []);
  const now = new Date().toISOString();
  const todayIso = now.slice(0, 10);
  const treatment = input.treatment?.trim() || 'WhatsApp Appointment Enquiry';
  const patientName = input.patientName?.trim() || 'WhatsApp Website Visitor';
  const phone = input.phone?.trim() || 'Via WhatsApp Chat';
  const sourcePage = input.sourcePage?.trim() || '/';

  const ticket = localCreateTicket({
    sessionId: `wa-${Date.now()}`,
    patientName,
    question: `[WhatsApp Enquiry from ${sourcePage}] ${input.prefilledMessage}${input.phone?.trim() ? ` | Phone: ${input.phone.trim()}` : ''}`,
    status: 'needs human',
    category: 'booking',
    bookingTime: 'WhatsApp enquiry (check WhatsApp Business)',
  });

  const lead: LeadEnquiry = {
    id: `LD-${String(leads.length + 201)}`,
    patientName,
    phone,
    treatment,
    preferredDate: todayIso,
    preferredTime: 'WhatsApp Enquiry',
    message: `${input.prefilledMessage} (Source: ${sourcePage})`,
    source: 'whatsapp-click',
    status: 'New',
    ticketId: ticket.id,
    createdAt: now,
    updatedAt: now,
  };

  leads.push(lead);
  writeStorage(LS_LEADS_KEY, leads);

  const notification = localAddNotification({
    channel: 'whatsapp',
    title: 'WhatsApp Enquiry Opened',
    summary: `${patientName} opened WhatsApp from ${sourcePage} for ${treatment}.`,
    treatment,
    sourcePage,
    prefilledMessage: input.prefilledMessage,
    patientName,
    phone: input.phone?.trim() || undefined,
    leadId: lead.id,
    ticketId: ticket.id,
  });

  return { lead, ticket, notification };
}

export function localUpdateLead(
  leadId: string,
  patch: {
    status?: LeadStatus;
    followUpNote?: string;
    followUpDate?: string;
    reminderSentAt?: string;
  },
): LeadEnquiry | null {
  const leads = readStorage<LeadEnquiry[]>(LS_LEADS_KEY, []);
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
  writeStorage(LS_LEADS_KEY, leads);
  return updated;
}

export function localSeedDemoLeads(): LeadEnquiry[] {
  const leads = readStorage<LeadEnquiry[]>(LS_LEADS_KEY, []);
  if (leads.some((l) => l.source === 'demo-sample')) {
    return localGetAllLeads();
  }

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

  writeStorage(LS_LEADS_KEY, [...samples, ...leads]);
  return localGetAllLeads();
}

export function localClearDemoLeads(): LeadEnquiry[] {
  const leads = readStorage<LeadEnquiry[]>(LS_LEADS_KEY, []);
  const filtered = leads.filter((l) => l.source !== 'demo-sample');
  writeStorage(LS_LEADS_KEY, filtered);
  return localGetAllLeads();
}

