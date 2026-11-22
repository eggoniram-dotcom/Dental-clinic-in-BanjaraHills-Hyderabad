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

