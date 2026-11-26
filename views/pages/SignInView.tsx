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
    <section className="wrap page" style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="stack" style={{ width: '100%', maxWidth: 440, gap: 'var(--s5)', paddingTop: 'var(--s8)' }}>
        <h1 className="title">Sign in</h1>
        <p className="lede">Keep your cars and reports. Values stay free without an account.</p>
        <GoogleSignInButton callbackUrl={callbackUrl} />
        <Link className="textbtn" href="/appraise" style={{ alignSelf: 'center' }}>Continue without an account</Link>
        {/* TODO: add the privacy policy link here once the policy page exists (design placeholder "[YOUR PRIVACY POLICY LINK]"). */}
      </div>
    </section>
  );
}
