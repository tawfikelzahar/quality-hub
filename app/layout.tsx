import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://qualityhub.tools";
const SITE_NAME = "Quality Hub";
const DEFAULT_DESCRIPTION =
  "Statistical quality engineering tools online — SPC control charts, Pareto analysis, DPMO & Six Sigma calculations, AQL sampling plans (ISO 2859-1), Gage R&R (AIAG MSA), and capability studies. No Minitab license, no learning curve.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Quality Hub — Statistical Quality Engineering Tools Online",
    template: "%s | Quality Hub",
  },
  description: DEFAULT_DESCRIPTION,
  keywords: [
    "SPC software online",
    "control charts online",
    "AQL sampling plan calculator",
    "ISO 2859-1",
    "Gage R&R calculator",
    "AIAG MSA",
    "Six Sigma DPMO calculator",
    "Pareto chart maker",
    "process capability Cpk",
  ],
  authors: [{ name: "Tawfik Elzahar" }],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Quality Hub — Statistical Quality Engineering Tools Online",
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: "Quality Hub — Statistical Quality Engineering Tools Online",
    description: DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // lang/dir start as English/LTR on the server. LanguageProvider flips
    // both attributes on the client, after mount, if the visitor previously
    // chose Arabic (stored in localStorage) — see lib/i18n/context.tsx.
    <html
      lang="en"
      dir="ltr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
