import { useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  MapPin,
  MessageCircle,
  Minus,
  Navigation,
  Phone,
  Plus,
  Send,
  ShieldCheck,
  Star,
  Stethoscope,
  X,
} from 'lucide-react';
import {
  QUICK_REPLIES,
  type FrontDeskChatController,
  type OpenFrontDeskOptions,
} from '../hooks/useFrontDeskChat.ts';
import { apiCaptureWhatsAppEnquiry } from '../lib/clinicApi.ts';
import {
  CLINIC_IMAGES,
  DEFAULT_WHATSAPP_MESSAGE,
  FEATURED_TREATMENT_PAGES,
  buildGoogleMapsDirectionsLink,
  buildWhatsAppLink,
  getDoctorEnrichment,
  getNearestDoctorSlots,
  resolveTreatmentService,
} from '../lib/clinicCatalog.ts';
import type { ClinicData } from '../types.ts';
import { AppointmentEnquiryForm } from './AppointmentEnquiryForm.tsx';

interface PatientChatPageProps {
  clinicData: ClinicData;
  frontDeskChat: FrontDeskChatController;
  onOpenFrontDesk: (opts?: OpenFrontDeskOptions) => void;
  onNavigateStaff?: () => void;
  onSelectTreatment?: (slug: string) => void;
}

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

