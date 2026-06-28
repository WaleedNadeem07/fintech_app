'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { NavBar } from './NavBar';

export function UserSelector() {
  const router = useRouter();
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) router.push(`/${trimmed}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="flex items-center justify-center p-4 pt-16">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-4">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Fintech Wallet</h1>
          <p className="text-slate-500 mt-1.5 text-sm">
            Enter a User ID to view the dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="User ID"
            placeholder="Paste a user ID (e.g. cm4abc123…)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <Button type="submit" className="w-full" size="lg" disabled={!value.trim()}>
            Load Dashboard
          </Button>
        </form>

        <p className="text-xs text-center text-slate-400 mt-6">
          Create a user via{' '}
          <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600">
            POST /api/users
          </code>{' '}
          to get an ID
        </p>
      </div>
      </div>
    </div>
  );
}
