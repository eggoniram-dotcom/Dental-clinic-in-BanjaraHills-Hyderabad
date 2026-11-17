import { Phone } from 'lucide-react';

interface TopBarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  emergencyPhone: string;
}

export function TopBar({ currentPath, onNavigate, emergencyPhone }: TopBarProps) {
  const isStaff = currentPath.startsWith('/staff');

  return (
    <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-emerald-950/10">
      <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-8">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/');
          }}
          className="text-lg font-bold tracking-tight text-emerald-950 whitespace-nowrap shrink-0"
        >
          Dentistae
        </a>

        <nav aria-label="Primary" className="flex items-center gap-4 sm:gap-6 text-sm font-medium">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
              !isStaff
                ? 'text-emerald-900 underline underline-offset-4 decoration-2 decoration-emerald-700'
                : 'text-slate-600 hover:text-emerald-950'
            }`}
          >
            Patient Chat
          </a>
          <a
            href="/staff"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/staff');
            }}
            className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
              isStaff
                ? 'text-emerald-900 underline underline-offset-4 decoration-2 decoration-emerald-700'
                : 'text-slate-600 hover:text-emerald-950'
            }`}
          >
            Staff Desk
          </a>
        </nav>

        <div className="shrink-0">
          <a
            href={`tel:${emergencyPhone.replace(/\s+/g, '')}`}
            aria-label={`Emergency dental line ${emergencyPhone}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg bg-emerald-900 text-white text-xs font-medium hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Phone className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="sm:hidden">Emergency</span>
            <span className="hidden sm:inline tabular-nums">Emergency · {emergencyPhone}</span>
          </a>
        </div>
      </div>
    </header>
  );
}
