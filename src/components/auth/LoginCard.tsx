'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useT } from '@/context/I18nContext';

interface LoginFormInputs {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface LoginCardProps {
  onLoginSuccess: () => void;
}

export function LoginCard({ onLoginSuccess }: LoginCardProps) {
  const { loginWithEmail } = useAuth();
  const t = useT();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInputs>({
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const onSubmit = async (data: LoginFormInputs) => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await loginWithEmail(data.email, data.password, data.rememberMe);
      onLoginSuccess();
    } catch (err) {
      console.log(err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="w-full max-w-md overflow-hidden rounded-2xl"
      style={{
        background: '#ffffff',
        boxShadow: '0 25px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.06)',
        animation: 'loginCardIn 0.7s cubic-bezier(0.22,1,0.36,1) both',
      }}
    >
      {/* Orange gradient top accent */}
      <div
        className="h-[3px] w-full"
        style={{ background: 'linear-gradient(90deg, #dd6900 0%, #e8c833 50%, #dd6900 100%)' }}
      />

      <div className="px-8 pb-8 pt-10">
        {/* Logo section */}
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
            {t.auth.tagline}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Error message */}
          {errorMessage && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                background: 'rgba(220,38,38,0.1)',
                border: '1px solid rgba(220,38,38,0.25)',
                color: '#f87171',
                animation: 'slideInFromTop 0.3s cubic-bezier(0.22,1,0.36,1) both',
              }}
            >
              {errorMessage}
            </div>
          )}

          {/* Email */}
          <div
            className="space-y-2"
            style={{ animation: 'fadeSlideIn 0.6s 0.2s cubic-bezier(0.22,1,0.36,1) both' }}
          >
            <label htmlFor="email" className="block text-sm font-medium" style={{ color: '#374151' }}>
              {t.auth.emailLabel}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <MailIcon className="h-4 w-4" style={{ color: '#9ca3af' }} />
              </span>
              {(() => {
                const emailReg = register('email', {
                  required: t.auth.emailLabel,
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: t.auth.emailLabel,
                  },
                });
                return (
                  <input
                    {...emailReg}
                    id="email"
                    type="email"
                    placeholder={t.auth.emailPlaceholder}
                    disabled={isSubmitting}
                    aria-invalid={!!errors.email}
                    className="w-full rounded-lg py-2.5 pl-10 pr-4 text-sm outline-none transition-all disabled:opacity-50"
                    style={{
                      background: '#f9fafb',
                      border: errors.email ? '1px solid rgba(220,38,38,0.6)' : '1px solid #e5e7eb',
                      color: '#111827',
                      caretColor: '#dd6900',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.border = '1px solid rgba(221,105,0,0.7)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(221,105,0,0.1)';
                    }}
                    onBlur={(e) => {
                      emailReg.onBlur(e);
                      e.currentTarget.style.border = errors.email
                        ? '1px solid rgba(220,38,38,0.6)'
                        : '1px solid #e5e7eb';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                );
              })()}
            </div>
            {errors.email && (
              <p className="text-xs" style={{ color: '#f87171' }}>{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div
            className="space-y-2"
            style={{ animation: 'fadeSlideIn 0.6s 0.3s cubic-bezier(0.22,1,0.36,1) both' }}
          >
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium" style={{ color: '#374151' }}>
                {t.auth.passwordLabel}
              </label>
              <a
                href="/forgot-password"
                className="text-xs transition-colors"
                style={{ color: '#dd6900' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#e8c833')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#dd6900')}
              >
                {t.auth.forgotPassword}
              </a>
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <LockIcon className="h-4 w-4" style={{ color: '#9ca3af' }} />
              </span>
              {(() => {
                const pwReg = register('password', { required: t.auth.passwordLabel });
                return (
                  <input
                    {...pwReg}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t.auth.passwordPlaceholder}
                    disabled={isSubmitting}
                    aria-invalid={!!errors.password}
                    className="w-full rounded-lg py-2.5 pl-10 pr-10 text-sm outline-none transition-all disabled:opacity-50"
                    style={{
                      background: '#f9fafb',
                      border: errors.password ? '1px solid rgba(220,38,38,0.6)' : '1px solid #e5e7eb',
                      color: '#111827',
                      caretColor: '#dd6900',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.border = '1px solid rgba(221,105,0,0.7)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(221,105,0,0.1)';
                    }}
                    onBlur={(e) => {
                      pwReg.onBlur(e);
                      e.currentTarget.style.border = errors.password
                        ? '1px solid rgba(220,38,38,0.6)'
                        : '1px solid #e5e7eb';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                );
              })()}
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center transition-colors"
                style={{ color: '#9ca3af' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#6b7280')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs" style={{ color: '#f87171' }}>{errors.password.message}</p>
            )}
          </div>

          {/* Remember me */}
          <div
            className="flex items-center gap-2.5"
            style={{ animation: 'fadeSlideIn 0.6s 0.4s cubic-bezier(0.22,1,0.36,1) both' }}
          >
            <input
              id="rememberMe"
              type="checkbox"
              disabled={isSubmitting}
              className="h-4 w-4 rounded disabled:opacity-50"
              style={{ accentColor: '#dd6900' }}
              {...register('rememberMe')}
            />
            <label htmlFor="rememberMe" className="select-none text-sm" style={{ color: '#6b7280' }}>
              {t.auth.rememberMe}
            </label>
          </div>

          {/* Submit button */}
          <div style={{ animation: 'fadeSlideIn 0.6s 0.5s cubic-bezier(0.22,1,0.36,1) both' }}>
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
              {/* Shimmer sweep */}
              <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-white/10 transition-transform duration-700 group-hover:translate-x-full" />
              {isSubmitting ? (
                <span className="relative flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t.auth.signingIn}
                </span>
              ) : (
                <span className="relative">{t.auth.signIn}</span>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div
          className="mt-8 pt-6 text-center text-xs"
          style={{
            borderTop: '1px solid #f3f4f6',
            color: '#9ca3af',
            animation: 'fadeSlideIn 0.6s 0.6s cubic-bezier(0.22,1,0.36,1) both',
          }}
        >
          © {new Date().getFullYear()} {t.common.copyright}
        </div>
      </div>

      <style>{`
        @keyframes loginCardIn {
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
