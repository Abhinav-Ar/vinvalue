import type { Metadata } from "next";
import { auth } from "@/auth";
import RootLayoutView from "@/views/layouts/RootLayoutView";
import "@/views/styles/globals.css";

export const metadata: Metadata = {
  title: "AutoIQ — Evidence-backed car values",
  description: "A clear vehicle value range built from live comparable listings and your car's actual condition.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return <RootLayoutView session={session}>{children}</RootLayoutView>;
}