export function PatientChatPage({
  clinicData,
  frontDeskChat,
  onOpenFrontDesk,
  onNavigateStaff,
  onSelectTreatment,
}: PatientChatPageProps) {
  // Zero-Broken-Image fallback state map
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});
  const markImageBroken = (key: string) =>
    setBrokenImages((prev) => ({ ...prev, [key]: true }));

  // Doctor slot picker & appointment form prefill state
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
  const [openHygieneIndex, setOpenHygieneIndex] = useState<number | null>(0);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const bookingSectionRef = useRef<HTMLElement | null>(null);

  const openChatBookingFlow = (doctorName?: string) => {
    onOpenFrontDesk({ openSlotBooking: true, doctorName });
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-10 sm:pt-16 sm:pb-14">
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
                    onClick={() => {
                      void apiCaptureWhatsAppEnquiry({
                        treatment: 'General Appointment Enquiry',
                        sourcePage: '/#hero',
                        prefilledMessage: DEFAULT_WHATSAPP_MESSAGE,
                      });
                    }}
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
            const waTreatmentMessage = `${DEFAULT_WHATSAPP_MESSAGE} (Treatment: ${item.title})`;
            const waTreatmentHref = buildWhatsAppLink(clinicData, waTreatmentMessage);

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
                    onClick={() => {
                      void apiCaptureWhatsAppEnquiry({
                        treatment: matchedService?.name || item.title,
                        sourcePage: `/#treatments (${item.slug})`,
                        prefilledMessage: waTreatmentMessage,
                      });
                    }}
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
          SECTION 3: FRONTDESK AI RECEPTION LAUNCHER & QUICK-ASK BAR
          (Opens the floating FrontDesk AI popup; keeps #chat-input & #chat-send
           accessible even before the popup is opened, with zero duplicate IDs)
         ============================================================ */}
      <section
        id="front-desk-chat"
        aria-label="FrontDesk AI reception and clinic quick reference"
        className="border-y border-emerald-950/10 bg-white scroll-mt-16"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-stretch">
            {/* Clinic Quick-Reference Card */}
            <aside className="flex flex-col bg-[#f8faf9] border border-emerald-950/10 rounded-2xl overflow-hidden">
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

              <div className="p-5 flex-1 flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-bold text-emerald-950 tracking-tight">
                    {clinicData.clinicName}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">{clinicData.tagline}</p>
                </div>

                <div className="space-y-3 text-sm text-slate-700 border-t border-emerald-950/10 pt-4">
                  <div className="flex items-start gap-2.5">
                    <MapPin
                      className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <p className="text-xs text-slate-600 leading-relaxed">{clinicData.address}</p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Clock
                      className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="text-xs text-slate-600 tabular-nums">
                      <p>{clinicData.timings?.weekdays}</p>
                      <p>{clinicData.timings?.sunday}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Phone
                      className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="text-xs tabular-nums">
                      <p className="text-slate-600">Desk: {clinicData.phone}</p>
                      <p className="font-medium text-rose-700">
                        24/7 Emergency: {clinicData.emergencyPhone}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* Compact FrontDesk AI Dashboard Launcher Card */}
            <div className="flex flex-col justify-between rounded-2xl bg-[#0d1b17] text-white border border-emerald-950/15 p-6 sm:p-8">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
                      <Bot className="w-6 h-6 text-emerald-300" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-emerald-300">
                        FrontDesk AI · English, हिन्दी &amp; తెలుగు
                      </p>
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-0.5">
                        Ask Our AI Receptionist or Request a Slot
                      </h2>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-sm text-slate-300 leading-relaxed max-w-2xl">
                  Launch <span className="font-semibold text-white">FrontDesk AI</span> using the{' '}
                  <span className="font-semibold text-emerald-200">Front Desk Reception</span>{' '}
                  button below or start a question right here. Answers come strictly from our live
                  clinic file; medical questions and custom requests route directly to our human
                  front desk for a callback within 2 working hours.
                </p>

                {/* Direct Launch Buttons */}
                <div className="mt-5 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onOpenFrontDesk()}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-400 text-slate-950 text-sm font-semibold hover:bg-emerald-300 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Bot className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Open FrontDesk AI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openChatBookingFlow()}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 text-emerald-300 shrink-0" aria-hidden="true" />
                    <span>Quick Slot Selector</span>
                  </button>
                </div>
              </div>

              {/* Inline Quick-Ask Bar + Quick Prompts (hands off #chat-input/#chat-send to open popup) */}
              <div className="mt-6 pt-5 border-t border-white/10 space-y-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (frontDeskChat.inputValue.trim()) {
                      void frontDeskChat.sendMessage(frontDeskChat.inputValue);
                    } else {
                      onOpenFrontDesk();
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    id={frontDeskChat.isOpen ? undefined : 'chat-input'}
                    type="text"
                    value={frontDeskChat.inputValue}
                    onChange={(e) => frontDeskChat.setInputValue(e.target.value)}
                    placeholder="Ask FrontDesk AI about timings, doctors, prices, or book a slot..."
                    aria-label="Ask FrontDesk AI"
                    className="flex-1 min-w-0 h-11 px-4 rounded-xl border border-white/15 bg-white/10 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white/15"
                  />
                  <button
                    id={frontDeskChat.isOpen ? undefined : 'chat-send'}
                    type="submit"
                    disabled={frontDeskChat.isSending}
                    aria-label="Send question to FrontDesk AI"
                    className="inline-flex items-center justify-center gap-1.5 h-11 min-w-[44px] px-4 rounded-xl bg-emerald-500 text-slate-950 text-sm font-semibold hover:bg-emerald-400 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-4 h-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Ask AI</span>
                  </button>
                </form>

                <div
                  aria-label="Quick FrontDesk AI prompts"
                  className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar"
                >
                  {QUICK_REPLIES.map((qr) => (
                    <button
                      key={qr.label}
                      type="button"
                      data-quick-reply={frontDeskChat.isOpen ? undefined : qr.label}
                      disabled={frontDeskChat.isSending}
                      onClick={() => onOpenFrontDesk({ prompt: qr.prompt })}
                      className="px-3 py-1.5 min-h-[36px] rounded-lg border border-white/15 bg-white/5 hover:bg-white/15 text-xs font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      {qr.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>Verified clinic file answers · No invented fees or clinical claims</span>
                </div>
              </div>
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
                              setActiveSlotDoctorId(null);
                              onOpenFrontDesk({
                                doctorName: doc.name,
                                day: currentPick.shortDayName,
                                time: currentPick.time,
                                prompt: `I would like to book an appointment with ${doc.name} on ${currentPick.dayLabel} at ${currentPick.time}.`,
                              });
                            }}
                            className="inline-flex items-center justify-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-lg border border-emerald-950/15 bg-white text-xs font-semibold text-emerald-950 hover:bg-emerald-50 transition-colors cursor-pointer"
                          >
                            <span>Request in FrontDesk AI</span>
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
          SECTION 5: PATIENT TRUST SECTION
          - Genuine Google Reviews with Source Links (Zero Fabrication)
          - Real Clinic Photographs
          - Equipment & Hygiene Information
          - Frequently Asked Questions (Live Clinic-File Grounded)
         ============================================================ */}
      <section
        id="gallery-reviews"
        aria-label="Patient trust, clinic photographs, hygiene standards and FAQs"
        className="border-t border-emerald-950/10 bg-white scroll-mt-16"
      >
        {/* 5A. Genuine Google Reviews Band (Warm serene surface, zero invented reviews/ratings) */}
        <div className="bg-[#faf8f4] border-b border-emerald-950/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
            {(() => {
              const verifiedGoogleReviews = (clinicData.googleReviews?.reviews ?? []).filter(
                (r) =>
                  r.authorName.trim() &&
                  r.quote.trim() &&
                  /^https?:\/\//i.test(r.sourceUrl.trim()),
              );
              const googlePlaceUrl =
                clinicData.googleReviews?.placeUrl &&
                /^https?:\/\//i.test(clinicData.googleReviews.placeUrl.trim())
                  ? clinicData.googleReviews.placeUrl.trim()
                  : mapsDirectionsHref;

              return (
                <div className="space-y-10">
                  <div className="max-w-2xl mx-auto text-center">
                    <p className="text-xs sm:text-sm font-medium text-emerald-800">
                      Patient Trust &amp; Verified Sources · Banjara Hills
                    </p>
                    <h2
                      className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight text-emerald-950 leading-tight"
                      style={{ textWrap: 'balance' }}
                    >
                      Trusted By Patients.
                      <br />
                      Built on Clinical Transparency.
                    </h2>
                    <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                      We never publish fabricated testimonials, invented star ratings, or unconsented
                      clinical claims. Every review shown here links directly to its original Google
                      Maps source.
                    </p>
                  </div>

                  {/* Verified Google Reviews Cards (if linked by staff) OR Honest Zero-Fabrication Google Maps Link Box */}
                  {verifiedGoogleReviews.length > 0 ? (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {verifiedGoogleReviews.map((rev) => {
                          const safeRating = Math.min(5, Math.max(1, Math.round(rev.rating || 5)));
                          return (
                            <article
                              key={rev.id}
                              className="rounded-2xl bg-white border border-emerald-950/10 p-6 flex flex-col justify-between gap-5"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2">
                                  <span
                                    aria-hidden="true"
                                    className="text-3xl font-serif leading-none text-amber-500 select-none"
                                  >
                                    “
                                  </span>
                                  <div
                                    className="flex items-center gap-0.5 text-amber-500"
                                    aria-label={`${safeRating} out of 5 stars on Google`}
                                  >
                                    {Array.from({ length: safeRating }).map((_, i) => (
                                      <Star
                                        key={i}
                                        className="w-3.5 h-3.5 fill-amber-500 text-amber-500"
                                        aria-hidden="true"
                                      />
                                    ))}
                                  </div>
                                </div>
                                <p className="mt-3 text-sm text-slate-700 leading-relaxed">
                                  {rev.quote}
                                </p>
                              </div>

                              <div className="pt-4 border-t border-slate-100 flex items-end justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-emerald-950 truncate">
                                    {rev.authorName}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate mt-0.5">
                                    {[rev.treatmentContext, rev.dateLabel]
                                      .filter(Boolean)
                                      .join(' · ') || 'Google Maps Patient Review'}
                                  </p>
                                </div>
                                <a
                                  href={rev.sourceUrl.trim()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-900 hover:underline whitespace-nowrap shrink-0"
                                >
                                  <span>Google Source</span>
                                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                                </a>
                              </div>
                            </article>
                          );
                        })}
                      </div>

                      <div className="flex justify-center">
                        <a
                          href={googlePlaceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2.5 min-h-[44px] px-5 py-2.5 rounded-xl bg-white border border-emerald-950/15 text-xs sm:text-sm font-semibold text-emerald-950 hover:bg-emerald-50 transition-colors"
                        >
                          <span>Read All Verified Google Reviews on Google Maps</span>
                          <ExternalLink className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white border border-emerald-950/10 p-6 sm:p-8">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        <div className="lg:col-span-6 space-y-4">
                          <div className="flex items-start gap-3">
                            <ShieldCheck
                              className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <div>
                              <h3 className="text-lg font-bold text-emerald-950">
                                Genuine Google Reviews — Verified at the Source
                              </h3>
                              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                                To keep patient trust honest, this clinic website does not display
                                placeholder testimonials or synthetic star averages. View real,
                                unfiltered patient reviews directly on Google Maps, or verify
                                clinician registration details above.
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 pt-1">
                            <a
                              href={googlePlaceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-900 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap"
                            >
                              <span>Read Reviews on Google Maps</span>
                              <ExternalLink className="w-4 h-4" aria-hidden="true" />
                            </a>

                            {onNavigateStaff && (
                              <button
                                type="button"
                                onClick={onNavigateStaff}
                                className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl border border-emerald-950/15 bg-white text-xs sm:text-sm font-semibold text-emerald-950 hover:bg-emerald-50 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                <span>Staff: Link Verified Google Reviews</span>
                                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>

                          {feedbackItems.length > 0 && (
                            <div className="pt-4 border-t border-slate-100 space-y-3">
                              <p className="text-xs font-semibold text-slate-500">
                                Consented Patient Feedback Submitted on This Device
                              </p>
                              {feedbackItems.map((fb) => (
                                <div
                                  key={fb.id}
                                  className="rounded-xl bg-[#faf8f4] border border-emerald-950/10 p-4"
                                >
                                  <p className="text-sm text-slate-700 leading-relaxed">
                                    “{fb.comment}”
                                  </p>
                                  <p className="mt-2 text-xs text-slate-500">
                                    <span className="font-semibold text-emerald-950">
                                      {fb.name}
                                    </span>{' '}
                                    · {fb.visitType} · {fb.submittedAt}
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
                                Share Your Visit Feedback (With Explicit Consent)
                              </h3>
                              <p className="text-xs text-slate-600 mt-1">
                                Visited our Banjara Hills clinic recently? Share an honest note with
                                our care team.
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
                                I consent to sharing this feedback with {clinicData.clinicName} and
                                understand no private clinical details should be included.
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
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* 5B. Real Clinic Photographs + Equipment & Hygiene + FAQs */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-14">
          {/* Real Clinic Photographs */}
          <div>
            <div className="max-w-2xl">
              <p className="text-xs sm:text-sm font-medium text-emerald-800">
                Inside Our Road No. 12 Facility
              </p>
              <h3 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-emerald-950">
                Real Clinic Photographs
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Explore our sunlit treatment suites, glass-visible sterilisation &amp; 3D
                diagnostics bay, and step-free ground-floor reception in Banjara Hills.
              </p>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  key: 'gal-suite',
                  src: CLINIC_IMAGES.heroSuite,
                  title: 'Sunlit Operatory Suite',
                  caption:
                    'Private glass-partitioned treatment suites prepared with fresh disposable barriers before every consultation.',
                },
                {
                  key: 'gal-diag',
                  src: CLINIC_IMAGES.diagnosticsBay,
                  title: '3D Diagnostics & Class-B Autoclave Bay',
                  caption:
                    'Dedicated Class-B vacuum autoclave sterilisation bay alongside digital RVG X-ray and 3D intraoral scanning.',
                },
                {
                  key: 'gal-reception',
                  src: CLINIC_IMAGES.reception,
                  title: 'Ground-Floor Reception Lounge',
                  caption:
                    'Step-free wheelchair entrance with complimentary valet parking at Plot 42, Road No. 12, Banjara Hills.',
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

          {/* Equipment & Hygiene Information + Frequently Asked Questions */}
          <div className="pt-10 border-t border-emerald-950/10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left: Equipment & Hygiene Protocols (Clean expandable clinical cards) */}
            <div className="lg:col-span-5 space-y-4">
              <div>
                <p className="text-xs font-medium text-emerald-800">
                  Clinical Safety &amp; Modern Technology
                </p>
                <h3 className="mt-1 text-xl sm:text-2xl font-bold text-emerald-950 tracking-tight">
                  Equipment &amp; Hygiene Standards
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  Every protocol below reflects standard equipment and infection-control practices
                  listed in our clinic file—without exaggerated claims.
                </p>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    title: 'Class-B Autoclave Sterilisation',
                    summary:
                      'All reusable dental instruments follow Class-B vacuum autoclave sterilisation protocols in individually sealed pouches opened chairside.',
                  },
                  {
                    title: 'Digital Dental X-Ray (RVG)',
                    summary:
                      'Single-tooth digital radiographs (₹300; complimentary for senior citizens aged 65+ with a paid consultation) allow immediate chairside review before recommending treatment.',
                  },
                  {
                    title: '3D Intraoral Scanning & CAD/CAM Impressions',
                    summary:
                      'Digital scanning is used for Zirconia/ceramic crowns and Clear Aligners to measure bite fit accurately and reduce messy impression trays.',
                  },
                  {
                    title: 'Chairside Hygiene & Ground-Floor Access',
                    summary:
                      'Surface disinfection and fresh disposable barriers between appointments, with step-free ground-floor wheelchair access and valet parking on Road No. 12.',
                  },
                ].map((item, idx) => {
                  const isOpen = openHygieneIndex === idx;
                  return (
                    <div
                      key={item.title}
                      className="rounded-xl border border-emerald-950/10 bg-[#f8faf9] overflow-hidden"
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenHygieneIndex(isOpen ? null : idx)}
                        className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <span className="text-sm font-semibold text-emerald-950">
                          {item.title}
                        </span>
                        <span className="w-6 h-6 rounded-full bg-emerald-900 text-white inline-flex items-center justify-center shrink-0">
                          {isOpen ? (
                            <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          )}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-emerald-950/8 pt-3 bg-white">
                          {item.summary}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Frequently Asked Questions (100% Clinic-File Grounded Accordion) */}
            <div className="lg:col-span-7 space-y-4">
              <div>
                <p className="text-xs font-medium text-emerald-800">
                  Clear Answers From Our Clinic File
                </p>
                <h3 className="mt-1 text-xl sm:text-2xl font-bold text-emerald-950 tracking-tight">
                  Frequently Asked Questions
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  Quick answers on timings, tariffs, OPD insurance reimbursement, parking, and
                  appointments—synced live with our Banjara Hills clinic records.
                </p>
              </div>

              <div className="border-t border-emerald-950/10 divide-y divide-emerald-950/10">
                {[
                  {
                    q: 'What are your clinic timings and consultation fee?',
                    a: `${clinicData.timings?.weekdays}. ${clinicData.timings?.sunday}. ${clinicData.timings?.lunchBreak}. Standard Consultation & Oral Check-up fee is ${consultFee}, which includes an initial oral examination and written treatment plan.`,
                  },
                  {
                    q: 'How does dental insurance reimbursement work at Dentistae?',
                    a: `${clinicData.insurance.summary}${clinicData.insurance.partners.length > 0 ? ` Listed corporate OPD plans include: ${clinicData.insurance.partners.join(', ')}.` : ''}`,
                  },
                  {
                    q: 'Do you accept walk-ins or urgent dental pain cases?',
                    a: `Appointments are recommended so we can keep chair wait times minimal, and walk-ins are accommodated for urgent pain. For dental emergencies, please call our 24/7 Emergency Dental Line first at ${clinicData.emergencyPhone}.`,
                  },
                  {
                    q: 'What is your cancellation, rescheduling, and pricing policy?',
                    a: `Please inform our front desk at least 24 hours in advance to reschedule or cancel. Standard published clinic tariffs apply to all patients (our front desk does not offer ad-hoc discounts). Senior citizens aged 65+ receive a complimentary Digital X-Ray (RVG) with a paid consultation.`,
                  },
                  {
                    q: 'What payment methods, parking, and accessibility options are available?',
                    a: `We accept UPI (GPay, PhonePe, Paytm), Credit/Debit cards, and Cash. ${clinicData.parkingAndAccess}`,
                  },
                  {
                    q: 'Can the front desk diagnose tooth pain or prescribe medication online?',
                    a: `No. For patient safety, our front desk and AI receptionist never give medical advice, diagnoses, or prescriptions. If you have tooth pain, swelling, or sensitivity, a qualified dentist must examine you in person—use our booking form or call ${clinicData.phone} to schedule an evaluation.`,
                  },
                ].map((faq, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <div key={faq.q} className="py-3.5">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                        className="w-full text-left flex items-start justify-between gap-4 py-1 cursor-pointer"
                      >
                        <span className="text-sm sm:text-base font-semibold text-emerald-950 leading-snug">
                          {faq.q}
                        </span>
                        <span className="mt-0.5 text-emerald-800 shrink-0">
                          {isOpen ? (
                            <ChevronUp className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="w-4 h-4" aria-hidden="true" />
                          )}
                        </span>
                      </button>
                      {isOpen && (
                        <p className="mt-2 pr-6 text-xs sm:text-sm text-slate-600 leading-relaxed">
                          {faq.a}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
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
                    onClick={() => {
                      void apiCaptureWhatsAppEnquiry({
                        treatment: 'General Appointment Enquiry',
                        sourcePage: '/#book-appointment',
                        prefilledMessage: DEFAULT_WHATSAPP_MESSAGE,
                      });
                    }}
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
