'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';

export default function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth();
  const t = useT();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('loading');
    setError(null);
    try {
      await sendPasswordReset(email);
      setStatus('sent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email');
      setStatus('error');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(232,200,51,0.14),transparent_24%),linear-gradient(180deg,_#080705_0%,_#0f0b08_100%)] px-4 py-12">
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl"
        style={{
          background: '#ffffff',
          boxShadow: '0 25px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.06)',
          animation: 'cardIn 0.7s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        <div
          className="h-[3px] w-full"
          style={{ background: 'linear-gradient(90deg, #dd6900 0%, #e8c833 50%, #dd6900 100%)' }}
        />

        <div className="px-8 pb-8 pt-10">
          <div
            className="mb-8 flex flex-col items-center"
            style={{ animation: 'fadeSlideIn 0.6s 0.1s cubic-bezier(0.22,1,0.36,1) both' }}
          >
            <div className="relative mb-4">
              <div
                className="absolute inset-0 -z-10 scale-150 rounded-full blur-2xl"
                style={{ background: 'radial-gradient(circle, rgba(232,200,51,0.22) 0%, transparent 70%)' }}
              />
              <Image
                src="/jireh_logo.png"
                alt="Jireh Enterprise"
                width={72}
                height={72}
                className="relative drop-shadow-lg"
                priority
              />
            </div>
            <h1 className="text-xl font-semibold tracking-wide" style={{ color: '#1a1209' }}>
              Jireh Enterprise
            </h1>
            <p className="mt-1 text-sm" style={{ color: '#7a6e5f' }}>
              {t.forgotPassword.tagline}
            </p>
          </div>

          {status === 'sent' ? (
            <div style={{ animation: 'fadeSlideIn 0.5s cubic-bezier(0.22,1,0.36,1) both' }}>
              <div
                className="mb-6 flex flex-col items-center gap-3 rounded-xl px-6 py-6 text-center"
                style={{
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.25)',
                }}
              >
                <CheckCircleIcon className="h-10 w-10" style={{ color: '#10b981' }} />
                <p className="text-sm font-medium" style={{ color: '#065f46' }}>
                  {t.forgotPassword.successTitle}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
                  {t.forgotPassword.successSent}{' '}
                  <strong className="font-medium" style={{ color: '#374151' }}>{email}</strong>.{' '}
                  {t.forgotPassword.successFollow}
                </p>
              </div>
              <Link
                href="/login"
                className="block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-all"
                style={{
                  background: 'linear-gradient(135deg, #dd6900 0%, #c45e00 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 15px rgba(221,105,0,0.3)',
                }}
              >
                {t.forgotPassword.backToSignInBtn}
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
              style={{ animation: 'fadeSlideIn 0.6s 0.2s cubic-bezier(0.22,1,0.36,1) both' }}
            >
              <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>
                {t.forgotPassword.description}
              </p>

              {error && (
                <div
                  className="rounded-lg px-4 py-3 text-sm"
                  style={{
                    background: 'rgba(220,38,38,0.1)',
                    border: '1px solid rgba(220,38,38,0.25)',
                    color: '#f87171',
                    animation: 'slideInFromTop 0.3s cubic-bezier(0.22,1,0.36,1) both',
                  }}
                >
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium" style={{ color: '#374151' }}>
                  {t.auth.emailLabel}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                    <MailIcon className="h-4 w-4" style={{ color: '#9ca3af' }} />
                  </span>
                  <input
                    id="email"
                    type="email"
                    placeholder={t.auth.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={status === 'loading'}
                    className="w-full rounded-lg py-2.5 pl-10 pr-4 text-sm outline-none transition-all disabled:opacity-50"
                    style={{
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      color: '#111827',
                      caretColor: '#dd6900',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.border = '1px solid rgba(221,105,0,0.7)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(221,105,0,0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.border = '1px solid #e5e7eb';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={status === 'loading'}
                className="group relative w-full overflow-hidden rounded-lg py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #dd6900 0%, #c45e00 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 15px rgba(221,105,0,0.3)',
                }}
                onMouseEnter={(e) => {
                  if (status !== 'loading') e.currentTarget.style.boxShadow = '0 6px 20px rgba(221,105,0,0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(221,105,0,0.3)';
                }}
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-white/10 transition-transform duration-700 group-hover:translate-x-full" />
                {status === 'loading' ? (
                  <span className="relative flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {t.forgotPassword.sending}
                  </span>
                ) : (
                  <span className="relative">{t.forgotPassword.sendLink}</span>
                )}
              </button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm transition-colors"
                  style={{ color: '#dd6900' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#e8c833')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#dd6900')}
                >
                  {t.forgotPassword.backToSignIn}
                </Link>
              </div>
            </form>
          )}

          <div
            className="mt-8 pt-6 text-center text-xs"
            style={{ borderTop: '1px solid #f3f4f6', color: '#9ca3af' }}
          >
            © {new Date().getFullYear()} {t.common.copyright}
          </div>
        </div>

        <style>{`
          @keyframes cardIn {
            from { opacity: 0; transform: translateY(24px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideInFromTop {
            from { opacity: 0; transform: translateY(-8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}

function MailIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function CheckCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}
