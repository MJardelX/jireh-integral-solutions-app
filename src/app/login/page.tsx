'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginCard } from '@/components/auth/LoginCard';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace('/dashboard');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(232,200,51,0.14),transparent_24%),linear-gradient(180deg,_#080705_0%,_#0f0b08_100%)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#e8c833] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(232,200,51,0.14),transparent_24%),linear-gradient(180deg,_#080705_0%,_#0f0b08_100%)] px-4 py-12">
      <LoginCard onLoginSuccess={() => router.push('/dashboard')} />
    </div>
  );
}
