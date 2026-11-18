import { useCallback, useEffect, useState } from 'react';
import { PatientChatPage } from './components/PatientChatPage.tsx';
import { StaffPortalPage } from './components/StaffPortalPage.tsx';
import { TopBar } from './components/TopBar.tsx';
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

  const navigate = useCallback((path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    // Refresh clinic data on navigation so edits stay in sync
    void loadClinicData();
  }, [loadClinicData]);

  const isStaff = currentPath.startsWith('/staff');

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
      ) : (
        <PatientChatPage clinicData={clinicData} />
      )}
    </div>
  );
}
