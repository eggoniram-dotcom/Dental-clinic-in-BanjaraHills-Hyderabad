import { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, MessageCircle } from 'lucide-react';
import { apiCaptureWhatsAppEnquiry, apiCreateLead } from '../lib/clinicApi.ts';
import { DEFAULT_WHATSAPP_MESSAGE, buildWhatsAppLink } from '../lib/clinicCatalog.ts';
import type { ClinicData, LeadEnquiry } from '../types.ts';

interface AppointmentEnquiryFormProps {
  clinicData: ClinicData;
  initialTreatment?: string;
  initialDate?: string;
  initialSlot?: string;
  initialNote?: string;
  source?: 'appointment-form' | 'treatment-page';
}

const PREFERRED_SLOTS = [
  'Morning (9:30 AM – 12:30 PM)',
  'Afternoon (2:30 PM – 5:00 PM)',
  'Evening (5:00 PM – 7:30 PM)',
  'Sunday (10:00 AM – 2:00 PM)',
];

function getTomorrowIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function AppointmentEnquiryForm({
  clinicData,
  initialTreatment,
  initialDate,
  initialSlot,
  initialNote,
  source = 'appointment-form',
}: AppointmentEnquiryFormProps) {
  const treatmentOptions =
    clinicData.services.length > 0
      ? clinicData.services.map((s) => s.name)
      : [
          'Consultation & Oral Check-up',
          'Root Canal Treatment (RCT)',
          'Titanium Dental Implant (Fixture)',
          'In-Office Teeth Whitening',
          'Clear Aligners',
          'Surgical Wisdom Tooth Removal',
        ];

  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [treatment, setTreatment] = useState(
    initialTreatment && treatmentOptions.includes(initialTreatment)
      ? initialTreatment
      : treatmentOptions[0],
  );
  const [preferredDate, setPreferredDate] = useState(() => initialDate || getTomorrowIsoDate());
  const [preferredTime, setPreferredTime] = useState(
    initialSlot && PREFERRED_SLOTS.includes(initialSlot) ? initialSlot : PREFERRED_SLOTS[0],
  );
  const [message, setMessage] = useState(initialNote || '');
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [submittedLead, setSubmittedLead] = useState<{
    lead: LeadEnquiry;
    ticketId?: string;
  } | null>(null);

  useEffect(() => {
    if (initialTreatment && treatmentOptions.includes(initialTreatment)) {
      setTreatment(initialTreatment);
    }
  }, [initialTreatment, clinicData.services]);

  useEffect(() => {
    if (initialDate) {
      setPreferredDate(initialDate);
    }
  }, [initialDate]);

  useEffect(() => {
    if (initialSlot && PREFERRED_SLOTS.includes(initialSlot)) {
      setPreferredTime(initialSlot);
    }
  }, [initialSlot]);

  useEffect(() => {
    if (initialNote) {
      setMessage(initialNote);
    }
  }, [initialNote]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    const trimmedName = patientName.trim();
    const digitsOnly = phone.replace(/\D/g, '');
    if (trimmedName.length < 2) {
      setErrorText('Please enter the patient’s full name.');
      return;
    }
    if (digitsOnly.length < 10 || digitsOnly.length > 13) {
      setErrorText('Please enter a valid 10-digit Indian mobile number.');
      return;
    }
    if (!preferredDate) {
      setErrorText('Please choose a preferred appointment date.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiCreateLead({
        patientName: trimmedName,
        phone: phone.trim(),
        treatment,
        preferredDate,
        preferredTime,
        message: message.trim() || undefined,
        source,
      });
      setSubmittedLead({ lead: res.lead, ticketId: res.ticket?.id });
      setPatientName('');
      setPhone('');
      setMessage('');
    } catch {
      setErrorText(
        'Could not record your request right now. Please call or WhatsApp our front desk directly.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedLead) {
    const waText = `Hello ${clinicData.clinicName}, I just submitted appointment enquiry ${submittedLead.lead.id} for ${submittedLead.lead.treatment} on ${submittedLead.lead.preferredDate} (${submittedLead.lead.preferredTime || 'preferred slot'}). Name: ${submittedLead.lead.patientName}.`;
    const waHref = buildWhatsAppLink(clinicData, waText);

    return (
      <div
        role="status"
        className="rounded-2xl bg-white border border-emerald-950/10 p-6 sm:p-7 space-y-4"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="text-xs font-medium text-emerald-800 tabular-nums">
              Enquiry Recorded · Ref {submittedLead.lead.id}
              {submittedLead.ticketId ? ` · Ticket ${submittedLead.ticketId}` : ''}
            </p>
            <h3 className="text-xl font-bold text-emerald-950 mt-1">
              Appointment Request Received
            </h3>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
              Thank you, <span className="font-medium text-slate-900">{submittedLead.lead.patientName}</span>.
              Our front desk in Banjara Hills has logged your request for{' '}
              <span className="font-medium text-slate-900">{submittedLead.lead.treatment}</span> on{' '}
              <span className="font-medium text-slate-900 tabular-nums">
                {submittedLead.lead.preferredDate}
              </span>
              {submittedLead.lead.preferredTime ? ` (${submittedLead.lead.preferredTime})` : ''} and
              will call back within 2 working hours to confirm your exact chair slot.
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-900 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            <span>Send Confirmation on WhatsApp</span>
          </a>
          <button
            type="button"
            onClick={() => setSubmittedLead(null)}
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            Submit Another Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      className="rounded-2xl bg-white border border-emerald-950/10 p-6 sm:p-7 space-y-4"
    >
      <div>
        <p className="text-xs font-medium text-emerald-800">
          Direct Front Desk Booking · Callback Within 2 Working Hours
        </p>
        <h3 className="text-xl font-bold text-emerald-950 mt-1">
          Book Your Appointment
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 mt-1">
          Your enquiry is saved directly to our clinic lead desk and front-desk ticket queue.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="lead-patient-name"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            Patient Name
          </label>
          <input
            id="lead-patient-name"
            type="text"
            required
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="e.g. Priya Rao"
            className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
          />
        </div>

        <div>
          <label
            htmlFor="lead-phone"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            Mobile Number (WhatsApp / Call)
          </label>
          <input
            id="lead-phone"
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98490 XXXXX"
            className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 tabular-nums placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="lead-treatment"
          className="block text-xs font-medium text-slate-700 mb-1.5"
        >
          Treatment Required
        </label>
        <select
          id="lead-treatment"
          value={treatment}
          onChange={(e) => setTreatment(e.target.value)}
          className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
        >
          {treatmentOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="lead-date"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            Preferred Appointment Date
          </label>
          <input
            id="lead-date"
            type="date"
            required
            min={new Date().toISOString().slice(0, 10)}
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
          />
        </div>

        <div>
          <label
            htmlFor="lead-slot"
            className="block text-xs font-medium text-slate-700 mb-1.5"
          >
            Preferred Time Window
          </label>
          <select
            id="lead-slot"
            value={preferredTime}
            onChange={(e) => setPreferredTime(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
          >
            {PREFERRED_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          htmlFor="lead-message"
          className="block text-xs font-medium text-slate-700 mb-1.5"
        >
          Additional Notes (Optional)
        </label>
        <textarea
          id="lead-message"
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Preferred doctor, parking needs, or best time for our front desk to call..."
          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
        />
      </div>

      {errorText && (
        <p role="alert" className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {errorText}
        </p>
      )}

      <div className="pt-1 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 min-h-[46px] px-6 py-3 rounded-xl bg-emerald-900 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
        >
          <Calendar className="w-4 h-4" aria-hidden="true" />
          <span>{submitting ? 'Submitting Request...' : 'Submit Appointment Request'}</span>
        </button>

        <a
          href={buildWhatsAppLink(
            clinicData,
            `${DEFAULT_WHATSAPP_MESSAGE} (Treatment: ${treatment}, Preferred date: ${preferredDate})`,
          )}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            void apiCaptureWhatsAppEnquiry({
              treatment,
              sourcePage: source === 'treatment-page' ? 'treatment-booking-form' : 'homepage-booking-form',
              prefilledMessage: `${DEFAULT_WHATSAPP_MESSAGE} (Treatment: ${treatment}, Preferred date: ${preferredDate})`,
              patientName: patientName.trim() || undefined,
              phone: phone.trim() || undefined,
            });
          }}
          className="inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-3 rounded-xl border border-emerald-950/15 bg-white text-emerald-950 text-sm font-semibold hover:bg-emerald-50 transition-colors whitespace-nowrap"
        >
          <MessageCircle className="w-4 h-4 text-emerald-700" aria-hidden="true" />
          <span>Enquire on WhatsApp</span>
        </a>
      </div>
    </form>
  );
}
