import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Phone,
  Send,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { apiGetSessionMessages, apiSendChatMessage } from '../lib/clinicApi.ts';
import type { ChatMessage, ClinicData } from '../types.ts';

interface PatientChatPageProps {
  clinicData: ClinicData;
}

const RECEPTION_IMAGE_PATH = '/src/assets/images/dental_clinic_reception_1794933076108.jpg';

const QUICK_REPLIES = [
  { label: 'Clinic timings', prompt: 'What are your clinic timings?' },
  { label: 'Doctors', prompt: 'Which doctors are available at the clinic?' },
  { label: 'Prices', prompt: 'What are your treatment prices?' },
  { label: 'Insurance', prompt: 'How does insurance reimbursement work?' },
  { label: 'Location', prompt: 'Where is the clinic located in Banjara Hills?' },
  { label: 'Book slot', prompt: 'I want to book an appointment tomorrow at 4:00 PM' },
];

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

export function PatientChatPage({ clinicData }: PatientChatPageProps) {
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
  const [imgError, setImgError] = useState(false);

  const autoAskedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending, scrollToBottom]);

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

  // Ask on load when ?q=... is present
  useEffect(() => {
    if (initialQuery && !autoAskedRef.current) {
      autoAskedRef.current = true;
      void sendMessage(initialQuery);
    }
  }, [initialQuery, sendMessage]);

  const handleResetChat = () => {
    const fresh = getInitialSessionId(true);
    setSessionId(fresh);
    setMessages([]);
    setErrorMsg(null);
  };

  return (
    <main className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6 items-stretch">
        {/* Desktop Clinic Sidebar */}
        <aside className="hidden lg:flex flex-col bg-white border border-emerald-950/10 rounded-2xl overflow-hidden">
          <div className="relative h-44 bg-emerald-950/5 overflow-hidden">
            {!imgError ? (
              <img
                src={RECEPTION_IMAGE_PATH}
                alt="Dentistae Dental Care reception lounge in Banjara Hills"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
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
              <h1 className="text-xl font-bold text-emerald-950 tracking-tight">
                {clinicData.clinicName}
              </h1>
              <p className="text-sm text-slate-600 mt-1">{clinicData.tagline}</p>
            </div>

            <div className="space-y-3 text-sm text-slate-700 border-t border-slate-100 pt-4">
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-slate-900">Banjara Hills Clinic</p>
                  <p className="text-xs text-slate-600 leading-relaxed mt-0.5">
                    {clinicData.address}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-slate-900">Clinic Hours</p>
                  <p className="text-xs text-slate-600 mt-0.5">{clinicData.timings?.weekdays}</p>
                  <p className="text-xs text-slate-600">{clinicData.timings?.sunday}</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-medium text-slate-900">Front Desk & Emergency</p>
                  <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                    Desk: {clinicData.phone}
                  </p>
                  <p className="text-xs font-medium text-rose-700 tabular-nums">
                    24/7 Emergency: {clinicData.emergencyPhone}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 mt-auto">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                <span>Verified clinic file answers · English, हिन्दी & తెలుగు</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Primary Patient Chat Workspace */}
        <section
          aria-label="Patient reception chat"
          className="flex flex-col bg-white border border-emerald-950/10 rounded-2xl overflow-hidden h-[calc(100dvh-5.25rem)] lg:h-[680px]"
        >
          {/* Chat Header */}
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-emerald-950 truncate">
                Front Desk Reception
              </h2>
              <p className="text-xs text-slate-500 truncate">
                Road No. 12, Banjara Hills · English, हिन्दी, తెలుగు
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetChat}
                  className="px-3 py-1.5 min-h-[40px] text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  New Chat
                </button>
              )}
              <button
                type="button"
                onClick={() => setMobileInfoOpen((prev) => !prev)}
                aria-expanded={mobileInfoOpen}
                className="lg:hidden inline-flex items-center gap-1 px-3 py-1.5 min-h-[40px] text-xs font-medium text-emerald-900 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
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
              <p>{clinicData.timings?.weekdays} · {clinicData.timings?.sunday}</p>
              <p className="tabular-nums">
                Desk: {clinicData.phone} · Emergency: {clinicData.emergencyPhone}
              </p>
            </div>
          )}

          {/* Scrollable Message Stream */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-4 bg-stone-50/40">
            {/* Welcome Card (intentionally does NOT use .bot-msg so .bot-msg is strictly answers) */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-4 text-sm text-slate-700">
              <p className="font-semibold text-emerald-950">
                Welcome to {clinicData.clinicName}
              </p>
              <p className="mt-1 text-slate-600 leading-relaxed">
                Ask about clinic timings, doctors, treatment prices, insurance reimbursement, or
                request an appointment. Questions outside our clinic file are routed to our human
                front desk for a callback within 2 working hours.
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
                  disabled={isSending}
                  onClick={() => void sendMessage(qr.prompt)}
                  className="px-3 py-2 min-h-[40px] rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-xs font-medium text-slate-700 hover:text-emerald-950 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
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
              className="inline-flex items-center justify-center gap-1.5 h-11 min-w-[44px] px-4 rounded-xl bg-emerald-900 text-white text-sm font-medium hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
