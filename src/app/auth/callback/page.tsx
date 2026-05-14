'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type Step = 'loading' | 'set-password' | 'error';

const USER_CACHE_KEY = 'jireh_user';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [step, setStep]               = useState<Step>('loading');
  const [supabaseToken, setToken]     = useState('');
  const [name, setName]               = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token  = params.get('access_token');
    const type   = params.get('type');

    if (!token || type !== 'invite') {
      setStep('error');
      return;
    }

    setToken(token);
    setStep('set-password');
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }

    setSubmitting(true);
    setError(null);

    try {
      const res  = await fetch('/api/auth/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ supabaseToken, password, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Seed the user cache so the dashboard renders immediately while
      // AuthContext.doRefresh() validates in the background using the cookie.
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data.user));
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo salió mal');
    } finally {
      setSubmitting(false);
    }
  }

  const inputBase: React.CSSProperties = {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    color: '#111827',
    caretColor: '#dd6900',
  };
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border     = '1px solid rgba(221,105,0,0.7)';
    e.currentTarget.style.boxShadow  = '0 0 0 3px rgba(221,105,0,0.1)';
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.border     = '1px solid #e5e7eb';
    e.currentTarget.style.boxShadow  = 'none';
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(232,200,51,0.14),transparent_24%),linear-gradient(180deg,_#080705_0%,_#0f0b08_100%)] px-4 py-12">
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl"
        style={{
          background:  '#ffffff',
          boxShadow:   '0 25px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.06)',
          animation:   'cardIn 0.7s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        {/* Orange gradient top accent — matches LoginCard */}
        <div
          className="h-[3px] w-full"
          style={{ background: 'linear-gradient(90deg, #dd6900 0%, #e8c833 50%, #dd6900 100%)' }}
        />

        <div className="px-8 pb-8 pt-10">
          {/* Logo */}
          <div className="mb-8 flex flex-col items-center">
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
          </div>

          {/* Loading */}
          {step === 'loading' && (
            <div className="flex justify-center py-8">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#dd6900] border-t-transparent" />
            </div>
          )}

          {/* Invalid link */}
          {step === 'error' && (
            <div className="space-y-4 text-center py-4">
              <p className="text-sm" style={{ color: '#cf4528' }}>
                Este enlace de invitación es inválido o ya fue utilizado.
              </p>
              <a
                href="/login"
                className="inline-block text-sm font-medium transition-colors"
                style={{ color: '#dd6900' }}
              >
                Ir al inicio de sesión →
              </a>
            </div>
          )}

          {/* Set password form */}
          {step === 'set-password' && (
            <>
              <p className="mb-6 text-center text-sm" style={{ color: '#6b7280' }}>
                Bienvenido. Establece una contraseña para activar tu cuenta.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div
                    className="rounded-lg px-4 py-3 text-sm"
                    style={{
                      background: 'rgba(220,38,38,0.1)',
                      border:     '1px solid rgba(220,38,38,0.25)',
                      color:      '#f87171',
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* Full name */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium" style={{ color: '#374151' }}>
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    placeholder="Juan Pérez"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    disabled={submitting}
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all disabled:opacity-50"
                    style={inputBase}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium" style={{ color: '#374151' }}>
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      disabled={submitting}
                      className="w-full rounded-lg px-3 py-2.5 pr-10 text-sm outline-none transition-all disabled:opacity-50"
                      style={inputBase}
                      onFocus={onFocus}
                      onBlur={onBlur}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(v => !v)}
                      className="absolute inset-y-0 right-3 flex items-center"
                      style={{ color: '#9ca3af' }}
                    >
                      {showPw ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium" style={{ color: '#374151' }}>
                    Confirmar contraseña
                  </label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Repetir contraseña"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                    disabled={submitting}
                    className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all disabled:opacity-50"
                    style={inputBase}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="group relative mt-2 w-full overflow-hidden rounded-lg py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background:  'linear-gradient(135deg, #dd6900 0%, #c45e00 100%)',
                    color:       '#fff',
                    boxShadow:   '0 4px 15px rgba(221,105,0,0.3)',
                  }}
                  onMouseEnter={e => { if (!submitting) e.currentTarget.style.boxShadow = '0 6px 20px rgba(221,105,0,0.45)'; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 15px rgba(221,105,0,0.3)'; }}
                >
                  <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-white/10 transition-transform duration-700 group-hover:translate-x-full" />
                  {submitting ? (
                    <span className="relative flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Activando cuenta...
                    </span>
                  ) : (
                    <span className="relative">Activar cuenta</span>
                  )}
                </button>
              </form>
            </>
          )}

          <div
            className="mt-8 pt-6 text-center text-xs"
            style={{ borderTop: '1px solid #f3f4f6', color: '#9ca3af' }}
          >
            © {new Date().getFullYear()} Jireh Enterprise
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
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
