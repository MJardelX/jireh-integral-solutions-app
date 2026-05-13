const BASE = '';  // same origin — Next.js API routes

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'staff';
  avatar?: string | null;
}

export interface LoginResult {
  accessToken: string;
  user: AuthUser;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export async function loginWithEmailApi(email: string, password: string, rememberMe: boolean): Promise<LoginResult> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, rememberMe }),
  });

  return handleResponse<LoginResult>(res);
}

export async function loginWithGoogleApi(googleIdToken: string): Promise<LoginResult> {
  const res = await fetch(`${BASE}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: googleIdToken }),
  });
  return handleResponse<LoginResult>(res);
}

// credentials:'include' ensures the httpOnly refresh-token cookie is sent
export async function refreshTokenApi(): Promise<{ accessToken: string }> {
  const res = await fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  return handleResponse<{ accessToken: string }>(res);
}

export async function logoutApi(): Promise<void> {
  await fetch(`${BASE}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}
