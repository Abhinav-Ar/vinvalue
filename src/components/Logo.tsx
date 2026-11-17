import Link from 'next/link';

export function LogoMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <rect x="1" y="1" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1 27 L27 1" stroke="var(--blue)" strokeWidth="1.5" />
      <circle cx="18" cy="18" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link className="logo" href="/" aria-label="AutoIQ home">
      <LogoMark />
      <span>AutoIQ</span>
    </Link>
  );
}
