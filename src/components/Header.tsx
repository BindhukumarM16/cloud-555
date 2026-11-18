import React from 'react';

export type AppTab = 'lab' | 'liveness' | 'test-plan' | 'guide';

interface HeaderProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onNewCheck: () => void;
}

const NAV_ITEMS: Array<{ id: AppTab; label: string }> = [
  { id: 'lab', label: 'Verification Lab' },
  { id: 'liveness', label: 'Liveness Check' },
  { id: 'test-plan', label: 'Test Plan' },
  { id: 'guide', label: 'Demo Guide' },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  onNewCheck,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Single-element brand wordmark */}
        <a
          href="#lab"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('lab');
          }}
          className="text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          DeepGuard
        </a>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav
          aria-label="Primary"
          className="flex items-center gap-6 overflow-x-auto sm:gap-8"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1.5 text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded ${
                  isActive
                    ? 'text-sky-400 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-sky-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onNewCheck}
            className="rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-sky-500 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            New Check
          </button>
        </div>
      </div>
    </header>
  );
};
