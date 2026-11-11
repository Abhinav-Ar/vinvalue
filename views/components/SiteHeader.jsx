"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu } from "lucide-react";
import UserMenu from "@/views/components/UserMenu";

const links = [
  ["/appraise", "Appraise"],
  ["/garage", "Garage"],
  ["/history", "Activity"],
];

export default function SiteHeader({ compact = false }) {
  const pathname = usePathname();
  return (
    <header className="site-header print:hidden">
      <div className="site-header-inner">
        <Link href="/" className="brand" aria-label="AutoIQ home">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
          <span>Auto<span className="brand-iq">IQ</span><sup>®</sup></span>
        </Link>
        {!compact && (
          <nav className="site-nav" aria-label="Primary navigation">
            {links.map(([href, label]) => (
              <Link key={href} href={href} data-active={pathname.startsWith(href)} aria-current={pathname.startsWith(href) ? "page" : undefined}>{label}</Link>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-3">
          <span className="header-note"><span /> Less guesswork. More leverage.</span>
          {!compact && (
            <details className="mobile-nav">
              <summary aria-label="Open navigation"><Menu /></summary>
              <div>
                {links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined} onClick={(event) => event.currentTarget.closest("details").removeAttribute("open")}>{label}<ArrowUpRight size={14} /></Link>)}
              </div>
            </details>
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
