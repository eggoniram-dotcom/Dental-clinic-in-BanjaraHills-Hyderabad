import { useCallback, useEffect, useRef, useState } from 'react';
import { FrontDeskPopupPanel } from './components/FloatingFrontDeskChat.tsx';
import {
  WhatsAppPopupPanel,
  WhatsAppTriggerButton,
} from './components/FloatingWhatsAppButton.tsx';
import { PatientChatPage } from './components/PatientChatPage.tsx';
import { StaffPortalPage } from './components/StaffPortalPage.tsx';
import { TopBar, type NavSectionId } from './components/TopBar.tsx';
import { TreatmentDetailPage } from './components/TreatmentDetailPage.tsx';
import { useFrontDeskChat } from './hooks/useFrontDeskChat.ts';
import { apiGetClinicData, apiGetNotifications } from './lib/clinicApi.ts';
import { normalizeClinicData, type ClinicData } from './types.ts';

const INITIAL_CLINIC_DATA: ClinicData = normalizeClinicData(null);
const HEADER_HEIGHT = 56;
const HOME_SECTION_ORDER: Exclude<NavSectionId, 'home' | 'staff'>[] = [
  'treatments',
  'front-desk-chat',
  'doctors',
  'gallery-reviews',
  'book-appointment',
];

function isHomeSectionId(value: string): value is Exclude<NavSectionId, 'home' | 'staff'> {
  return (HOME_SECTION_ORDER as string[]).includes(value);
}

