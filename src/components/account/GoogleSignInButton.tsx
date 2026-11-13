'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';

export function GoogleSignInButton({ callbackUrl }: { callbackUrl: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn"
        style={{ width: '100%' }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            await signIn('google', { callbackUrl });
          } catch {
            setErr('Google sign-in did not start. Check your connection and try again.');
            setBusy(false);
          }
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <circle cx="9" cy="6" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M3 16 C3 12 15 12 15 16" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        Continue with Google
      </button>
      {err && <p className="err" role="alert">{err}</p>}
    </>
  );
}
