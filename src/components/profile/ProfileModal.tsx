'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Sun, Moon, Eye, EyeOff, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
] as const;

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { user, updateProfile, authFetch, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useI18n();

  const [tab, setTab] = useState<'profile' | 'preferences' | 'security'>('profile');

  // Profile tab
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Security tab
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [isPwSaving, setIsPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  // Reset form state whenever the modal opens
  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? '');
    setSaveError(null);
    setSaved(false);
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setPwError(null);
    setPwSaved(false);
    setTab('profile');
  }, [open, user]);

  const initials = (() => {
    const src = user?.name || user?.email || '?';
    return src
      .split(/[\s@._-]+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('');
  })();

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await updateProfile({ name: name.trim() || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      setPwError(t.profile.passwordMismatch);
      return;
    }
    if (newPw.length < 8) {
      setPwError(t.profile.passwordTooShort);
      return;
    }
    setIsPwSaving(true);
    setPwError(null);
    setPwSaved(false);
    try {
      const res = await authFetch('/api/profile/password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? 'Failed to update password');
      }
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setIsPwSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        {/* Gradient top accent */}
        <div
          className="h-[3px] w-full shrink-0"
          style={{ background: 'linear-gradient(90deg, #dd6900 0%, #e8c833 50%, #dd6900 100%)' }}
        />

        <div className="px-6 pt-6 pb-6 space-y-5">
          <DialogHeader>
            <DialogTitle className="text-base">{t.profile.title}</DialogTitle>
          </DialogHeader>

          {/* Avatar + email */}
          <div className="flex items-center gap-4">
            <div
              className="h-14 w-14 shrink-0 rounded-full overflow-hidden flex items-center justify-center text-white text-lg font-bold select-none"
              style={{ background: 'linear-gradient(135deg, #dd6900 0%, #e8c833 100%)' }}
            >
              {user?.avatar ? (
                <Image
                  src={user.avatar}
                  alt="avatar"
                  width={56}
                  height={56}
                  className="object-cover w-full h-full"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-popover-foreground truncate">
                {user?.name || user?.email}
              </p>
              <p className="text-xs text-muted capitalize">{user?.role}</p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex rounded-lg bg-border/40 p-1 gap-1">
            {([
              { id: 'profile',     label: t.profile.tabProfile,     icon: <UserIcon     className="h-3.5 w-3.5" /> },
              { id: 'security',    label: t.profile.tabSecurity,    icon: <LockIcon     className="h-3.5 w-3.5" /> },
              { id: 'preferences', label: t.profile.tabPreferences, icon: <SettingsIcon className="h-3.5 w-3.5" /> },
            ] as const).map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={[
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-all',
                  tab === id
                    ? 'bg-popover text-popover-foreground shadow-sm'
                    : 'text-muted hover:text-popover-foreground',
                ].join(' ')}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* ── Profile tab ───────────────────────────────────────────────── */}
          {tab === 'profile' && (
            <div className="space-y-4">
              <Field label={t.profile.displayName}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.profile.displayNamePlaceholder}
                  disabled={isSaving}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all disabled:opacity-50"
                  style={{
                    background: 'var(--color-input, #f9fafb)',
                    border: '1px solid var(--color-border, #e5e7eb)',
                    color: 'var(--color-popover-foreground, #111827)',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(221,105,0,0.7)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(221,105,0,0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border, #e5e7eb)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </Field>

              <Field label={t.profile.emailLabel} hint={t.common.readOnly}>
                <div
                  className="flex items-center rounded-lg px-3 py-2 text-sm text-muted cursor-not-allowed"
                  style={{ background: 'var(--color-border, #f3f4f6)', opacity: 0.7 }}
                >
                  {user?.email}
                </div>
              </Field>

              {saveError && (
                <p
                  className="rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: 'rgba(220,38,38,0.1)',
                    border: '1px solid rgba(220,38,38,0.25)',
                    color: '#f87171',
                  }}
                >
                  {saveError}
                </p>
              )}

              {saved && (
                <p
                  className="rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    color: '#10b981',
                  }}
                >
                  {t.profile.profileSaved}
                </p>
              )}

              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="group relative w-full overflow-hidden rounded-lg py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #dd6900 0%, #c45e00 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(221,105,0,0.3)',
                }}
                onMouseEnter={(e) => {
                  if (!isSaving) e.currentTarget.style.boxShadow = '0 6px 18px rgba(221,105,0,0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(221,105,0,0.3)';
                }}
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-white/10 transition-transform duration-700 group-hover:translate-x-full" />
                {isSaving ? (
                  <span className="relative flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {t.common.saving}
                  </span>
                ) : (
                  <span className="relative">{t.profile.saveProfile}</span>
                )}
              </button>
            </div>
          )}

          {/* ── Security tab ─────────────────────────────────────────────── */}
          {tab === 'security' && (
            <div className="space-y-4">
              <PasswordField
                id="current-pw"
                label={t.profile.currentPassword}
                value={currentPw}
                onChange={setCurrentPw}
                show={showCurrentPw}
                onToggle={() => setShowCurrentPw((v) => !v)}
                disabled={isPwSaving}
                placeholder={t.profile.currentPasswordPlaceholder}
              />
              <PasswordField
                id="new-pw"
                label={t.profile.newPassword}
                value={newPw}
                onChange={setNewPw}
                show={showNewPw}
                onToggle={() => setShowNewPw((v) => !v)}
                disabled={isPwSaving}
                placeholder={t.profile.newPasswordPlaceholder}
              />
              <PasswordField
                id="confirm-pw"
                label={t.profile.confirmPassword}
                value={confirmPw}
                onChange={setConfirmPw}
                show={showNewPw}
                onToggle={() => setShowNewPw((v) => !v)}
                disabled={isPwSaving}
                placeholder={t.profile.confirmPasswordPlaceholder}
              />

              {pwError && (
                <p
                  className="rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: 'rgba(220,38,38,0.1)',
                    border: '1px solid rgba(220,38,38,0.25)',
                    color: '#f87171',
                  }}
                >
                  {pwError}
                </p>
              )}
              {pwSaved && (
                <p
                  className="rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    color: '#10b981',
                  }}
                >
                  {t.profile.passwordUpdated}
                </p>
              )}

              <button
                onClick={handleChangePassword}
                disabled={isPwSaving || !currentPw || !newPw || !confirmPw}
                className="group relative w-full overflow-hidden rounded-lg py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #dd6900 0%, #c45e00 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(221,105,0,0.3)',
                }}
                onMouseEnter={(e) => {
                  if (!isPwSaving) e.currentTarget.style.boxShadow = '0 6px 18px rgba(221,105,0,0.45)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(221,105,0,0.3)';
                }}
              >
                <span className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-white/10 transition-transform duration-700 group-hover:translate-x-full" />
                {isPwSaving ? (
                  <span className="relative flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    {t.common.updating}
                  </span>
                ) : (
                  <span className="relative">{t.profile.updatePassword}</span>
                )}
              </button>
            </div>
          )}

          {/* ── Preferences tab ───────────────────────────────────────────── */}
          {tab === 'preferences' && (
            <div className="space-y-5">
              {/* Theme */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{t.profile.themeLabel}</p>
                <div className="flex rounded-lg bg-border/40 p-1 gap-1">
                  {([
                    { value: 'light', icon: Sun,  label: t.profile.themeLight },
                    { value: 'dark',  icon: Moon, label: t.profile.themeDark  },
                  ] as const).map(({ value, icon: Icon, label }) => (
                    <button
                      key={value}
                      onClick={() => setTheme(value)}
                      className={[
                        'flex flex-1 items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all',
                        theme === value
                          ? 'bg-popover text-popover-foreground shadow-sm'
                          : 'text-muted hover:text-popover-foreground',
                      ].join(' ')}
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Language */}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {t.profile.languageLabel}
                </p>
                <p className="text-xs text-muted -mt-1">
                  {t.profile.languageNote}
                </p>
                <div className="space-y-1.5 mt-1">
                  {LANGUAGES.map(({ code, label, flag }) => (
                    <button
                      key={code}
                      onClick={() => setLang(code)}
                      className={[
                        'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                        lang === code
                          ? 'text-primary'
                          : 'text-popover-foreground hover:bg-border/40',
                      ].join(' ')}
                      style={
                        lang === code
                          ? { background: 'rgba(221,105,0,0.08)', border: '1px solid rgba(221,105,0,0.3)' }
                          : { border: '1px solid var(--color-border, #e5e7eb)' }
                      }
                    >
                      <span className="text-base leading-none">{flag}</span>
                      <span>{label}</span>
                      {lang === code && <CheckIcon className="ml-auto h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sign out */}
        <div className="border-t border-border px-6 py-3">
          <button
            onClick={() => { onOpenChange(false); logout(); }}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-muted transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            {t.nav.signOut}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Helper components ────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted">{label}</label>
        {hint && (
          <span
            className="rounded px-1 py-0.5 text-[10px] font-medium"
            style={{
              background: 'var(--color-border, #e5e7eb)',
              color: 'var(--color-muted-foreground, #9ca3af)',
            }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── PasswordField ────────────────────────────────────────────────────────────

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  disabled,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-lg px-3 py-2 pr-9 text-sm outline-none transition-all disabled:opacity-50"
          style={{
            background: 'var(--color-input, #f9fafb)',
            border: '1px solid var(--color-border, #e5e7eb)',
            color: 'var(--color-popover-foreground, #111827)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'rgba(221,105,0,0.7)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(221,105,0,0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border, #e5e7eb)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-2.5 flex items-center text-muted transition-colors hover:text-popover-foreground"
          tabIndex={-1}
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
    </Field>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function UserIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
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

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