function getInitialSection(): NavSectionId {
  if (typeof window === 'undefined') return 'home';
  const path = window.location.pathname;
  if (path.startsWith('/staff')) return 'staff';
  if (path.startsWith('/treatments/')) return 'treatments';
  const hash = window.location.hash.replace(/^#/, '');
  if (isHomeSectionId(hash)) return hash;
  return 'home';
}

function scrollToElementBelowHeader(sectionId: string, behavior: ScrollBehavior = 'smooth'): boolean {
  const el = document.getElementById(sectionId);
  if (!el) return false;
  const top = Math.max(0, el.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT);
  window.scrollTo({ top, behavior });
  return true;
}

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/',
  );
  const [activeSection, setActiveSection] = useState<NavSectionId>(getInitialSection);
  const [clinicData, setClinicData] = useState<ClinicData>(INITIAL_CLINIC_DATA);
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [whatsAppOpen, setWhatsAppOpen] = useState(false);
  const manualNavLockUntilRef = useRef<number>(0);

  const isStaff = currentPath.startsWith('/staff');
  const treatmentMatch = currentPath.match(/^\/treatments\/([^/]+)\/?$/);
  const treatmentSlug = treatmentMatch ? decodeURIComponent(treatmentMatch[1]) : null;

  const frontDeskChat = useFrontDeskChat(!isStaff);

  const loadClinicData = useCallback(async () => {
    const data = await apiGetClinicData();
    setClinicData(data);
  }, []);

  const loadUnreadAlerts = useCallback(async () => {
    const list = await apiGetNotifications();
    setUnreadAlerts(list.filter((n) => !n.read).length);
  }, []);

  useEffect(() => {
    void loadClinicData();
    void loadUnreadAlerts();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'dentistae_clinic_data_v1') {
        void loadClinicData();
      }
      if (e.key === 'dentistae_notifications_v1') {
        void loadUnreadAlerts();
      }
    };
    const onNotifEvent = () => {
      void loadUnreadAlerts();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('dentistae:notifications-updated', onNotifEvent);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('dentistae:notifications-updated', onNotifEvent);
    };
  }, [loadClinicData, loadUnreadAlerts]);

  // If the page loads directly with a hash like /#doctors, align it directly beneath the fixed header.
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash && window.location.pathname === '/') {
      const timer = window.setTimeout(() => {
        scrollToElementBelowHeader(hash, 'auto');
      }, 60);
      return () => window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const nextPath = window.location.pathname;
      const hash = window.location.hash.replace(/^#/, '');
      setCurrentPath(nextPath);
      if (nextPath.startsWith('/staff')) {
        setActiveSection('staff');
      } else if (nextPath.startsWith('/treatments/')) {
        setActiveSection('treatments');
      } else if (isHomeSectionId(hash)) {
        setActiveSection(hash);
        window.setTimeout(() => scrollToElementBelowHeader(hash, 'smooth'), 50);
      } else {
        setActiveSection('home');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Keep the active Header / Navigation Bar item in sync with the section displayed beneath it.
  useEffect(() => {
    if (isStaff) {
      setActiveSection('staff');
      return;
    }
    if (treatmentSlug) {
      setActiveSection('treatments');
      return;
    }

    const updateActiveFromScroll = () => {
      if (Date.now() < manualNavLockUntilRef.current) return;

      const probeY = HEADER_HEIGHT + 36;
      let next: NavSectionId = 'home';
      for (const id of HOME_SECTION_ORDER) {
        const el = document.getElementById(id);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= probeY) {
          next = id;
        }
      }
      setActiveSection(next);
    };

    window.addEventListener('scroll', updateActiveFromScroll, { passive: true });
    return () => window.removeEventListener('scroll', updateActiveFromScroll);
  }, [isStaff, treatmentSlug]);

  const navigate = useCallback(
    (path: string, sectionId?: string) => {
      const targetUrl = sectionId ? `${path}#${sectionId}` : path;
      const currentFull = `${window.location.pathname}${window.location.hash}`;
      if (currentFull !== targetUrl) {
        window.history.pushState({}, '', targetUrl);
      }

      const routeChanged = window.location.pathname !== currentPath || path !== currentPath;
      setCurrentPath(path);

      if (path.startsWith('/staff')) {
        setActiveSection('staff');
      } else if (path.startsWith('/treatments/')) {
        setActiveSection('treatments');
      } else if (sectionId && isHomeSectionId(sectionId)) {
        setActiveSection(sectionId);
      } else {
        setActiveSection('home');
      }

      void loadClinicData();
      void loadUnreadAlerts();

      if (sectionId) {
        manualNavLockUntilRef.current = Date.now() + 700;
        const attemptScroll = () => {
          if (!scrollToElementBelowHeader(sectionId, 'smooth')) {
            window.setTimeout(() => {
              scrollToElementBelowHeader(sectionId, 'smooth');
            }, 80);
          }
        };

        if (routeChanged) {
          window.requestAnimationFrame(() => {
            window.setTimeout(attemptScroll, 40);
          });
        } else {
          window.requestAnimationFrame(attemptScroll);
        }
      } else {
        manualNavLockUntilRef.current = Date.now() + 500;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [currentPath, loadClinicData, loadUnreadAlerts],
  );

  return (
    <div className="min-h-dvh pt-14 bg-[#f8faf9] text-slate-900">
      <TopBar
        currentPath={currentPath}
        activeSection={activeSection}
        onNavigate={navigate}
        emergencyPhone={clinicData.emergencyPhone}
        unreadAlerts={unreadAlerts}
        frontDeskOpen={frontDeskChat.isOpen}
        onToggleFrontDesk={() => {
          setWhatsAppOpen(false);
          frontDeskChat.toggleOpen();
        }}
      />

      {isStaff ? (
        <StaffPortalPage
          clinicData={clinicData}
          onClinicDataUpdated={(updated) => setClinicData(updated)}
        />
      ) : treatmentSlug ? (
        <TreatmentDetailPage
          slug={treatmentSlug}
          clinicData={clinicData}
          onNavigateHome={(sectionId) => navigate('/', sectionId)}
          onSelectTreatment={(slug) => navigate(`/treatments/${slug}`)}
        />
      ) : (
        <PatientChatPage
          clinicData={clinicData}
          frontDeskChat={frontDeskChat}
          onOpenFrontDesk={(opts) => {
            setWhatsAppOpen(false);
            frontDeskChat.openChat(opts);
          }}
          onNavigateStaff={() => navigate('/staff')}
          onSelectTreatment={(slug) => navigate(`/treatments/${slug}`)}
        />
      )}

      {!isStaff && (
        <div className="fixed top-16 right-3 sm:right-6 z-40 flex flex-col items-end gap-2.5 max-w-[calc(100vw-1.5rem)]">
          {!frontDeskChat.isOpen && (
            <WhatsAppTriggerButton
              isOpen={whatsAppOpen}
              onClick={() => {
                frontDeskChat.closeChat();
                setWhatsAppOpen((prev) => !prev);
              }}
            />
          )}

          {frontDeskChat.isOpen && (
            <FrontDeskPopupPanel clinicData={clinicData} chat={frontDeskChat} />
          )}
          {whatsAppOpen && (
            <WhatsAppPopupPanel
              clinicData={clinicData}
              currentPath={currentPath}
              onClose={() => setWhatsAppOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
