import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/context";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { SITE, SITE_TITLE } from '@/lib/site'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = SITE.url;
const SITE_NAME = SITE.name;
const DEFAULT_DESCRIPTION =
  "Statistical quality engineering tools online — SPC control charts, Pareto analysis, DPMO & Six Sigma calculations, AQL sampling plans (ISO 2859-1), Gage R&R (AIAG MSA), and capability studies. No Minitab license, no learning curve.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE.name}`,
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
  authors: [{ name: SITE.owner }],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: SITE_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    images: [SITE.ogImage],
    description: DEFAULT_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

const GA_MEASUREMENT_ID = "G-9RKQ89NGD0";

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
        {/* Google Analytics (GA4) — loads after the page is interactive so it
            doesn't block or slow down the initial render. */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <ServiceWorkerRegister />
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
