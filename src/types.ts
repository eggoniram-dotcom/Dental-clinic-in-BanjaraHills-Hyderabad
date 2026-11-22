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
  source: 'appointment-form' | 'treatment-page' | 'chat-booking' | 'demo-sample';
  status: LeadStatus;
  followUpNote?: string;
  followUpDate?: string;
  reminderSentAt?: string;
  ticketId?: string;
  createdAt: string;
  updatedAt: string;
}


export function normalizeClinicData(
  input: Partial<ClinicData> | null | undefined,
): ClinicData {
  const safe = input && typeof input === 'object' ? input : {};
  return {
    clinicName:
      typeof safe.clinicName === 'string' && safe.clinicName.trim()
        ? safe.clinicName
        : 'Dentistae Dental Care',
    tagline:
      typeof safe.tagline === 'string'
        ? safe.tagline
        : 'Banjara Hills Specialty Dental Clinic',
    address:
      typeof safe.address === 'string'
        ? safe.address
        : 'Plot 42, Road No. 12, Banjara Hills, Hyderabad, Telangana 500034',
    landmark: typeof safe.landmark === 'string' ? safe.landmark : '',
    phone: typeof safe.phone === 'string' ? safe.phone : '+91 40 2335 8899',
    emergencyPhone:
      typeof safe.emergencyPhone === 'string'
        ? safe.emergencyPhone
        : '+91 98490 11223',
    email: typeof safe.email === 'string' ? safe.email : 'frontdesk@dentistaehyd.in',
    timings: {
      weekdays:
        typeof safe.timings?.weekdays === 'string'
          ? safe.timings.weekdays
          : 'Monday to Saturday: 9:00 AM – 8:00 PM',
      sunday:
        typeof safe.timings?.sunday === 'string'
          ? safe.timings.sunday
          : 'Sunday: 10:00 AM – 2:00 PM (by prior appointment)',
      lunchBreak:
        typeof safe.timings?.lunchBreak === 'string'
          ? safe.timings.lunchBreak
          : 'Lunch Break (Mon–Sat): 1:30 PM – 2:30 PM',
    },
    doctors: Array.isArray(safe.doctors) ? safe.doctors : [],
    services: Array.isArray(safe.services) ? safe.services : [],
    policies: Array.isArray(safe.policies) ? safe.policies : [],
    insurance: {
      summary:
        typeof safe.insurance?.summary === 'string' ? safe.insurance.summary : '',
      partners: Array.isArray(safe.insurance?.partners)
        ? safe.insurance.partners
        : [],
    },
    parkingAndAccess:
      typeof safe.parkingAndAccess === 'string' ? safe.parkingAndAccess : '',
    googleReviews: {
      placeUrl:
        typeof safe.googleReviews?.placeUrl === 'string' ? safe.googleReviews.placeUrl : '',
      reviews: Array.isArray(safe.googleReviews?.reviews) ? safe.googleReviews.reviews : [],
    },
    updatedAt: typeof safe.updatedAt === 'string' ? safe.updatedAt : '',
  };
}

