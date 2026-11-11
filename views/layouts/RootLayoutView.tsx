import { Cormorant_Garamond, Manrope, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });
const cormorant = Cormorant_Garamond({ variable: "--font-editorial", subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap" });

export default function RootLayoutView({ children, session }: Readonly<{
  children: React.ReactNode;
  session: Session | null;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${cormorant.variable} ${jetbrainsMono.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
