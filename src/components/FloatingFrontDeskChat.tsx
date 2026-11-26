import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Maximize2,
  Minimize2,
  Phone,
  RotateCcw,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  BOOKING_DAYS,
  BOOKING_TIMES,
  QUICK_REPLIES,
  type FrontDeskChatController,
} from '../hooks/useFrontDeskChat.ts';
import type { ClinicData } from '../types.ts';

interface FrontDeskPopupPanelProps {
  clinicData: ClinicData;
  chat: FrontDeskChatController;
}

interface FrontDeskTriggerButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

const STARTER_CARDS = [
  {
    title: 'Clinic timings & hours',
    subtitle: 'Mon–Sat & Sunday consultation schedule',
    prompt: 'What are your clinic timings?',
  },
  {
    title: 'Specialist dentists',
    subtitle: 'MDS qualifications & consultation slots',
    prompt: 'Which doctors are available at the clinic?',
  },
  {
    title: 'Treatment tariffs',
    subtitle: 'Consultations, implants, RCT & whitening',
    prompt: 'What are your treatment prices?',
  },
  {
    title: 'Book an appointment',
    subtitle: 'Request a preferred day & time slot',
    prompt: 'I want to book an appointment tomorrow at 4:00 PM',
  },
];

export function FrontDeskPopupPanel({ clinicData, chat }: FrontDeskPopupPanelProps) {
  const [clinicInfoOpen, setClinicInfoOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        chat.closeChat();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [chat.messages, chat.isSending]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 100);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      role="dialog"
      aria-label="FrontDesk AI — Ask Our AI Receptionist or Request a Slot"
      className={`flex flex-col rounded-2xl bg-white border border-slate-900/15 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.32)] overflow-hidden transition-[width] duration-200 ${
        chat.isExpanded
          ? 'w-[min(560px,calc(100vw-1.5rem))] h-[min(640px,calc(100dvh-8rem))]'
          : 'w-[min(420px,calc(100vw-1.5rem))] h-[min(560px,calc(100dvh-8rem))]'
      }`}
    >
      {/* Dashboard-Style Obsidian Header */}
      <div className="px-4 py-3.5 bg-[#0d1b17] text-white border-b border-white/10 shrink-0">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-emerald-300" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-bold tracking-tight text-white truncate">
                  FrontDesk AI
                </h3>
                <span className="text-[11px] text-emerald-300/90 font-medium whitespace-nowrap">
                  · {clinicData.clinicName.split(' ')[0]}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                Ask Our AI Receptionist or Request a Slot
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {chat.messages.length > 0 && (
              <button
                type="button"
                onClick={chat.resetChat}
                title="Start new conversation"
                aria-label="Start new FrontDesk AI conversation"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => chat.setIsExpanded(!chat.isExpanded)}
              title={chat.isExpanded ? 'Compact view' : 'Expand view'}
              aria-label={chat.isExpanded ? 'Compact FrontDesk AI' : 'Expand FrontDesk AI'}
              className="hidden sm:inline-flex p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              {chat.isExpanded ? (
                <Minimize2 className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="w-4 h-4" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={chat.closeChat}
              aria-label="Close FrontDesk AI"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Compact Action Toolbar inside Header */}
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
          <span className="text-[11px] text-slate-300 truncate">
            English · हिन्दी · తెలుగు
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => chat.setBookingDrawerOpen(!chat.bookingDrawerOpen)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                chat.bookingDrawerOpen
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-white/10 text-emerald-100 hover:bg-white/15'
              }`}
            >
              <Calendar className="w-3 h-3" aria-hidden="true" />
              <span>Book Slot</span>
            </button>
            <button
              type="button"
              onClick={() => setClinicInfoOpen((prev) => !prev)}
              aria-expanded={clinicInfoOpen}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 text-[11px] font-medium text-slate-200 hover:bg-white/15 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>Clinic Info</span>
              {clinicInfoOpen ? (
                <ChevronUp className="w-3 h-3" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3 h-3" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Clinic Info Drawer */}
      {clinicInfoOpen && (
        <div className="px-4 py-3 bg-[#f4f8f6] border-b border-emerald-950/10 text-xs text-slate-700 space-y-1.5 shrink-0">
          <div className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-emerald-800 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-snug">{clinicData.address}</p>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-3.5 h-3.5 text-emerald-800 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="tabular-nums">
              {clinicData.timings?.weekdays} · {clinicData.timings?.sunday}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="w-3.5 h-3.5 text-emerald-800 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="tabular-nums">
              Desk: {clinicData.phone} ·{' '}
              <span className="font-semibold text-rose-700">
                24/7 Emergency: {clinicData.emergencyPhone}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Inline Quick Slot Booking Bar */}
      {chat.bookingDrawerOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            chat.confirmSlotBooking();
          }}
          className="px-4 py-3 bg-emerald-50/80 border-b border-emerald-950/10 shrink-0"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-semibold text-emerald-950">
              Request an Appointment Slot
            </p>
            <button
              type="button"
              onClick={() => chat.setBookingDrawerOpen(false)}
              aria-label="Close slot selector"
              className="p-0.5 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="Preferred day"
              value={chat.selectedDay}
              onChange={(e) => chat.setSelectedDay(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-emerald-950/15 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              {BOOKING_DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
            <select
              aria-label="Preferred time"
              value={chat.selectedTime}
              onChange={(e) => chat.setSelectedTime(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-emerald-950/15 bg-white text-xs text-slate-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-700"
            >
              {BOOKING_TIMES.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            <select
              aria-label="Preferred doctor"
              value={chat.selectedDoctor}
              onChange={(e) => chat.setSelectedDoctor(e.target.value)}
              className="col-span-2 h-9 px-2.5 rounded-lg border border-emerald-950/15 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
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
              disabled={chat.isSending}
              className="col-span-2 h-9 px-3 rounded-lg bg-[#0d1b17] text-white text-xs font-semibold hover:bg-emerald-900 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Confirm Slot Request in FrontDesk AI
            </button>
          </div>
        </form>
      )}

      {/* Scrollable Message Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 bg-[#f7f9f8]">
        {/* Greeting Card (does NOT use .bot-msg so .bot-msg stays strictly on actual replies) */}
        <div className="rounded-xl bg-white border border-slate-200/80 p-3.5 text-xs sm:text-sm text-slate-700">
          <p className="text-[11px] font-semibold text-emerald-800">
            FrontDesk AI · {clinicData.clinicName}
          </p>
          <p className="font-bold text-slate-950 text-sm mt-0.5">
            Ask Our AI Receptionist or Request a Slot
          </p>
          <p className="mt-1 text-xs text-slate-600 leading-relaxed">
            Ask about clinic timings, doctors, treatment tariffs, insurance reimbursement, or
            request an appointment. Medical questions route directly to our human front desk for
            a callback within 2 working hours.
          </p>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>Grounded strictly in our live clinic file</span>
          </div>
        </div>

        {/* Dashboard-style 2x2 Starter Prompt Grid when conversation is fresh */}
        {chat.messages.length === 0 && (
          <div className="grid grid-cols-2 gap-2" aria-label="Suggested starter questions">
            {STARTER_CARDS.map((card) => (
              <button
                key={card.title}
                type="button"
                disabled={chat.isSending}
                onClick={() => void chat.sendMessage(card.prompt)}
                className="text-left rounded-xl bg-white border border-slate-200/90 hover:border-emerald-600/50 hover:bg-emerald-50/40 p-3 transition-colors cursor-pointer disabled:opacity-50"
              >
                <p className="text-xs font-semibold text-slate-900 leading-snug">
                  {card.title}
                </p>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2">
                  {card.subtitle}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Message Bubbles */}
        {chat.messages.map((msg) => {
          if (msg.sender === 'patient') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#0d1b17] text-white px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {msg.text}
                </div>
              </div>
            );
          }

          const isStaff = msg.sender === 'staff';
          return (
            <div key={msg.id} className="flex justify-start items-end gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#0d1b17] text-emerald-300 flex items-center justify-center shrink-0 mb-0.5">
                <Bot className="w-3.5 h-3.5" aria-hidden="true" />
              </div>
              <div
                className={`bot-msg max-w-[86%] rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed border break-words ${
                  isStaff
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-white border-slate-200 text-slate-800'
                }`}
              >
                <p
                  className={`text-[11px] font-semibold mb-1 ${
                    isStaff ? 'text-emerald-900' : 'text-slate-500'
                  }`}
                >
                  {isStaff ? 'Front Desk Staff' : 'FrontDesk AI'}
                </p>
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

        {chat.isSending && (
          <div className="flex justify-start items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#0d1b17] text-emerald-300 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5" aria-hidden="true" />
            </div>
            <div
              aria-live="polite"
              className="rounded-2xl rounded-bl-sm bg-white border border-slate-200 px-3.5 py-2 text-xs text-slate-500"
            >
              FrontDesk AI is checking clinic records...
            </div>
          </div>
        )}

        {chat.errorMsg && (
          <div
            role="alert"
            className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-800"
          >
            {chat.errorMsg}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Horizontal Quick-Reply Chips */}
      <div className="px-3.5 pt-2 pb-1.5 border-t border-slate-100 bg-white shrink-0">
        <div
          aria-label="Quick questions"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar"
        >
          {QUICK_REPLIES.map((qr) => (
            <button
              key={qr.label}
              type="button"
              data-quick-reply={qr.label}
              disabled={chat.isSending}
              onClick={() => void chat.sendMessage(qr.prompt)}
              className="px-2.5 py-1.5 min-h-[34px] rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-xs font-medium text-slate-700 hover:text-emerald-950 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {qr.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dashboard-Style Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void chat.sendMessage(chat.inputValue);
        }}
        className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 shrink-0"
      >
        <input
          ref={inputRef}
          id="chat-input"
          type="text"
          value={chat.inputValue}
          onChange={(e) => chat.setInputValue(e.target.value)}
          placeholder="Ask FrontDesk AI about timings, doctors, or slots..."
          aria-label="Ask FrontDesk AI"
          className="flex-1 min-w-0 h-10 px-3.5 rounded-xl border border-slate-300 bg-slate-50/60 focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700"
        />
        <button
          id="chat-send"
          type="submit"
          disabled={chat.isSending || !chat.inputValue.trim()}
          aria-label="Send message to FrontDesk AI"
          className="inline-flex items-center justify-center gap-1.5 h-10 min-w-[42px] px-3.5 rounded-xl bg-[#0d1b17] text-white text-xs sm:text-sm font-medium hover:bg-emerald-900 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
}

export function FrontDeskTriggerButton({ isOpen, onClick }: FrontDeskTriggerButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      aria-label="Front Desk Reception — Open FrontDesk AI"
      className="inline-flex items-center justify-center gap-1.5 sm:gap-2 min-h-[40px] sm:min-h-[42px] px-3 sm:px-3.5 py-2 rounded-full bg-[#0d1b17] text-white text-xs sm:text-sm font-semibold shadow-md border border-emerald-400/25 hover:bg-emerald-950 transition-colors whitespace-nowrap cursor-pointer"
    >
      <Bot className="w-4 h-4 text-emerald-300 shrink-0" aria-hidden="true" />
      <span>Front Desk Reception</span>
    </button>
  );
}
