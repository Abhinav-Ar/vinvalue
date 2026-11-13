import type { Metadata, Viewport } from 'next';
import { B612_Mono, Schibsted_Grotesk } from 'next/font/google';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { themeBootScript } from '@/components/theme-script';
import './globals.css';

const sans = Schibsted_Grotesk({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-sans', display: 'swap' });
const mono = B612_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'AutoIQ', template: '%s | AutoIQ' },
  description: 'See what your car is worth, and why. Values from local listings, adjusted for your miles, title and history.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="bp" style={{ overflowX: 'hidden' }}>
        <a className="skip" href="#main">Skip to content</a>
        <Nav />
        <main id="main" tabIndex={-1} style={{ outline: 'none' }}>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
