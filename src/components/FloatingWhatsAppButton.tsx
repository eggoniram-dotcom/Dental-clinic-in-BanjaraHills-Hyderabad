import { MessageCircle } from 'lucide-react';
import { buildWhatsAppLink } from '../lib/clinicCatalog.ts';
import type { ClinicData } from '../types.ts';

interface FloatingWhatsAppButtonProps {
  clinicData: ClinicData;
}

export function FloatingWhatsAppButton({ clinicData }: FloatingWhatsAppButtonProps) {
  const href = buildWhatsAppLink(clinicData);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp Dentistae Dental Care"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 inline-flex items-center justify-center gap-2 min-h-[48px] min-w-[48px] px-3.5 sm:px-4 py-3 rounded-full bg-emerald-800 text-white text-xs sm:text-sm font-semibold shadow-md hover:bg-emerald-900 transition-colors whitespace-nowrap"
    >
      <MessageCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">WhatsApp Us</span>
    </a>
  );
}
