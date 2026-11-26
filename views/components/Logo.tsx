import Link from 'next/link';

export function LogoMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="10" r="7" fill="var(--blue)" />
      <path d="M1 17.5 H23" stroke="currentColor" strokeWidth="1.5" />
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
