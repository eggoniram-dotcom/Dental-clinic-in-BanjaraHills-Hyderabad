import { useCallback, useEffect, useState } from 'react';
import { FloatingWhatsAppButton } from './components/FloatingWhatsAppButton.tsx';
import { PatientChatPage } from './components/PatientChatPage.tsx';
import { StaffPortalPage } from './components/StaffPortalPage.tsx';
import { TopBar } from './components/TopBar.tsx';
import { TreatmentDetailPage } from './components/TreatmentDetailPage.tsx';
import { apiGetClinicData } from './lib/clinicApi.ts';
import { normalizeClinicData, type ClinicData } from './types.ts';

const INITIAL_CLINIC_DATA: ClinicData = normalizeClinicData(null);

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/',
  );
  const [clinicData, setClinicData] = useState<ClinicData>(INITIAL_CLINIC_DATA);

  const loadClinicData = useCallback(async () => {
    const data = await apiGetClinicData();
    setClinicData(data);
  }, []);

  useEffect(() => {
    void loadClinicData();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'dentistae_clinic_data_v1') {
        void loadClinicData();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadClinicData]);

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback(
    (path: string, sectionId?: string) => {
      if (window.location.pathname !== path) {
        window.history.pushState({}, '', path);
      }
      setCurrentPath(path);
      void loadClinicData();

      if (sectionId) {
        window.setTimeout(() => {
          const el = document.getElementById(sectionId);
          el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 70);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [loadClinicData],
  );

  const isStaff = currentPath.startsWith('/staff');
  const treatmentMatch = currentPath.match(/^\/treatments\/([^/]+)\/?$/);
  const treatmentSlug = treatmentMatch ? decodeURIComponent(treatmentMatch[1]) : null;

  return (
    <div className="min-h-dvh bg-[#f8faf9] text-slate-900">
      <TopBar
        currentPath={currentPath}
        onNavigate={navigate}
        emergencyPhone={clinicData.emergencyPhone}
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
          onNavigateStaff={() => navigate('/staff')}
          onSelectTreatment={(slug) => navigate(`/treatments/${slug}`)}
        />
      )}

      {!isStaff && <FloatingWhatsAppButton clinicData={clinicData} />}
    </div>
  );
}
