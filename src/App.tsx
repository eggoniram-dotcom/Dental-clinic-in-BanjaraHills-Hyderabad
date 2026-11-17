import { useCallback, useEffect, useState } from 'react';
import { PatientChatPage } from './components/PatientChatPage.tsx';
import { StaffPortalPage } from './components/StaffPortalPage.tsx';
import { TopBar } from './components/TopBar.tsx';
import { normalizeClinicData, type ClinicData } from './types.ts';

const INITIAL_CLINIC_DATA: ClinicData = normalizeClinicData(null);

export default function App() {
  const [currentPath, setCurrentPath] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/',
  );
  const [clinicData, setClinicData] = useState<ClinicData>(INITIAL_CLINIC_DATA);

  const loadClinicData = useCallback(async () => {
    try {
      const res = await fetch('/api/clinic-data');
      if (res.ok) {
        const data = (await res.json()) as Partial<ClinicData>;
        setClinicData(normalizeClinicData(data));
      }
    } catch {
      // Keep fallback initial clinic data
    }
  }, []);

  useEffect(() => {
    void loadClinicData();
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
