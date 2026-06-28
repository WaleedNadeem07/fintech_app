'use client';

import { useRouter } from 'next/navigation';

interface NavBarProps {
  rightSlot?: React.ReactNode;
}

export function NavBar({ rightSlot }: NavBarProps) {
  const router = useRouter();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </div>
          <span className="font-semibold text-slate-900">Fintech Wallet</span>
        </div>

        <div className="flex items-center gap-4">
          {rightSlot}
          <button
            onClick={() => router.push('/admin')}
            className="text-sm text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            Admin
          </button>
        </div>
      </div>
    </header>
  );
}
