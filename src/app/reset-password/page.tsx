'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createAuthClient } from '@/lib/supabase/server';
import { useT } from '@/context/I18nContext';

// Single instance shared between the onAuthStateChange listener and updateUser.
// Two separate createAuthClient() calls produce independent in-memory sessions,
// so the recovery session set on one instance would be invisible to the other.
const supabase = createAuthClient();

type Stage = 'waiting' | 'form' | 'success' | 'invalid';

export default function ResetPasswordPage() {
  const router = useRouter();
  const t = useT();
  const [stage, setStage] = useState<Stage>('waiting');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // onAuthStateChange fires with PASSWORD_RECOVERY when Supabase parses the
    // #access_token=...&type=recovery hash from the email link.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStage('form');
    });

    // Handle the case where the hash has already been consumed before we subscribed.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStage((prev) => prev === 'waiting' ? 'form' : prev);
    });

    // If no recovery event fires within 5 s the link is invalid or already used.
    const timeout = setTimeout(() => {
      setStage((prev) => prev === 'waiting' ? 'invalid' : prev);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== confirm) {
      setError(t.profile.passwordMismatch);
      return;
    }
    if (password.length < 8) {
      setError(t.profile.passwordTooShort);
      return;
    }
    setIsSubmitting(true);
    setError(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (updateError) {
      setError(updateError.message);
    } else {
      setStage('success');
      setTimeout(() => router.push('/login'), 3000);
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
              {t.resetPassword.tagline}
            </p>
          </div>

          {/* Waiting for recovery token */}
          {stage === 'waiting' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8c833] border-t-transparent" />
              <p className="text-sm" style={{ color: '#6b7280' }}>{t.resetPassword.verifying}</p>
            </div>
          )}

          {/* Invalid / expired link */}
          {stage === 'invalid' && (
            <div style={{ animation: 'fadeSlideIn 0.5s cubic-bezier(0.22,1,0.36,1) both' }}>
              <div
                className="mb-6 flex flex-col items-center gap-3 rounded-xl px-6 py-6 text-center"
                style={{
                  background: 'rgba(220,38,38,0.08)',
                  border: '1px solid rgba(220,38,38,0.25)',
                }}
              >
                <XCircleIcon className="h-10 w-10" style={{ color: '#ef4444' }} />
                <p className="text-sm font-medium" style={{ color: '#7f1d1d' }}>
                  {t.resetPassword.invalidTitle}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
                  {t.resetPassword.invalidMessage}
                </p>
              </div>
              <Link
                href="/forgot-password"
                className="block w-full rounded-lg py-2.5 text-center text-sm font-semibold transition-all"
                style={{
                  background: 'linear-gradient(135deg, #dd6900 0%, #c45e00 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 15px rgba(221,105,0,0.3)',
                }}
              >
                {t.resetPassword.requestNewLink}
              </Link>
            </div>
          )}

          {/* New password form */}
          {stage === 'form' && (
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
              style={{ animation: 'fadeSlideIn 0.5s cubic-bezier(0.22,1,0.36,1) both' }}
            >
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

              <PasswordField
                id="password"
                label={t.resetPassword.newPassword}
                placeholder={t.resetPassword.newPasswordPlaceholder}
                value={password}
                onChange={setPassword}
                show={showPassword}
                onToggleShow={() => setShowPassword((v) => !v)}
                disabled={isSubmitting}
              />

              <PasswordField
                id="confirm"
                label={t.resetPassword.confirmPassword}
                placeholder={t.resetPassword.confirmPasswordPlaceholder}
                value={confirm}
                onChange={setConfirm}
                show={showPassword}
                onToggleShow={() => setShowPassword((v) => !v)}
                disabled={isSubmitting}
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative w-full overflow-hidden rounded-lg py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #dd6900 0%, #c45e00 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 15px rgba(221,105,0,0.3)',
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) e.currentTarget.style.boxShadow = '0 6px 20px rgba(221,105,0,0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(221,105,0,0.3)';
                }}
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-white/10 transition-transform duration-700 group-hover:translate-x-full" />
                {isSubmitting ? (
                  <span className="relative flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {t.resetPassword.updating}
                  </span>
                ) : (
                  <span className="relative">{t.resetPassword.setPassword}</span>
                )}
              </button>
            </form>
          )}

          {/* Success */}
          {stage === 'success' && (
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
                  {t.resetPassword.successTitle}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>
                  {t.resetPassword.successMessage}
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
                {t.resetPassword.goToSignIn}
              </Link>
            </div>
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

// ── Sub-components ──────────────────────────────────────────────────────────

interface PasswordFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  disabled: boolean;
}

function PasswordField({ id, label, placeholder, value, onChange, show, onToggleShow, disabled }: PasswordFieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: '#374151' }}>
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <LockIcon className="h-4 w-4" style={{ color: '#9ca3af' }} />
        </span>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          disabled={disabled}
          className="w-full rounded-lg py-2.5 pl-10 pr-10 text-sm outline-none transition-all disabled:opacity-50"
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
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute inset-y-0 right-3 flex items-center transition-colors"
          style={{ color: '#9ca3af' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#6b7280')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────

function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
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

function XCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}
