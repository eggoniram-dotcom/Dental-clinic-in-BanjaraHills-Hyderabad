import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Send,
  ShieldCheck,
  Stethoscope,
  X,
} from 'lucide-react';
import { apiGetSessionMessages, apiSendChatMessage } from '../lib/clinicApi.ts';
import {
  CLINIC_IMAGES,
  FEATURED_TREATMENT_PAGES,
  buildGoogleMapsDirectionsLink,
  buildWhatsAppLink,
  getDoctorEnrichment,
  getNearestDoctorSlots,
  resolveTreatmentService,
} from '../lib/clinicCatalog.ts';
import type { ChatMessage, ClinicData } from '../types.ts';
import { AppointmentEnquiryForm } from './AppointmentEnquiryForm.tsx';

interface PatientChatPageProps {
  clinicData: ClinicData;
  onNavigateStaff?: () => void;
  onSelectTreatment?: (slug: string) => void;
}

const QUICK_REPLIES = [
  { label: 'Clinic timings', prompt: 'What are your clinic timings?' },
  { label: 'Doctors', prompt: 'Which doctors are available at the clinic?' },
  { label: 'Prices', prompt: 'What are your treatment prices?' },
  { label: 'Insurance', prompt: 'How does insurance reimbursement work?' },
  { label: 'Location', prompt: 'Where is the clinic located in Banjara Hills?' },
  { label: 'Book slot', prompt: 'I want to book an appointment tomorrow at 4:00 PM' },
  { label: 'हिन्दी (समय)', prompt: 'क्लिनिक का समय और कंसल्टेशन फीस क्या है?' },
  { label: 'తెలుగు (వేళలు)', prompt: 'క్లినిక్ వేళలు మరియు ధరలు చెప్పండి' },
];

const BOOKING_DAYS = [
  'Today',
  'Tomorrow',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const BOOKING_TIMES = ['10:00 AM', '11:30 AM', '12:30 PM', '3:00 PM', '4:30 PM', '6:00 PM', '7:00 PM'];

interface ConsentFeedbackItem {
  id: string;
  name: string;
  visitType: string;
  comment: string;
  submittedAt: string;
}

const LS_FEEDBACK_KEY = 'dentistae_patient_feedback_v1';

function loadConsentFeedback(): ConsentFeedbackItem[] {
  try {
    const raw = localStorage.getItem(LS_FEEDBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ConsentFeedbackItem[]) : [];
  } catch {
    return [];
  }
}

function getInitialSessionId(hasAutoQuery: boolean): string {
  if (hasAutoQuery) {
    const fresh = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      localStorage.setItem('dentistae_session_id', fresh);
    } catch {
      // Ignore storage errors in restricted contexts
    }
    return fresh;
  }
  try {
    const existing = localStorage.getItem('dentistae_session_id');
    if (existing) return existing;
    const created = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    localStorage.setItem('dentistae_session_id', created);
    return created;
  } catch {
    return `sess-${Date.now()}`;
  }
}

