"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Zap } from "lucide-react";
import UserMenu from "@/components/UserMenu";

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
          <span className="brand-mark"><Zap aria-hidden="true" /></span>
          <span>AutoIQ</span>
        </Link>
        {!compact && (
          <nav className="site-nav" aria-label="Primary navigation">
            {links.map(([href, label]) => (
              <Link key={href} href={href} data-active={pathname.startsWith(href)}>{label}</Link>
            ))}
          </nav>
        )}
        <div className="flex items-center gap-2">
          {!compact && (
            <details className="mobile-nav">
              <summary aria-label="Open navigation"><Menu /></summary>
              <div>
                {links.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
              </div>
            </details>
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
