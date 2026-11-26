import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGetSessionMessages, apiSendChatMessage } from '../lib/clinicApi.ts';
import type { ChatMessage } from '../types.ts';

export const QUICK_REPLIES = [
  { label: 'Clinic timings', prompt: 'What are your clinic timings?' },
  { label: 'Doctors', prompt: 'Which doctors are available at the clinic?' },
  { label: 'Prices', prompt: 'What are your treatment prices?' },
  { label: 'Insurance', prompt: 'How does insurance reimbursement work?' },
  { label: 'Location', prompt: 'Where is the clinic located in Banjara Hills?' },
  { label: 'Book slot', prompt: 'I want to book an appointment tomorrow at 4:00 PM' },
  { label: 'हिन्दी (समय)', prompt: 'क्लिनिक का समय और कंसल्टेशन फीस क्या है?' },
  { label: 'తెలుగు (వేళలు)', prompt: 'క్లినిక్ వేళలు మరియు ధరలు చెప్పండి' },
];

export const BOOKING_DAYS = [
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

export const BOOKING_TIMES = [
  '10:00 AM',
  '11:30 AM',
  '12:30 PM',
  '3:00 PM',
  '4:30 PM',
  '6:00 PM',
  '7:00 PM',
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

export interface OpenFrontDeskOptions {
  openSlotBooking?: boolean;
  doctorName?: string;
  day?: string;
  time?: string;
  prompt?: string;
}

export interface FrontDeskChatController {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleOpen: () => void;
  openChat: (opts?: OpenFrontDeskOptions) => void;
  closeChat: () => void;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  bookingDrawerOpen: boolean;
  setBookingDrawerOpen: (open: boolean) => void;
  selectedDay: string;
  setSelectedDay: (day: string) => void;
  selectedTime: string;
  setSelectedTime: (time: string) => void;
  selectedDoctor: string;
  setSelectedDoctor: (doctor: string) => void;
  messages: ChatMessage[];
  inputValue: string;
  setInputValue: (val: string) => void;
  isSending: boolean;
  errorMsg: string | null;
  sendMessage: (text: string) => Promise<void>;
  resetChat: () => void;
  confirmSlotBooking: () => void;
}

export function useFrontDeskChat(enabled: boolean): FrontDeskChatController {
  const initialQuery =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('q')?.trim() || ''
      : '';

  const [isOpen, setIsOpen] = useState<boolean>(() => Boolean(initialQuery));
  const [isExpanded, setIsExpanded] = useState(false);
  const [bookingDrawerOpen, setBookingDrawerOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState('Tomorrow');
  const [selectedTime, setSelectedTime] = useState('4:30 PM');
  const [selectedDoctor, setSelectedDoctor] = useState('');

  const [sessionId, setSessionId] = useState<string>(() =>
    getInitialSessionId(Boolean(initialQuery)),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const autoAskedRef = useRef(false);

  // Poll active session so staff replies from /staff appear live
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const fetchSession = async () => {
      try {
        const loaded = await apiGetSessionMessages(sessionId);
        if (active && Array.isArray(loaded)) {
          setMessages((prev) => {
            if (prev.length === loaded.length) return prev;
            if (isSending && loaded.length < prev.length) return prev;
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
  }, [enabled, sessionId, isSending, initialQuery]);

  const sendMessage = useCallback(
    async (textToSend: string) => {
      const trimmed = textToSend.trim();
      if (!trimmed || isSending) return;

      setIsOpen(true);
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

  // Auto-open and answer when ?q=... is passed in the URL
  useEffect(() => {
    if (enabled && initialQuery && !autoAskedRef.current) {
      autoAskedRef.current = true;
      setIsOpen(true);
      void sendMessage(initialQuery);
    }
  }, [enabled, initialQuery, sendMessage]);

  const openChat = useCallback(
    (opts?: OpenFrontDeskOptions) => {
      if (opts?.doctorName !== undefined) setSelectedDoctor(opts.doctorName);
      if (opts?.day) setSelectedDay(opts.day);
      if (opts?.time) setSelectedTime(opts.time);
      if (opts?.openSlotBooking) setBookingDrawerOpen(true);
      setIsOpen(true);
      if (opts?.prompt) {
        void sendMessage(opts.prompt);
      }
    },
    [sendMessage],
  );

  const closeChat = useCallback(() => setIsOpen(false), []);
  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);

  const resetChat = useCallback(() => {
    const fresh = getInitialSessionId(true);
    setSessionId(fresh);
    setMessages([]);
    setErrorMsg(null);
    setBookingDrawerOpen(false);
  }, []);

  const confirmSlotBooking = useCallback(() => {
    const doctorPart = selectedDoctor ? ` with ${selectedDoctor}` : '';
    const prompt = `I would like to book an appointment ${selectedDay} at ${selectedTime}${doctorPart}.`;
    setBookingDrawerOpen(false);
    void sendMessage(prompt);
  }, [selectedDay, selectedDoctor, selectedTime, sendMessage]);

  return {
    isOpen,
    setIsOpen,
    toggleOpen,
    openChat,
    closeChat,
    isExpanded,
    setIsExpanded,
    bookingDrawerOpen,
    setBookingDrawerOpen,
    selectedDay,
    setSelectedDay,
    selectedTime,
    setSelectedTime,
    selectedDoctor,
    setSelectedDoctor,
    messages,
    inputValue,
    setInputValue,
    isSending,
    errorMsg,
    sendMessage,
    resetChat,
    confirmSlotBooking,
  };
}
