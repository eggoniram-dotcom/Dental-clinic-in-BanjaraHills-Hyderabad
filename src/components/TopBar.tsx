import { useEffect, useState } from 'react';
import { Menu, Phone, X } from 'lucide-react';

export type NavSectionId =
  | 'home'
  | 'treatments'
  | 'front-desk-chat'
  | 'doctors'
  | 'gallery-reviews'
  | 'book-appointment'
  | 'staff';

interface TopBarProps {
  currentPath: string;
  activeSection: NavSectionId;
  onNavigate: (path: string, sectionId?: string) => void;
  emergencyPhone: string;
  unreadAlerts?: number;
}

interface NavItem {
  id: NavSectionId;
  label: string;
  href: string;
  path: string;
  sectionId?: string;
}

const SECTION_NAV_ITEMS: NavItem[] = [
  { id: 'treatments', label: 'Treatments', href: '/#treatments', path: '/', sectionId: 'treatments' },
  {
    id: 'front-desk-chat',
    label: 'Front Desk',
    href: '/#front-desk-chat',
    path: '/',
    sectionId: 'front-desk-chat',
  },
  { id: 'doctors', label: 'Doctors', href: '/#doctors', path: '/', sectionId: 'doctors' },
  {
    id: 'gallery-reviews',
    label: 'Reviews',
    href: '/#gallery-reviews',
    path: '/',
    sectionId: 'gallery-reviews',
  },
  {
    id: 'book-appointment',
    label: 'Contact',
    href: '/#book-appointment',
    path: '/',
    sectionId: 'book-appointment',
  },
];

export function TopBar({
  currentPath,
  activeSection,
  onNavigate,
  emergencyPhone,
  unreadAlerts = 0,
}: TopBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isStaff = currentPath.startsWith('/staff') || activeSection === 'staff';
  const isTreatmentRoute = currentPath.startsWith('/treatments/');

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [currentPath, activeSection]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  const handleSelect = (path: string, sectionId?: string) => {
    setMobileMenuOpen(false);
    onNavigate(path, sectionId);
  };

  const isItemActive = (id: NavSectionId) => {
    if (id === 'staff') return isStaff;
    if (id === 'treatments') return isTreatmentRoute || activeSection === 'treatments';
    return !isStaff && !isTreatmentRoute && activeSection === id;
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-14 bg-white/95 backdrop-blur-md border-b border-emerald-950/10 shadow-[0_1px_2px_rgba(16,42,33,0.05)]">
      <div className="max-w-6xl mx-auto h-full px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-6">
        {/* Zone 1: Single-element brand wordmark */}
        <a
          href="/"
          aria-current={!isStaff && !isTreatmentRoute && activeSection === 'home' ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            handleSelect('/');
          }}
          className="text-base sm:text-lg font-bold tracking-tight text-emerald-950 whitespace-nowrap shrink-0"
        >
          Dentistae
        </a>

        {/* Zone 2: Concise single-line nav links */}
        <nav
          aria-label="Primary"
          className="flex items-center gap-3 md:gap-5 lg:gap-6 text-xs sm:text-sm font-medium"
        >
          {SECTION_NAV_ITEMS.map((item) => {
            const active = isItemActive(item.id);
            const mobileVisibility =
              item.id === 'front-desk-chat' ? 'inline-block' : 'hidden md:inline-block';

            return (
              <a
                key={item.id}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  handleSelect(item.path, item.sectionId);
                }}
                className={`${mobileVisibility} whitespace-nowrap shrink-0 py-1 transition-colors ${
                  active
                    ? 'text-emerald-900 font-semibold underline underline-offset-4 decoration-2 decoration-emerald-700'
                    : 'text-slate-600 hover:text-emerald-950'
                }`}
              >
                {item.label}
              </a>
            );
          })}

          <a
            href="/staff"
            aria-current={isStaff ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              handleSelect('/staff');
            }}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 py-1 transition-colors ${
              isStaff
                ? 'text-emerald-900 font-semibold underline underline-offset-4 decoration-2 decoration-emerald-700'
                : 'text-slate-600 hover:text-emerald-950'
            }`}
          >
            <span>Staff Desk</span>
            {unreadAlerts > 0 && (
              <span
                aria-label={`${unreadAlerts} unread receptionist alerts`}
                className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-800 text-white text-[10px] font-bold tabular-nums"
              >
                {unreadAlerts}
              </span>
            )}
          </a>
        </nav>

        {/* Zone 3: Emergency line + mobile section drawer toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <a
            href={`tel:${emergencyPhone.replace(/\s+/g, '')}`}
            aria-label={`Emergency dental line ${emergencyPhone}`}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 min-h-[38px] sm:min-h-[40px] rounded-lg bg-emerald-900 text-white text-xs font-medium hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="sm:hidden">Call</span>
            <span className="hidden sm:inline lg:hidden">Emergency</span>
            <span className="hidden lg:inline tabular-nums">Emergency · {emergencyPhone}</span>
          </a>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-panel"
            className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg border border-emerald-950/15 bg-white text-emerald-950 hover:bg-emerald-50 transition-colors shrink-0"
          >
            {mobileMenuOpen ? (
              <X className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Menu className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile navigation panel directly beneath the fixed Header / Navigation Bar */}
      {mobileMenuOpen && (
        <div
          id="mobile-nav-panel"
          className="md:hidden border-b border-emerald-950/10 bg-white/98 backdrop-blur-md shadow-lg"
        >
          <nav
            aria-label="Mobile sections"
            className="max-w-6xl mx-auto px-3 py-2.5 grid grid-cols-2 gap-1.5"
          >
            <a
              href="/"
              aria-current={!isStaff && !isTreatmentRoute && activeSection === 'home' ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                handleSelect('/');
              }}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                !isStaff && !isTreatmentRoute && activeSection === 'home'
                  ? 'bg-emerald-900 text-white'
                  : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-950'
              }`}
            >
              Home
            </a>

            {SECTION_NAV_ITEMS.map((item) => {
              const active = isItemActive(item.id);
              return (
                <a
                  key={item.id}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    handleSelect(item.path, item.sectionId);
                  }}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-emerald-900 text-white'
                      : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-950'
                  }`}
                >
                  {item.id === 'gallery-reviews' ? 'Reviews & FAQs' : item.label}
                </a>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