export function PatientChatPage({
  clinicData,
  onNavigateStaff,
  onSelectTreatment,
}: PatientChatPageProps) {
  const initialQuery =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('q')?.trim() || ''
      : '';

  const [sessionId, setSessionId] = useState<string>(() =>
    getInitialSessionId(Boolean(initialQuery)),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);

  // Zero-Broken-Image fallback state map
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const markImageBroken = (key: string) =>
    setBrokenImages((prev) => ({ ...prev, [key]: true }));

  // Interactive inline chat booking drawer & doctor slot picker
  const [bookingDrawerOpen, setBookingDrawerOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState('Tomorrow');
  const [selectedTime, setSelectedTime] = useState('4:30 PM');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [preselectedTreatment, setPreselectedTreatment] = useState<string | undefined>(undefined);
  const [preselectedDate, setPreselectedDate] = useState<string | undefined>(undefined);
  const [preselectedSlot, setPreselectedSlot] = useState<string | undefined>(undefined);
  const [preselectedNote, setPreselectedNote] = useState<string | undefined>(undefined);
  const [activeSlotDoctorId, setActiveSlotDoctorId] = useState<string | null>(null);
  const [pickedDoctorSlots, setPickedDoctorSlots] = useState<
    Record<string, { isoDate: string; dayLabel: string; shortDayName: string; time: string }>
  >({});

  // Verified patient feedback with explicit consent (never fabricated)
  const [feedbackItems, setFeedbackItems] = useState<ConsentFeedbackItem[]>(() =>
    typeof window !== 'undefined' ? loadConsentFeedback() : [],
  );
  const [fbName, setFbName] = useState('');
  const [fbVisitType, setFbVisitType] = useState('Consultation & Oral Check-up');
  const [fbComment, setFbComment] = useState('');
  const [fbConsent, setFbConsent] = useState(false);
  const [fbNotice, setFbNotice] = useState<string | null>(null);

  const autoAskedRef = useRef(false);
  const chatSectionRef = useRef<HTMLElement | null>(null);
  const bookingSectionRef = useRef<HTMLElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const hasInteractedRef = useRef(false);

  const scrollMessagesToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  useEffect(() => {
    if (hasInteractedRef.current || messages.length > 0) {
      scrollMessagesToBottom();
    }
  }, [messages, isSending, scrollMessagesToBottom]);

  // Poll active session so staff replies from /staff appear live
  useEffect(() => {
    let active = true;
    const fetchSession = async () => {
      try {
        const loaded = await apiGetSessionMessages(sessionId);
        if (active && Array.isArray(loaded)) {
          setMessages((prev) => {
            if (prev.length === loaded.length) {
              return prev;
            }
            if (isSending && loaded.length < prev.length) {
              return prev;
            }
            return loaded;
          });
        }
      } catch {
        // Silent retry on next poll
      }
    };

    if (!initialQuery || autoAskedRef.current) {
      void fetchSession();
    }
    const timer = window.setInterval(() => void fetchSession(), 2000);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'dentistae_sessions_v1') {
        void fetchSession();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('storage', onStorage);
    };
  }, [sessionId, isSending, initialQuery]);

  const sendMessage = useCallback(
    async (textToSend: string) => {
      const trimmed = textToSend.trim();
      if (!trimmed || isSending) return;

      hasInteractedRef.current = true;
      setErrorMsg(null);
      setIsSending(true);
      setInputValue('');

      const optimisticUserMsg: ChatMessage = {
        id: `local-${Date.now()}`,
        sessionId,
        sender: 'patient',
        text: trimmed,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticUserMsg]);

      try {
        const data = await apiSendChatMessage({
          sessionId,
          message: trimmed,
        });
        if (Array.isArray(data.messages)) {
          setMessages(data.messages);
        }
      } catch (err) {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Unable to send message. Please try again or call the front desk.',
        );
      } finally {
        setIsSending(false);
      }
    },
    [isSending, sessionId],
  );

  // Ask on load when ?q=... is present and scroll chat into view
  useEffect(() => {
    if (initialQuery && !autoAskedRef.current) {
      autoAskedRef.current = true;
      chatSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      void sendMessage(initialQuery);
    }
  }, [initialQuery, sendMessage]);

  const handleResetChat = () => {
    const fresh = getInitialSessionId(true);
    setSessionId(fresh);
    setMessages([]);
    setErrorMsg(null);
  };

  const openChatBookingFlow = (doctorName?: string) => {
    if (doctorName) {
      setSelectedDoctor(doctorName);
    }
    setBookingDrawerOpen(true);
    chatSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      chatInputRef.current?.focus({ preventScroll: true });
    }, 350);
  };

  const scrollToAppointmentForm = (
    treatmentName?: string,
    opts?: { date?: string; slot?: string; note?: string },
  ) => {
    if (treatmentName) {
      setPreselectedTreatment(treatmentName);
    }
    if (opts?.date) setPreselectedDate(opts.date);
    if (opts?.slot) setPreselectedSlot(opts.slot);
    if (opts?.note) setPreselectedNote(opts.note);
    bookingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const mapTimeToPreferredWindow = (timeStr: string, shortDayName: string): string => {
    if (shortDayName.toLowerCase().startsWith('sun')) {
      return 'Sunday (10:00 AM – 2:00 PM)';
    }
    const lower = timeStr.toLowerCase();
    if (lower.includes('am') || lower.startsWith('12:')) {
      return 'Morning (9:30 AM – 12:30 PM)';
    }
    const hour = parseInt(lower.split(':')[0] || '0', 10);
    if (hour >= 5 && hour < 12) {
      return 'Evening (5:00 PM – 7:30 PM)';
    }
    return 'Afternoon (2:30 PM – 5:00 PM)';
  };

  const handleConfirmSlotBooking = (e: React.FormEvent) => {
    e.preventDefault();
    const doctorPart = selectedDoctor ? ` with ${selectedDoctor}` : '';
    const prompt = `I would like to book an appointment ${selectedDay} at ${selectedTime}${doctorPart}.`;
    setBookingDrawerOpen(false);
    void sendMessage(prompt);
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFbNotice(null);
    if (!fbName.trim() || fbComment.trim().length < 8) {
      setFbNotice('Please enter your name and a brief visit note.');
      return;
    }
    if (!fbConsent) {
      setFbNotice('Please tick the consent box before publishing your feedback.');
      return;
    }
    const next: ConsentFeedbackItem = {
      id: `fb-${Date.now()}`,
      name: fbName.trim(),
      visitType: fbVisitType,
      comment: fbComment.trim(),
      submittedAt: new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
    };
    const updated = [next, ...feedbackItems];
    setFeedbackItems(updated);
    try {
      localStorage.setItem(LS_FEEDBACK_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage quota errors
    }
    setFbName('');
    setFbComment('');
    setFbConsent(false);
    setFbNotice('Thank you! Your consented patient feedback has been recorded.');
  };

  const consultService = clinicData.services.find((s) =>
    s.name.toLowerCase().includes('consult'),
  );
  const consultFee = consultService?.price || '₹500';
  const whatsAppHref = buildWhatsAppLink(clinicData);
  const mapsDirectionsHref = buildGoogleMapsDirectionsLink(clinicData);

  return (
    <div className="bg-[#f8faf9] text-slate-900">
      {/* ============================================================
          SECTION 1: HERO — Headline "Your Smile Deserves Expert Care",
          Banjara Hills Hyderabad, Book Appointment + Call + WhatsApp,
          Real Clinic & Dentist Photographs, Grounded Proof Cards
         ============================================================ */}
      <section className="border-b border-emerald-950/10 bg-white overflow-x-clip">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-10 sm:pt-12 sm:pb-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Left Editorial Column */}
            <div className="lg:col-span-6 flex flex-col justify-between gap-8 py-1">
              <div>
                <p className="text-xs sm:text-sm font-medium text-emerald-800 tracking-wide">
                  Banjara Hills, Hyderabad · Road No. 12
                </p>

                <h1
                  className="mt-3 font-bold tracking-tight text-emerald-950 leading-[1.06]"
                  style={{
                    fontSize: 'clamp(2.3rem, 4.3vw, 3.7rem)',
                    textWrap: 'balance',
                  }}
                >
                  Your Smile Deserves Expert Care
                </h1>

                <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-[52ch]">
                  Personalised specialist dental care in{' '}
                  <span className="font-medium text-slate-800">Banjara Hills, Hyderabad</span>. We
                  combine preventive dentistry, micro-endodontics, implants, and clear aligners
                  with published clinic tariffs and Class-B autoclave sterilisation.
                </p>

                {/* Primary & Direct Contact CTAs: Book Appointment + Call + WhatsApp */}
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => scrollToAppointmentForm()}
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] px-7 py-3 rounded-xl bg-emerald-900 text-white text-sm font-semibold shadow-sm hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Calendar className="w-4 h-4" aria-hidden="true" />
                    <span>Book Appointment</span>
                  </button>

                  <a
                    href={`tel:${clinicData.phone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-xl border border-emerald-950/15 bg-white text-emerald-950 text-sm font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Phone className="w-4 h-4 text-emerald-800" aria-hidden="true" />
                    <span>Call Clinic</span>
                  </a>

                  <a
                    href={whatsAppHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-xl border border-emerald-900/20 bg-emerald-50/80 text-emerald-950 text-sm font-semibold hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* Clean Airy Two-Card Proof Row (100% clinic-file grounded) */}
              <div className="space-y-4">
                <div
                  aria-label="Clinic highlights"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3.5"
                >
                  <div className="rounded-2xl bg-[#f4f8f6] border border-emerald-950/8 p-4 sm:p-5">
                    <p className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-900 tabular-nums">
                      {clinicData.doctors.length} Specialists
                    </p>
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                      MDS Endodontics, Oral Surgery, Orthodontics &amp; preventive family dentistry
                      under one roof.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#f8faf9] border border-emerald-950/8 p-4 sm:p-5">
                    <p className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-900 tabular-nums">
                      {consultFee} Consult
                    </p>
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                      Published tariffs, Class-B sterilisation, ground-floor access &amp; free
                      Road No. 12 valet parking.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-1">
                  <span className="tabular-nums">{clinicData.timings?.weekdays}</span>
                  <span aria-hidden="true">·</span>
                  <a
                    href={`tel:${clinicData.emergencyPhone.replace(/\s+/g, '')}`}
                    className="font-medium text-rose-700 hover:underline tabular-nums"
                  >
                    24/7 Emergency: {clinicData.emergencyPhone}
                  </a>
                </div>
              </div>
            </div>

            {/* Right Visual Column: Sculpted Real Clinic Suite + Lead Dentist Portrait */}
            <div className="lg:col-span-6 flex flex-col gap-3">
              <div className="relative flex-1 min-h-[280px] sm:min-h-[380px] lg:min-h-[460px] rounded-3xl lg:rounded-tl-[4.25rem] lg:rounded-bl-[2.25rem] lg:rounded-r-3xl overflow-hidden border border-emerald-950/10 bg-emerald-950/5">
                {!brokenImages.heroSuite ? (
                  <img
                    src={CLINIC_IMAGES.heroSuite}
                    alt="Modern sunlit dental treatment suite at Dentistae Dental Care in Banjara Hills, Hyderabad"
                    referrerPolicy="no-referrer"
                    onError={() => markImageBroken('heroSuite')}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full min-h-[280px] flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-stone-100 text-emerald-900 p-6 text-center">
                    <Stethoscope className="w-10 h-10 mb-3 opacity-75" aria-hidden="true" />
                    <p className="text-base font-semibold">{clinicData.clinicName}</p>
                    <p className="text-xs text-slate-600 mt-1">{clinicData.address}</p>
                  </div>
                )}

                {/* Measured scrim + Lead Dentist Portrait Pairing */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 sm:p-5">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden border-2 border-white/90 bg-emerald-950/20 shrink-0">
                      {!brokenImages.heroDentist ? (
                        <img
                          src={CLINIC_IMAGES.docAnanya}
                          alt={`${clinicData.doctors[0]?.name || 'Lead Dentist'} at Dentistae Dental Care Banjara Hills`}
                          referrerPolicy="no-referrer"
                          onError={() => markImageBroken('heroDentist')}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-emerald-900 text-white">
                          <Stethoscope className="w-5 h-5" aria-hidden="true" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 text-white">
                      <p className="text-xs sm:text-sm font-semibold truncate">
                        {clinicData.doctors[0]?.name || 'Dr. Ananya Reddy'} &amp; Specialist Team
                      </p>
                      <p className="text-xs text-white/85 truncate mt-0.5">
                        {clinicData.clinicName} · Plot 42, Road No. 12, Banjara Hills
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 2: SERVICES — 6 Dedicated Treatment Pages + Why Choose Us
         ============================================================ */}
      <section
        id="treatments"
        aria-label="Our dental treatments"
        className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 scroll-mt-16"
      >
        <div className="max-w-2xl">
          <p className="text-xs sm:text-sm font-medium text-emerald-800">
            Creating Healthy, Confident Smiles with Precision &amp; Care
          </p>
          <h2
            className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-emerald-950"
            style={{ textWrap: 'balance' }}
          >
            Dental Services &amp; Individual Treatment Guides
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
            Select any treatment to review the clinical process, expected visits, FAQs, and live
            indicative fees from our Banjara Hills clinic file.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURED_TREATMENT_PAGES.map((item) => {
            const matchedService = resolveTreatmentService(item, clinicData);
            const livePrice = matchedService?.price;
            const imgKey = `treat-${item.slug}`;
            const waTreatmentHref = buildWhatsAppLink(
              clinicData,
              `Hello ${clinicData.clinicName}, I would like to enquire about ${item.title}.`,
            );

            return (
              <article
                key={item.slug}
                className="flex flex-col justify-between rounded-2xl bg-white border border-emerald-950/10 overflow-hidden hover:border-emerald-900/25 transition-colors"
              >
                <div>
                  <div className="aspect-[16/10] bg-emerald-950/5 overflow-hidden">
                    {!brokenImages[imgKey] ? (
                      <img
                        src={item.image}
                        alt={`${item.title} at ${clinicData.clinicName} Banjara Hills`}
                        referrerPolicy="no-referrer"
                        onError={() => markImageBroken(imgKey)}
                        className={`w-full h-full object-cover ${item.imagePosition || 'object-center'}`}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-50 to-stone-100 text-emerald-900 p-4">
                        <Stethoscope className="w-8 h-8 opacity-75" aria-hidden="true" />
                      </div>
                    )}
                  </div>

                  <div className="p-5">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-lg font-bold text-emerald-950 tracking-tight">
                        {item.title}
                      </h3>
                      {livePrice && (
                        <span className="text-sm font-bold text-emerald-900 tabular-nums shrink-0">
                          {livePrice}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {item.expectedVisits} · {item.sessionDuration}
                    </p>

                    <p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>
                </div>

                <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectTreatment?.(item.slug)}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl border border-emerald-900/25 bg-white text-xs sm:text-sm font-semibold text-emerald-950 hover:bg-emerald-900 hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>Learn more</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>

                  <a
                    href={waTreatmentHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold text-emerald-800 hover:bg-emerald-50 transition-colors whitespace-nowrap"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        {/* Why Choose Us Strip (grounded, clean surface blocks) */}
        <div className="mt-12 pt-8 border-t border-emerald-950/10">
          <h3 className="text-lg sm:text-xl font-bold text-emerald-950 tracking-tight">
            Why Choose {clinicData.clinicName}
          </h3>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              {
                title: 'Experienced Specialists',
                desc: 'Dedicated MDS Endodontics, Oral Surgery, Orthodontics & general care.',
              },
              {
                title: 'Comfort-First Care',
                desc: 'Gentle local anaesthesia, unhurried consultations & clear explanations.',
              },
              {
                title: 'Modern Equipment',
                desc: 'Digital RVG X-rays, 3D intraoral scanning & Class-B autoclave sterilisation.',
              },
              {
                title: 'Calm Ground-Floor Clinic',
                desc: 'Step-free Road No. 12 access with complimentary valet parking.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl bg-white border border-emerald-950/10 p-4"
              >
                <p className="text-sm font-bold text-emerald-950">{item.title}</p>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 3: LIVE FRONT DESK AI RECEPTIONIST CHAT
          (Preserves #chat-input, #chat-send, .bot-msg, ?q=, Quick Replies)
         ============================================================ */}
      <section
        id="front-desk-chat"
        ref={chatSectionRef}
        aria-label="Front desk chat and clinic quick reference"
        className="border-y border-emerald-950/10 bg-white scroll-mt-16"
      >
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-10 sm:py-14">
          <div className="mb-5 flex flex-col sm:flex-row sm:items-end justify-between gap-2 px-1">
            <div>
              <p className="text-xs font-medium text-emerald-800">
                Instant Front Desk · English, हिन्दी &amp; తెలుగు
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-emerald-950 tracking-tight mt-0.5">
                Ask Our AI Receptionist or Request a Slot
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md">
              Answers strictly from our live clinic file; medical questions and custom enquiries
              route directly to our human front desk for a callback within 2 working hours.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-stretch">
            {/* Desktop Clinic Quick-Reference Sidebar */}
            <aside className="hidden lg:flex flex-col bg-[#f8faf9] border border-emerald-950/10 rounded-2xl overflow-hidden">
              <div className="relative h-40 bg-emerald-950/5 overflow-hidden">
                {!brokenImages.receptionSidebar ? (
                  <img
                    src={CLINIC_IMAGES.reception}
                    alt="Dentistae Dental Care reception lounge in Banjara Hills"
                    referrerPolicy="no-referrer"
                    onError={() => markImageBroken('receptionSidebar')}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-stone-100 text-emerald-900 p-4">
                    <Stethoscope className="w-8 h-8 mb-2 opacity-75" aria-hidden="true" />
                    <span className="text-sm font-semibold">{clinicData.clinicName}</span>
                  </div>
                )}
              </div>

              <div className="p-5 flex-1 flex flex-col gap-5">
                <div>
                  <h3 className="text-lg font-bold text-emerald-950 tracking-tight">
                    {clinicData.clinicName}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">{clinicData.tagline}</p>
                </div>

                <div className="space-y-3.5 text-sm text-slate-700 border-t border-emerald-950/10 pt-4">
                  <div className="flex items-start gap-2.5">
                    <MapPin
                      className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Banjara Hills Clinic</p>
                      <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                        {clinicData.address}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Clock
                      className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Clinic Hours</p>
                      <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                        {clinicData.timings?.weekdays}
                      </p>
                      <p className="text-xs text-slate-600 tabular-nums">
                        {clinicData.timings?.sunday}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Phone
                      className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-medium text-slate-900">Front Desk &amp; Emergency</p>
                      <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                        Desk: {clinicData.phone}
                      </p>
                      <p className="text-xs font-medium text-rose-700 tabular-nums">
                        24/7 Emergency: {clinicData.emergencyPhone}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-emerald-950/10 pt-4 mt-auto space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                    <span>Verified clinic file answers · No invented fees</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openChatBookingFlow()}
                    className="w-full inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 rounded-lg border border-emerald-900/20 bg-white text-xs font-semibold text-emerald-950 hover:bg-emerald-50 transition-colors cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Quick Slot Selector</span>
                  </button>
                </div>
              </div>
            </aside>

            {/* Primary Patient Chat Workspace */}
            <div
              aria-label="Patient reception chat"
              className="flex flex-col bg-white border border-emerald-950/10 rounded-2xl overflow-hidden h-[560px] sm:h-[620px]"
            >
              {/* Chat Header */}
              <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-emerald-950 truncate">
                    Front Desk Reception
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    Timings, doctors, tariffs, insurance &amp; appointment slots
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setBookingDrawerOpen((prev) => !prev)}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[40px] text-xs font-medium text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Book Slot</span>
                  </button>
                  {messages.length > 0 && (
                    <button
                      type="button"
                      onClick={handleResetChat}
                      className="px-3 py-1.5 min-h-[40px] text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      New Chat
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setMobileInfoOpen((prev) => !prev)}
                    aria-expanded={mobileInfoOpen}
                    className="lg:hidden inline-flex items-center gap-1 px-3 py-1.5 min-h-[40px] text-xs font-medium text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Clinic Info</span>
                    {mobileInfoOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {/* Mobile Collapsible Clinic Info Drawer */}
              {mobileInfoOpen && (
                <div className="lg:hidden px-4 py-3 bg-emerald-50/60 border-b border-emerald-950/10 text-xs text-slate-700 space-y-1.5 shrink-0">
                  <p className="font-semibold text-emerald-950">{clinicData.clinicName}</p>
                  <p>{clinicData.address}</p>
                  <p className="tabular-nums">
                    {clinicData.timings?.weekdays} · {clinicData.timings?.sunday}
                  </p>
                  <p className="tabular-nums">
                    Desk: {clinicData.phone} · Emergency: {clinicData.emergencyPhone}
                  </p>
                </div>
              )}

              {/* Inline Quick Slot Booking Bar */}
              {bookingDrawerOpen && (
                <form
                  onSubmit={handleConfirmSlotBooking}
                  className="px-4 sm:px-5 py-3 bg-emerald-50/70 border-b border-emerald-950/10 shrink-0"
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <p className="text-xs font-semibold text-emerald-950">
                      Request an Appointment Slot in Chat
                    </p>
                    <button
                      type="button"
                      onClick={() => setBookingDrawerOpen(false)}
                      aria-label="Close slot selector"
                      className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <select
                      aria-label="Preferred day"
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(e.target.value)}
                      className="h-10 px-2.5 rounded-lg border border-emerald-950/15 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    >
                      {BOOKING_DAYS.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Preferred time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="h-10 px-2.5 rounded-lg border border-emerald-950/15 bg-white text-xs text-slate-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    >
                      {BOOKING_TIMES.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Preferred doctor"
                      value={selectedDoctor}
                      onChange={(e) => setSelectedDoctor(e.target.value)}
                      className="h-10 px-2.5 rounded-lg border border-emerald-950/15 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                    >
                      <option value="">Any Available Dentist</option>
                      {clinicData.doctors.map((doc) => (
                        <option key={doc.id} value={doc.name}>
                          {doc.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={isSending}
                      className="h-10 px-3 rounded-lg bg-emerald-900 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
                    >
                      Confirm Request
                    </button>
                  </div>
                </form>
              )}

              {/* Scrollable Message Stream */}
              <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-4 bg-stone-50/40">
                {/* Welcome Card (does NOT use .bot-msg so .bot-msg is strictly actual answers) */}
                <div className="bg-white border border-slate-200/80 rounded-xl p-4 text-sm text-slate-700">
                  <p className="font-semibold text-emerald-950">
                    Welcome to {clinicData.clinicName}
                  </p>
                  <p className="mt-1 text-slate-600 leading-relaxed">
                    Ask about clinic timings, doctors, treatment prices, insurance reimbursement, or
                    request an appointment. Questions outside our clinic file are routed to our
                    human front desk for a callback within 2 working hours.
                  </p>
                </div>

                {messages.map((msg) => {
                  if (msg.sender === 'patient') {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-sm bg-emerald-900 text-white px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {msg.text}
                        </div>
                      </div>
                    );
                  }

                  const isStaff = msg.sender === 'staff';
                  return (
                    <div key={msg.id} className="flex justify-start">
                      <div
                        className={`bot-msg max-w-[90%] sm:max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed border break-words ${
                          isStaff
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                            : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        {isStaff && (
                          <p className="text-xs font-semibold text-emerald-900 mb-1">
                            Front Desk Staff
                          </p>
                        )}
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                        {msg.fallbackUsed && (
                          <p className="mt-2 pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
                            Answered from the clinic file
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isSending && (
                  <div className="flex justify-start">
                    <div
                      aria-live="polite"
                      className="rounded-2xl rounded-bl-sm bg-white border border-slate-200 px-4 py-2.5 text-xs text-slate-500"
                    >
                      Checking clinic records...
                    </div>
                  </div>
                )}

                {errorMsg && (
                  <div
                    role="alert"
                    className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs text-rose-800"
                  >
                    {errorMsg}
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick-Reply Bar */}
              <div className="px-3 sm:px-5 pt-2.5 pb-1.5 border-t border-slate-100 bg-white shrink-0">
                <div
                  aria-label="Quick questions"
                  className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar"
                >
                  {QUICK_REPLIES.map((qr) => (
                    <button
                      key={qr.label}
                      type="button"
                      data-quick-reply={qr.label}
                      disabled={isSending}
                      onClick={() => void sendMessage(qr.prompt)}
                      className="px-3 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-xs font-medium text-slate-700 hover:text-emerald-950 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      {qr.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Composer */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage(inputValue);
                }}
                className="p-3 sm:px-5 sm:py-3.5 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0"
              >
                <input
                  ref={chatInputRef}
                  id="chat-input"
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask about timings, doctors, prices, or book..."
                  aria-label="Ask the dental clinic front desk"
                  className="flex-1 min-w-0 h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
                />
                <button
                  id="chat-send"
                  type="submit"
                  disabled={isSending || !inputValue.trim()}
                  aria-label="Send message"
                  className="inline-flex items-center justify-center gap-1.5 h-11 min-w-[44px] px-4 rounded-xl bg-emerald-900 text-white text-sm font-medium hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Send className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 4: MEET OUR DENTISTS (Photographs, BDS/MDS Qualifications,
          TSDC Registration Details, Clinical Expertise, Consultation Timings
          & Interactive Nearest Slot Booking)
         ============================================================ */}
      <section
        id="doctors"
        aria-label="Meet our dentists"
        className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 scroll-mt-16"
      >
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs sm:text-sm font-medium text-emerald-800">
              TSDC-Registered Dental Specialists · Banjara Hills, Hyderabad
            </p>
            <h2
              className="mt-1.5 text-2xl sm:text-3xl font-bold tracking-tight text-emerald-950"
              style={{ textWrap: 'balance' }}
            >
              Meet Our Dentists
            </h2>
            <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
              Review each dentist’s BDS/MDS qualifications, Telangana State Dental Council
              registration details, areas of clinical expertise, and live consultation timings
              before requesting your slot.
            </p>
          </div>
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
            All specialist profiles and consultation hours sync live with our Banjara Hills clinic
            file.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {clinicData.doctors.map((doc, idx) => {
            const enrichment = getDoctorEnrichment(doc, idx);
            const imgKey = `doc-${doc.id}`;
            const registrationText =
              doc.registrationNumber?.trim() || enrichment.registrationFallback;
            const expertiseList =
              doc.expertise && doc.expertise.length > 0 ? doc.expertise : enrichment.focusAreas;
            const slotDays = getNearestDoctorSlots(doc);
            const isSlotPickerOpen = activeSlotDoctorId === doc.id;
            const currentPick =
              pickedDoctorSlots[doc.id] ||
              (slotDays[0]
                ? {
                    isoDate: slotDays[0].isoDate,
                    dayLabel: slotDays[0].dayLabel,
                    shortDayName: slotDays[0].shortDayName,
                    time: slotDays[0].times[0],
                  }
                : null);

            return (
              <article
                key={doc.id}
                className="rounded-2xl bg-white border border-emerald-950/10 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Top Profile Header: Portrait + Name + Qualifications (BDS/MDS) + Registration */}
                  <div className="grid grid-cols-1 sm:grid-cols-[176px_1fr] gap-0 border-b border-slate-100">
                    <div className="aspect-[4/3] sm:aspect-auto sm:min-h-[220px] bg-emerald-950/5 overflow-hidden">
                      {!brokenImages[imgKey] ? (
                        <img
                          src={enrichment.portrait}
                          alt={`${doc.name}, ${doc.qualification} at ${clinicData.clinicName}`}
                          referrerPolicy="no-referrer"
                          onError={() => markImageBroken(imgKey)}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <div className="w-full h-full min-h-[180px] flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-stone-100 text-emerald-900 p-4 text-center">
                          <Stethoscope className="w-8 h-8 mb-2 opacity-75" aria-hidden="true" />
                          <span className="text-xs font-semibold">{doc.name}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-5 flex flex-col justify-between gap-3">
                      <div>
                        <h3 className="text-lg sm:text-xl font-bold text-emerald-950 tracking-tight">
                          {doc.name}
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-emerald-800">
                          {doc.specialty}
                        </p>

                        {/* Qualifications (BDS/MDS) */}
                        <div className="mt-3 flex items-start gap-2 text-xs text-slate-700">
                          <Award
                            className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <div>
                            <span className="font-semibold text-slate-900">Qualifications: </span>
                            <span>{doc.qualification}</span>
                          </div>
                        </div>

                        {/* Registration Details */}
                        <div className="mt-2 flex items-start gap-2 text-xs text-slate-700">
                          <ShieldCheck
                            className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <div className="tabular-nums">
                            <span className="font-semibold text-slate-900">Registration: </span>
                            <span>{registrationText}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600 leading-relaxed pt-2 border-t border-slate-100">
                        {enrichment.philosophy}
                      </p>
                    </div>
                  </div>

                  {/* Clinical Expertise + Consultation Timings */}
                  <div className="p-5 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        Areas of Clinical Expertise
                      </p>
                      <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                        {expertiseList.map((area) => (
                          <li
                            key={area}
                            className="flex items-start gap-2 text-xs text-slate-700 leading-snug"
                          >
                            <CheckCircle2
                              className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span>{area}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl bg-[#f4f8f6] border border-emerald-950/8 px-3.5 py-2.5 flex items-start gap-2.5">
                      <Clock
                        className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <div className="text-xs">
                        <p className="font-semibold text-emerald-950">Consultation Timings</p>
                        <p className="text-slate-700 mt-0.5 tabular-nums">{doc.schedule}</p>
                      </div>
                    </div>

                    {/* Expandable Nearest Consultation Slots Picker */}
                    {isSlotPickerOpen && slotDays.length > 0 && currentPick && (
                      <div className="rounded-xl bg-white border border-emerald-900/20 p-4 space-y-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-emerald-950">
                            Nearest Available Slots · {doc.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveSlotDoctorId(null)}
                            aria-label="Close slot picker"
                            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>

                        <div className="space-y-3">
                          {slotDays.map((dayObj) => (
                            <div key={dayObj.isoDate}>
                              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5 tabular-nums">
                                {dayObj.dayLabel}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {dayObj.times.map((slotTime) => {
                                  const isSelected =
                                    currentPick.isoDate === dayObj.isoDate &&
                                    currentPick.time === slotTime;
                                  return (
                                    <button
                                      key={`${dayObj.isoDate}-${slotTime}`}
                                      type="button"
                                      onClick={() =>
                                        setPickedDoctorSlots((prev) => ({
                                          ...prev,
                                          [doc.id]: {
                                            isoDate: dayObj.isoDate,
                                            dayLabel: dayObj.dayLabel,
                                            shortDayName: dayObj.shortDayName,
                                            time: slotTime,
                                          },
                                        }))
                                      }
                                      className={`px-2.5 py-1.5 min-h-[34px] rounded-lg text-xs font-medium tabular-nums border transition-colors cursor-pointer ${
                                        isSelected
                                          ? 'bg-emerald-900 text-white border-emerald-900'
                                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-700 hover:text-emerald-950'
                                      }`}
                                    >
                                      {slotTime}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              scrollToAppointmentForm(enrichment.defaultTreatmentName, {
                                date: currentPick.isoDate,
                                slot: mapTimeToPreferredWindow(
                                  currentPick.time,
                                  currentPick.shortDayName,
                                ),
                                note: `Preferred Dentist: ${doc.name} · Requested Slot: ${currentPick.dayLabel} at ${currentPick.time}`,
                              });
                            }}
                            className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-4 py-2 rounded-lg bg-emerald-900 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors cursor-pointer"
                          >
                            <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              Book {currentPick.dayLabel.split(',')[0]} · {currentPick.time}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDoctor(doc.name);
                              setSelectedDay(currentPick.shortDayName);
                              setSelectedTime(currentPick.time);
                              setActiveSlotDoctorId(null);
                              chatSectionRef.current?.scrollIntoView({
                                behavior: 'smooth',
                                block: 'start',
                              });
                              void sendMessage(
                                `I would like to book an appointment with ${doc.name} on ${currentPick.dayLabel} at ${currentPick.time}.`,
                              );
                            }}
                            className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-lg border border-emerald-950/15 bg-white text-xs font-semibold text-emerald-950 hover:bg-emerald-50 transition-colors cursor-pointer"
                          >
                            <span>Request in Chat</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="px-5 py-3.5 bg-[#f8faf9] border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveSlotDoctorId((prev) => (prev === doc.id ? null : doc.id))
                    }
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-emerald-900 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isSlotPickerOpen ? 'Hide Available Slots' : 'Select Consultation Slot'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openChatBookingFlow(doc.name)}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-xl border border-emerald-950/15 bg-white text-xs font-semibold text-emerald-950 hover:bg-emerald-50 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>Ask Front Desk</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ============================================================
          SECTION 5: CLINIC GALLERY & CONSENT-BASED PATIENT FEEDBACK
         ============================================================ */}
      <section
        id="gallery-reviews"
        aria-label="Clinic gallery and patient feedback"
        className="border-t border-emerald-950/10 bg-white scroll-mt-16"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-12">
          {/* Clinic Gallery */}
          <div>
            <div className="max-w-2xl">
              <p className="text-xs sm:text-sm font-medium text-emerald-800">
                Inside Our Road No. 12 Facility
              </p>
              <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-emerald-950">
                Clinic Environment &amp; Clinical Sterilisation Standards
              </h2>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  key: 'gal-suite',
                  src: CLINIC_IMAGES.heroSuite,
                  title: 'Sunlit Operatory Suite',
                  caption:
                    'Private glass-partitioned treatment suites equipped for micro-endodontics and oral surgery.',
                },
                {
                  key: 'gal-diag',
                  src: CLINIC_IMAGES.diagnosticsBay,
                  title: '3D Diagnostics & Class-B Autoclave Bay',
                  caption:
                    'Glass-visible sterilisation protocol and 3D intraoral scanning for crowns and clear aligners.',
                },
                {
                  key: 'gal-reception',
                  src: CLINIC_IMAGES.reception,
                  title: 'Calm Ground-Floor Reception',
                  caption:
                    'Step-free wheelchair entrance with complimentary valet parking on Road No. 12, Banjara Hills.',
                },
              ].map((photo) => (
                <figure
                  key={photo.key}
                  className="rounded-2xl overflow-hidden border border-emerald-950/10 bg-[#f8faf9]"
                >
                  <div className="aspect-[16/10] bg-emerald-950/5 overflow-hidden">
                    {!brokenImages[photo.key] ? (
                      <img
                        src={photo.src}
                        alt={photo.title}
                        referrerPolicy="no-referrer"
                        onError={() => markImageBroken(photo.key)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-emerald-900 p-4">
                        <Stethoscope className="w-8 h-8 opacity-70" aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <figcaption className="p-4">
                    <p className="text-sm font-bold text-emerald-950">{photo.title}</p>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">{photo.caption}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>

          {/* Patient Reviews & Consent-First Feedback */}
          <div className="pt-8 border-t border-emerald-950/10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6 space-y-5">
              <div>
                <p className="text-xs font-medium text-emerald-800">
                  Ethical Patient Reviews &amp; Consent Policy
                </p>
                <h3 className="mt-1 text-xl sm:text-2xl font-bold text-emerald-950 tracking-tight">
                  Verified Patient Feedback &amp; Google Reviews
                </h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  We never publish fabricated reviews or unconsented clinical before-and-after
                  photographs. Approved clinical case records are reviewed privately during
                  in-clinic consultations, and verified patient reviews are hosted directly on
                  Google Maps.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={mapsDirectionsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl border border-emerald-950/15 bg-white text-sm font-semibold text-emerald-950 hover:bg-emerald-50 transition-colors whitespace-nowrap"
                >
                  <span>View Clinic on Google Maps</span>
                  <ExternalLink className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                </a>
              </div>

              {feedbackItems.length > 0 && (
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <p className="text-xs font-semibold text-slate-500">
                    Consented Patient Notes Submitted on This Device
                  </p>
                  {feedbackItems.map((fb) => (
                    <div
                      key={fb.id}
                      className="rounded-xl bg-[#f8faf9] border border-emerald-950/10 p-4"
                    >
                      <p className="text-sm text-slate-700 leading-relaxed">“{fb.comment}”</p>
                      <p className="mt-2 text-xs text-slate-500">
                        <span className="font-semibold text-emerald-950">{fb.name}</span> ·{' '}
                        {fb.visitType} · {fb.submittedAt}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-6">
              <form
                onSubmit={handleFeedbackSubmit}
                className="rounded-2xl bg-[#f8faf9] border border-emerald-950/10 p-5 sm:p-6 space-y-4"
              >
                <div>
                  <h3 className="text-base font-bold text-emerald-950">
                    Share Your Visit Feedback (With Consent)
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Visited our Banjara Hills clinic recently? Leave a note for our care team.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={fbName}
                    onChange={(e) => setFbName(e.target.value)}
                    placeholder="Your name"
                    aria-label="Your name for feedback"
                    className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                  <select
                    value={fbVisitType}
                    onChange={(e) => setFbVisitType(e.target.value)}
                    aria-label="Visit type"
                    className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  >
                    {clinicData.services.map((srv) => (
                      <option key={srv.id} value={srv.name}>
                        {srv.name}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  rows={3}
                  value={fbComment}
                  onChange={(e) => setFbComment(e.target.value)}
                  placeholder="Share how your consultation or visit went..."
                  aria-label="Feedback note"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
                />

                <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fbConsent}
                    onChange={(e) => setFbConsent(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-emerald-800 focus:ring-emerald-700"
                  />
                  <span>
                    I consent to sharing this feedback with {clinicData.clinicName} and understand
                    no private clinical details should be included.
                  </span>
                </label>

                {fbNotice && (
                  <p className="text-xs font-medium text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{fbNotice}</span>
                  </p>
                )}

                <button
                  type="submit"
                  className="inline-flex items-center justify-center min-h-[42px] px-5 py-2 rounded-xl bg-emerald-900 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-800 transition-colors cursor-pointer"
                >
                  Submit Feedback
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 6: CONTACT, GOOGLE MAPS DIRECTIONS & APPOINTMENT FORM
         ============================================================ */}
      <section
        id="book-appointment"
        ref={bookingSectionRef}
        aria-label="Contact and appointment booking"
        className="border-t border-emerald-950/10 bg-[#f8faf9] scroll-mt-16"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="max-w-2xl mb-8">
            <p className="text-xs sm:text-sm font-medium text-emerald-800">
              Visit Banjara Hills · Capture &amp; Track Enquiries
            </p>
            <h2
              className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-emerald-950"
              style={{ textWrap: 'balance' }}
            >
              Contact &amp; Appointment Booking
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Appointment Enquiry Form (Wired to Lead Dashboard + Staff Queue) */}
            <div className="lg:col-span-7">
              <AppointmentEnquiryForm
                clinicData={clinicData}
                initialTreatment={preselectedTreatment}
                initialDate={preselectedDate}
                initialSlot={preselectedSlot}
                initialNote={preselectedNote}
                source="appointment-form"
              />
            </div>

            {/* Contact, Timings, Emergency & Google Maps Directions Card */}
            <div className="lg:col-span-5 space-y-5">
              <div className="rounded-2xl bg-white border border-emerald-950/10 p-6 space-y-5">
                <div>
                  <p className="text-xs font-medium text-emerald-800">Location &amp; Directions</p>
                  <h3 className="mt-1 text-lg font-bold text-emerald-950">
                    {clinicData.clinicName}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                    {clinicData.address}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{clinicData.landmark}</p>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                    {clinicData.parkingAndAccess}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-1.5 text-sm text-slate-700 tabular-nums">
                  <p className="font-semibold text-emerald-950">Clinic Timings</p>
                  <p>{clinicData.timings?.weekdays}</p>
                  <p>{clinicData.timings?.sunday}</p>
                  <p className="text-xs text-slate-500">{clinicData.timings?.lunchBreak}</p>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-2 text-sm tabular-nums">
                  <p className="font-semibold text-emerald-950">Direct Phone &amp; Emergency</p>
                  <p className="text-slate-700">
                    Front Desk:{' '}
                    <a
                      href={`tel:${clinicData.phone.replace(/\s+/g, '')}`}
                      className="font-semibold text-emerald-900 hover:underline"
                    >
                      {clinicData.phone}
                    </a>
                  </p>
                  <p className="text-rose-700 font-semibold">
                    24/7 Emergency Dental Line:{' '}
                    <a
                      href={`tel:${clinicData.emergencyPhone.replace(/\s+/g, '')}`}
                      className="hover:underline"
                    >
                      {clinicData.emergencyPhone}
                    </a>
                  </p>
                  <p className="text-xs text-slate-500">Email: {clinicData.email}</p>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <a
                    href={mapsDirectionsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-900 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap"
                  >
                    <Navigation className="w-4 h-4" aria-hidden="true" />
                    <span>Get Directions</span>
                  </a>
                  <a
                    href={whatsAppHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-emerald-950/15 bg-white text-emerald-950 text-sm font-semibold hover:bg-emerald-50 transition-colors whitespace-nowrap"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>

              {/* OPD Insurance & Payment Summary */}
              <div className="rounded-2xl bg-white border border-emerald-950/10 p-5 text-xs text-slate-600 space-y-2">
                <p className="text-sm font-bold text-emerald-950">
                  Insurance Reimbursement &amp; Payments
                </p>
                <p className="leading-relaxed">{clinicData.insurance.summary}</p>
                <p className="text-slate-500">
                  Supported Corporate OPD Plans: {clinicData.insurance.partners.join(' · ')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          SECTION 7: QUIET FOOTER
         ============================================================ */}
      <footer className="border-t border-emerald-950/10 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <p className="font-semibold text-emerald-950">{clinicData.clinicName}</p>
            <p className="mt-0.5">
              Plot 42, Road No. 12, Banjara Hills, Hyderabad · {clinicData.phone}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="#treatments" className="hover:text-emerald-950">
              Treatments
            </a>
            <a href="#doctors" className="hover:text-emerald-950">
              Doctors
            </a>
            <a href="#book-appointment" className="hover:text-emerald-950">
              Book Appointment
            </a>
            <a
              href="/staff"
              onClick={(e) => {
                if (onNavigateStaff) {
                  e.preventDefault();
                  onNavigateStaff();
                }
              }}
              className="font-medium text-emerald-900 hover:underline underline-offset-2"
            >
              Staff Desk &amp; Lead Dashboard
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
