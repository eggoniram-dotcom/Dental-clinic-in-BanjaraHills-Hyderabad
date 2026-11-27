export type TicketStatus = 'answered' | 'needs human' | 'urgent' | 'closed';

export type LanguageCode = 'en' | 'hi' | 'te';

export interface DoctorInfo {
  id: string;
  name: string;
  qualification: string;
  registrationNumber?: string;
  specialty: string;
  expertise?: string[];
  schedule: string;
}

export interface ServicePrice {
  id: string;
  name: string;
  price: string;
  notes?: string;
}

export interface GoogleReviewItem {
  id: string;
  authorName: string;
  rating: number;
  dateLabel: string;
  treatmentContext?: string;
  quote: string;
  sourceUrl: string;
}

export interface ClinicData {
  clinicName: string;
  tagline: string;
  address: string;
  landmark: string;
  phone: string;
  emergencyPhone: string;
  email: string;
  timings: {
    weekdays: string;
    sunday: string;
    lunchBreak: string;
  };
  doctors: DoctorInfo[];
  services: ServicePrice[];
  policies: string[];
  insurance: {
    summary: string;
    partners: string[];
  };
  parkingAndAccess: string;
  googleReviews?: {
    placeUrl?: string;
    reviews: GoogleReviewItem[];
  };
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  sender: 'patient' | 'bot' | 'staff';
  text: string;
  timestamp: string;
  fallbackUsed?: boolean;
  sourceLabel?: string;
  language?: LanguageCode;
  ticketId?: string;
}

export interface Ticket {
  id: string;
  sessionId: string;
  patientName: string;
  question: string;
  status: TicketStatus;
  category: 'unanswered' | 'emergency' | 'booking' | 'escalation';
  bookingTime?: string;
  createdAt: string;
  updatedAt: string;
  replies: {
    id: string;
    sender: 'staff';
    text: string;
    timestamp: string;
  }[];
}

export type LeadStatus = 'New' | 'Contacted' | 'Appointment' | 'Converted';

export interface LeadEnquiry {
  id: string;
  patientName: string;
  phone: string;
  treatment: string;
  preferredDate: string;
  preferredTime?: string;
  message?: string;
  source: 'appointment-form' | 'treatment-page' | 'chat-booking' | 'whatsapp-click' | 'demo-sample';
  status: LeadStatus;
  followUpNote?: string;
  followUpDate?: string;
  reminderSentAt?: string;
  ticketId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReceptionistNotification {
  id: string;
  channel: 'whatsapp' | 'booking' | 'urgent';
  title: string;
  summary: string;
  treatment?: string;
  sourcePage?: string;
  prefilledMessage?: string;
  patientName?: string;
  phone?: string;
  leadId?: string;
  ticketId?: string;
  read: boolean;
  createdAt: string;
}


function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function pickString(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    if (typeof c === 'string') return c;
  }
  return undefined;
}

