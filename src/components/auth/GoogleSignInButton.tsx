'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

// Minimal typings for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            config: {
              theme?: string;
              size?: string;
              width?: number | string;
              text?: string;
            }
          ) => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  onLoginSuccess: () => void;
  disabled?: boolean;
}

export function GoogleSignInButton({ onLoginSuccess, disabled = false }: GoogleSignInButtonProps) {
  const { loginWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return; // Google SSO not configured

    // Avoid loading twice if the script already exists
    if (document.getElementById('google-gsi-script')) {
      if (window.google) initGoogle();
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initGoogle;
    document.head.appendChild(script);

    return () => {
      // Only remove on full unmount, not every re-render
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  function initGoogle() {
    if (!window.google || !clientId || !containerRef.current) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      auto_select: false,
      callback: async ({ credential }) => {
        setIsLoading(true);
        setError(null);
        try {
          await loginWithGoogle(credential);
          onLoginSuccess();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Google sign-in failed');
        } finally {
          setIsLoading(false);
        }
      },
    });

    window.google.accounts.id.renderButton(containerRef.current, {
      theme: 'outline',
      size: 'large',
      width: '100%',
      text: 'signin_with',
    });

    setScriptReady(true);
  }

  // Google SSO not configured — show a disabled fallback
  if (!clientId) {
    return (
      <Button type="button" variant="outline" disabled className="w-full opacity-50">
        <GoogleIcon className="mr-2 h-4 w-4" />
        Google SSO not configured
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      {/* Container where GIS renders its button */}
      <div
        ref={containerRef}
        className={`w-full transition-opacity ${!scriptReady || isLoading || disabled ? 'opacity-50 pointer-events-none' : ''}`}
      />

      {/* Show our styled button while GIS script is loading */}
      {!scriptReady && (
        <Button type="button" variant="outline" disabled className="w-full">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
          Loading Google Sign-In…
        </Button>
      )}

      {error && (
        <p className="text-sm text-center text-destructive">{error}</p>
      )}
    </div>
  );
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
