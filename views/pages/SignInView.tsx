import type { Metadata } from 'next';
import Link from 'next/link';
import { GoogleSignInButton } from '@/views/components/account/GoogleSignInButton';

export const metadata: Metadata = { title: 'Sign in' };

/** Only same-site paths: "/garage" yes, "//evil.com" and "https://..." no. */
function safeNext(v: string | string[] | undefined): string {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s || !s.startsWith('/') || s.startsWith('//') || s.startsWith('/\\')) return '/garage';
  return s;
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const callbackUrl = safeNext((await searchParams).next);
  return (
    <div className="grid"><section className="wrap" style={{ paddingTop: 96, paddingBottom: 96, display: 'flex', justifyContent: 'center' }}>
      <div className="sheet frame" style={{ width: '100%', maxWidth: 520, padding: 44, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <p className="kicker" style={{ marginBottom: -8 }}>Account</p>
        <h1 className="title">Sign in to save your cars</h1>
        <p style={{ margin: 0, color: 'var(--mid)', lineHeight: 1.6 }}>
          Sign in to save cars to your garage and reopen any report later. Appraisals still work without an account.
        </p>
        <GoogleSignInButton callbackUrl={callbackUrl} />
        <Link className="btn-o" href="/appraise" style={{ width: '100%' }}>
          Continue without an account
        </Link>
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
          <p className="small" style={{ margin: 0 }}>We store your saved cars and report history.</p>
          {/* TODO: add the privacy policy link here once the policy page exists (design placeholder "[YOUR PRIVACY POLICY LINK]"). */}
        </div>
      </div>
    </section></div>
  );
}
