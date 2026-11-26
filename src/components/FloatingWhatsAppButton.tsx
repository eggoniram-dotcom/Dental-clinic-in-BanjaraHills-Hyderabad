import { useState } from 'react';
import { CheckCircle2, ExternalLink, MessageCircle, X } from 'lucide-react';
import { apiCaptureWhatsAppEnquiry } from '../lib/clinicApi.ts';
import { DEFAULT_WHATSAPP_MESSAGE, buildWhatsAppLink } from '../lib/clinicCatalog.ts';
import type { ClinicData } from '../types.ts';

interface WhatsAppPopupPanelProps {
  clinicData: ClinicData;
  currentPath?: string;
  onClose: () => void;
}

interface WhatsAppTriggerButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function WhatsAppPopupPanel({
  clinicData,
  currentPath = '/',
  onClose,
}: WhatsAppPopupPanelProps) {
  const [visitorName, setVisitorName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
  const [capturedRef, setCapturedRef] = useState<string | null>(null);

  const trimmedName = visitorName.trim();
  const trimmedPhone = visitorPhone.trim();
  const composedMessage = trimmedName
    ? `${DEFAULT_WHATSAPP_MESSAGE} (Name: ${trimmedName})`
    : DEFAULT_WHATSAPP_MESSAGE;

  const waHref = buildWhatsAppLink(clinicData, composedMessage);

  const handleLaunchWhatsApp = () => {
    void apiCaptureWhatsAppEnquiry({
      treatment: 'WhatsApp Appointment Enquiry',
      sourcePage: currentPath || '/',
      prefilledMessage: composedMessage,
      patientName: trimmedName || undefined,
      phone: trimmedPhone || undefined,
    }).then((res) => {
      setCapturedRef(res.lead.id);
    });
  };

  return (
    <div
      role="dialog"
      aria-label="WhatsApp quick appointment enquiry"
      className="w-[330px] max-w-[calc(100vw-1.5rem)] rounded-2xl bg-white border border-emerald-950/15 shadow-xl overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-emerald-900 text-white flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-bold truncate">{clinicData.clinicName} · WhatsApp</p>
            <p className="text-[11px] text-emerald-100 truncate">Banjara Hills Reception Desk</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close WhatsApp panel"
          className="p-1 rounded-lg text-emerald-100 hover:text-white hover:bg-emerald-800 cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 space-y-3">
        {/* Exact Pre-filled Message Preview */}
        <div className="rounded-xl bg-[#f4f8f6] border border-emerald-950/10 p-3 text-xs text-slate-700 leading-relaxed">
          <p className="text-[11px] font-semibold text-emerald-900 mb-1">
            Pre-filled WhatsApp Message
          </p>
          <p>“{composedMessage}”</p>
        </div>

        {/* Optional Quick Details for Receptionist Follow-up */}
        <div className="grid grid-cols-1 gap-2">
          <input
            type="text"
            value={visitorName}
            onChange={(e) => setVisitorName(e.target.value)}
            placeholder="Your name (optional)"
            aria-label="Your name for WhatsApp enquiry"
            className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
          <input
            type="tel"
            value={visitorPhone}
            onChange={(e) => setVisitorPhone(e.target.value)}
            placeholder="Mobile number for callback (optional)"
            aria-label="Mobile number for WhatsApp enquiry"
            className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 tabular-nums placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700"
          />
        </div>

        {capturedRef && (
          <p
            role="status"
            className="text-[11px] font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-2 flex items-start gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Enquiry {capturedRef} captured &amp; clinic receptionist notified in Staff Desk.
            </span>
          </p>
        )}

        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLaunchWhatsApp}
          className="w-full inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs sm:text-sm font-semibold hover:bg-emerald-800 transition-colors"
        >
          <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Start WhatsApp Chat</span>
          <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        </a>

        <p className="text-[11px] text-slate-500 text-center">
          Automatically logs your enquiry &amp; alerts our front-desk receptionist.
        </p>
      </div>
    </div>
  );
}

export function WhatsAppTriggerButton({ isOpen, onClick }: WhatsAppTriggerButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      aria-label="WhatsApp Dentistae Dental Care"
      className="inline-flex items-center justify-center gap-2 min-h-[46px] sm:min-h-[48px] px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-full bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-lg hover:bg-emerald-800 transition-colors whitespace-nowrap cursor-pointer"
    >
      <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" aria-hidden="true" />
      <span>WhatsApp</span>
    </button>
  );
}