export function normalizeClinicData(
  input: Partial<ClinicData> | Record<string, unknown> | null | undefined,
  fallbackBase?: Partial<ClinicData>,
): ClinicData {
  const rawObj =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  // Unwrap common container wrappers like { clinicData: {...} } or { data: {...} }
  const unwrapped =
    rawObj.clinicData && typeof rawObj.clinicData === 'object' && !Array.isArray(rawObj.clinicData)
      ? (rawObj.clinicData as Record<string, unknown>)
      : rawObj.data && typeof rawObj.data === 'object' && !Array.isArray(rawObj.data)
        ? (rawObj.data as Record<string, unknown>)
        : rawObj;

  const base = fallbackBase && typeof fallbackBase === 'object' ? fallbackBase : {};

  const clinicNameCandidate = pickString(
    unwrapped.clinicName,
    unwrapped.clinic_name,
    unwrapped.name,
    base.clinicName,
  );
  const clinicName =
    clinicNameCandidate && clinicNameCandidate.trim()
      ? clinicNameCandidate.trim()
      : 'Dentistae Dental Care';

  const rawTimings = unwrapped.timings;
  const timingsObj =
    rawTimings && typeof rawTimings === 'object' && !Array.isArray(rawTimings)
      ? (rawTimings as Record<string, unknown>)
      : {};
  const timingsString = typeof rawTimings === 'string' ? rawTimings : undefined;

  const rawDoctors = Array.isArray(unwrapped.doctors)
    ? unwrapped.doctors
    : Array.isArray(unwrapped.dentists)
      ? unwrapped.dentists
      : Array.isArray(base.doctors)
        ? base.doctors
        : [];

  const doctors: DoctorInfo[] = rawDoctors
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((doc, idx) => ({
      id:
        typeof doc.id === 'string' && doc.id.trim()
          ? doc.id.trim()
          : `doc-import-${idx + 1}`,
      name: pickString(doc.name, doc.fullName, doc.doctorName) ?? '',
      qualification: pickString(doc.qualification, doc.qualifications, doc.degree) ?? '',
      registrationNumber:
        pickString(doc.registrationNumber, doc.registration, doc.regNo) ?? '',
      specialty:
        pickString(doc.specialty, doc.speciality, doc.specialisation, doc.specialization) ?? '',
      expertise: toStringList(doc.expertise ?? doc.areasOfExpertise ?? doc.specialisations),
      schedule: pickString(doc.schedule, doc.timings, doc.consultationTimings, doc.hours) ?? '',
    }));

  const rawServices = Array.isArray(unwrapped.services)
    ? unwrapped.services
    : Array.isArray(unwrapped.treatments)
      ? unwrapped.treatments
      : Array.isArray(base.services)
        ? base.services
        : [];

  const services: ServicePrice[] = rawServices
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((srv, idx) => ({
      id:
        typeof srv.id === 'string' && srv.id.trim()
          ? srv.id.trim()
          : `srv-import-${idx + 1}`,
      name: pickString(srv.name, srv.title, srv.treatment) ?? '',
      price:
        typeof srv.price === 'number'
          ? `₹${srv.price}`
          : pickString(srv.price, srv.fee, srv.cost, srv.tariff) ?? '',
      notes: pickString(srv.notes, srv.description, srv.details) ?? '',
    }));

  const rawPolicies = unwrapped.policies !== undefined ? unwrapped.policies : base.policies;
  const policies = Array.isArray(rawPolicies)
    ? rawPolicies
        .map((p) => (typeof p === 'string' ? p : String(p ?? '')))
        .filter((p) => p.trim().length > 0)
    : typeof rawPolicies === 'string'
      ? rawPolicies
          .split(/\r?\n/)
          .map((p) => p.trim())
          .filter(Boolean)
      : [];

  const rawInsurance = unwrapped.insurance;
  const insuranceObj =
    rawInsurance && typeof rawInsurance === 'object' && !Array.isArray(rawInsurance)
      ? (rawInsurance as Record<string, unknown>)
      : {};
  const insuranceSummary =
    typeof rawInsurance === 'string'
      ? rawInsurance
      : pickString(insuranceObj.summary, base.insurance?.summary) ?? '';
  const insurancePartners =
    insuranceObj.partners !== undefined
      ? toStringList(insuranceObj.partners)
      : Array.isArray(base.insurance?.partners)
        ? base.insurance.partners
        : [];

  const rawReviewsBlock = unwrapped.googleReviews;
  const reviewsObj =
    rawReviewsBlock && typeof rawReviewsBlock === 'object' && !Array.isArray(rawReviewsBlock)
      ? (rawReviewsBlock as Record<string, unknown>)
      : {};
  const rawReviewsList = Array.isArray(reviewsObj.reviews)
    ? reviewsObj.reviews
    : Array.isArray(base.googleReviews?.reviews)
      ? base.googleReviews.reviews
      : [];

  const reviews: GoogleReviewItem[] = rawReviewsList
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((rev, idx) => ({
      id:
        typeof rev.id === 'string' && rev.id.trim()
          ? rev.id.trim()
          : `grev-import-${idx + 1}`,
      authorName: pickString(rev.authorName, rev.author, rev.name) ?? '',
      rating:
        typeof rev.rating === 'number' && Number.isFinite(rev.rating)
          ? Math.min(5, Math.max(1, Math.round(rev.rating)))
          : 5,
      dateLabel: pickString(rev.dateLabel, rev.date) ?? '',
      treatmentContext: pickString(rev.treatmentContext, rev.treatment) ?? '',
      quote: pickString(rev.quote, rev.text, rev.comment) ?? '',
      sourceUrl: pickString(rev.sourceUrl, rev.url, rev.link) ?? '',
    }));

  return {
    clinicName,
    tagline:
      pickString(unwrapped.tagline, base.tagline) ?? 'Banjara Hills Specialty Dental Clinic',
    address:
      pickString(unwrapped.address, base.address) ??
      'Plot 42, Road No. 12, Banjara Hills, Hyderabad, Telangana 500034',
    landmark: pickString(unwrapped.landmark, base.landmark) ?? '',
    phone: pickString(unwrapped.phone, unwrapped.phoneNumber, base.phone) ?? '+91 40 2335 8899',
    emergencyPhone:
      pickString(
        unwrapped.emergencyPhone,
        unwrapped.emergency_phone,
        unwrapped.emergencyNumber,
        unwrapped.emergency_number,
        unwrapped.emergencyContact,
        unwrapped.emergencyLine,
        base.emergencyPhone,
      ) ?? '+91 98490 11223',
    email: pickString(unwrapped.email, base.email) ?? 'frontdesk@dentistaehyd.in',
    timings: {
      weekdays:
        pickString(timingsObj.weekdays, timingsObj.monSat, timingsString, base.timings?.weekdays) ??
        'Monday to Saturday: 9:00 AM – 8:00 PM',
      sunday:
        pickString(timingsObj.sunday, base.timings?.sunday) ??
        'Sunday: 10:00 AM – 2:00 PM (by prior appointment)',
      lunchBreak:
        pickString(timingsObj.lunchBreak, timingsObj.lunch, base.timings?.lunchBreak) ??
        'Lunch Break (Mon–Sat): 1:30 PM – 2:30 PM',
    },
    doctors,
    services,
    policies,
    insurance: {
      summary: insuranceSummary,
      partners: insurancePartners,
    },
    parkingAndAccess:
      pickString(unwrapped.parkingAndAccess, unwrapped.parking, base.parkingAndAccess) ?? '',
    googleReviews: {
      placeUrl:
        pickString(reviewsObj.placeUrl, unwrapped.googleMapsUrl, base.googleReviews?.placeUrl) ??
        '',
      reviews,
    },
    updatedAt: typeof unwrapped.updatedAt === 'string' ? unwrapped.updatedAt : '',
  };
}

