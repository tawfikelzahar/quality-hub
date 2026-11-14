import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { LanguageProvider } from "@/lib/i18n/context";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import ReportBrandingLoader from "@/components/ReportBrandingLoader";
import Analytics from "@/components/Analytics";
import JsonLd from "@/components/JsonLd";
import { siteSchema } from "@/lib/seo/schema";
import { notFound } from 'next/navigation'
import { SITE, SITE_TITLE, SITE_DESCRIPTION } from '@/lib/site'
import { LOCALES, isLocale } from '@/lib/i18n/routing'

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
const DESCRIPTION = SITE_DESCRIPTION
const DEFAULT_DESCRIPTION = DESCRIPTION.en

// Both languages are built ahead of time; any other first segment is a 404.
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }))
}
export const dynamicParams = false

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params
  const ar = lang === 'ar'
  const description = ar ? DESCRIPTION.ar : DESCRIPTION.en
  return {
    ...BASE_METADATA,
    description,
    openGraph: { ...BASE_METADATA.openGraph, description, locale: ar ? 'ar_EG' : 'en_US', alternateLocale: ar ? ['en_US'] : ['ar_EG'] },
    twitter: { ...BASE_METADATA.twitter, description },
  }
}

const BASE_METADATA: Metadata = {
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

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang } = await params
  if (!isLocale(lang)) notFound()
  return (
    // Language and direction come from the URL (/ar/… = Arabic), so the
    // server sends each page already in its language — see lib/i18n/routing.ts.
    <html
      lang={lang}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Google Analytics (GA4): live site only, see lib/analytics.ts */}
        <Analytics />
        {/* Organization + WebSite structured data (lib/seo/schema.ts) */}
        <JsonLd data={siteSchema(lang, lang === 'ar' ? DESCRIPTION.ar : DESCRIPTION.en)} />
        <ServiceWorkerRegister />
        <ReportBrandingLoader />
        <LanguageProvider lang={lang}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
