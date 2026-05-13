'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Users, Layers, FileText, Receipt,
  CreditCard, ChevronLeft, Menu, X, Sun, Moon, LogOut,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { useT } from '@/context/I18nContext';

// ─── Nav items ────────────────────────────────────────────────────────────────


const SIDEBAR_KEY = 'jireh_sidebar';

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const t = useT();

  const NAV = [
    { label: t.nav.dashboard,  href: '/dashboard',           icon: LayoutDashboard, exact: true },
    { label: t.nav.clients,    href: '/dashboard/clients',    icon: Users },
    { label: t.nav.plans,      href: '/dashboard/plans',      icon: Layers },
    { label: t.nav.contracts,  href: '/dashboard/contracts',  icon: FileText },
    { label: t.nav.invoices,   href: '/dashboard/invoices',   icon: Receipt },
    { label: t.nav.payments,   href: '/dashboard/payments',   icon: CreditCard },
  ] as const;

  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const initialized = useRef(false);

  // Auth guard
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  // Restore sidebar preference from localStorage (client-only)
  useEffect(() => {
    setMounted(true);
    if (!initialized.current) {
      initialized.current = true;
      const stored = localStorage.getItem(SIDEBAR_KEY);
      if (stored !== null) setExpanded(stored === 'true');
    }
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleSidebar() {
    setExpanded((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  }

  // Full-page spinner while no user at all
  if (isLoading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#dd6900] border-t-transparent" />
      </div>
    );
  }

  // ── Sidebar content (shared between desktop and mobile drawer) ──────────────
  const SidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className={`flex items-center gap-2 px-4 py-4 ${expanded ? '' : 'justify-center px-0'}`}>
        <Image src="/jireh_logo.png" alt="Jireh" width={32} height={32} priority />
        {expanded && (
          <span className="text-base font-bold text-popover-foreground">Jireh ERP</span>
        )}
      </div>

      {/* Nav links */}
      <nav className="mt-2 flex-1 space-y-0.5 px-2">
        {NAV.map(({ label, href, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              title={!expanded ? label : undefined}
              className={[
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:bg-border/60 hover:text-popover-foreground',
                !expanded && 'justify-center px-0',
              ].filter(Boolean).join(' ')}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {expanded && label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: user info + actions */}
      <div className={`border-t border-border p-3 space-y-1 ${!expanded ? 'flex flex-col items-center' : ''}`}>
        {expanded && user && (
          <div className="px-1 pb-2">
            <p className="text-sm font-medium text-popover-foreground truncate">{user.name ?? user.email}</p>
            <p className="text-xs capitalize text-muted">{user.role}</p>
          </div>
        )}
        <div className={`flex ${expanded ? 'gap-1' : 'flex-col gap-1 items-center'}`}>
          {mounted && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={t.nav.toggleTheme}
            >
              {theme === 'dark'
                ? <Sun className="h-4 w-4 text-muted" />
                : <Moon className="h-4 w-4 text-muted" />}
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={logout} title={t.nav.signOut}>
            <LogOut className="h-4 w-4 text-muted" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Desktop sidebar ──────────────────────────────────────────────────── */}
      <aside
        className={[
          'hidden lg:flex flex-col border-r border-border bg-sidebar transition-all duration-200',
          expanded ? 'w-56' : 'w-14',
        ].join(' ')}
      >
        {SidebarContent}
      </aside>

      {/* ── Mobile drawer overlay ─────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 w-56 flex flex-col border-r border-border bg-sidebar transition-transform duration-200 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <button
          className="absolute right-3 top-3 rounded-md p-1 text-muted hover:text-popover-foreground"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </button>
        {SidebarContent}
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm lg:px-6">
          {/* Left: mobile hamburger + desktop collapse */}
          <div className="flex items-center gap-2">
            <button
              className="rounded-md p-1 text-muted hover:text-popover-foreground lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              className="hidden rounded-md p-1 text-muted hover:text-popover-foreground lg:block"
              onClick={toggleSidebar}
              title={expanded ? t.nav.collapseSidebar : t.nav.expandSidebar}
            >
              <ChevronLeft className={`h-4 w-4 transition-transform duration-200 ${expanded ? '' : 'rotate-180'}`} />
            </button>
          </div>

          {/* Right: profile button */}
          <div className="flex items-center gap-2">
            {user && (
              <button
                onClick={() => setProfileOpen(true)}
                className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-border/60"
                title={t.nav.myProfile}
              >
                <UserAvatar name={user.name} email={user.email} avatar={user.avatar} size={26} />
                <span className="hidden text-sm font-medium text-popover-foreground sm:block">
                  {user.name ?? user.email}
                </span>
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      <ProfileModal open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function UserAvatar({
  name,
  email,
  avatar,
  size,
}: {
  name: string | null;
  email: string;
  avatar?: string | null;
  size: number;
}) {
  const [imgError, setImgError] = React.useState(false);

  const initials = (() => {
    const src = name || email;
    return src
      .split(/[\s@._-]+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('');
  })();

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full text-white font-semibold select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: 'linear-gradient(135deg, #dd6900 0%, #e8c833 100%)',
      }}
    >
      {avatar && !imgError ? (
        <Image
          src={avatar}
          alt={name ?? email}
          width={size}
          height={size}
          className="object-cover w-full h-full"
          onError={() => setImgError(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
