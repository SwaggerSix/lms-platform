import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist } from "next/font/google";
import "./globals.css";
import { BrandProvider } from "@/components/providers/brand-provider";
import { ToastContainer } from "@/components/ui/toast";
import ServiceWorkerRegister from "@/components/pwa/service-worker-register";
import I18nProvider from "@/i18n/provider";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDirection } from "@/lib/i18n/direction";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LearnHub LMS",
  description: "Enterprise Learning Management System",
  manifest: "/manifest.json",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "LMS Platform",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const direction = getDirection(locale);
  const messages = (await import(`../messages/${locale}.json`)).default;
  // The middleware's strict CSP only executes inline scripts carrying the
  // per-request nonce it forwards via x-nonce.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    // suppressHydrationWarning: the pre-paint theme script adds `dark` to
    // <html> before React hydrates, an expected mismatch.
    <html lang={locale} dir={direction} className={geist.variable} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#91C53C" />
        <link rel="icon" href="/learnhub-icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        {/* Apply the stored theme before paint to avoid a light flash.
            suppressHydrationWarning: browsers blank the nonce attribute in
            the DOM, so the client value never matches the server's. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('lms-theme');if(t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}",
          }}
        />
      </head>
      <body className="antialiased">
        <I18nProvider locale={locale} messages={messages}>
          <BrandProvider>
            {children}
            <ToastContainer />
            <ServiceWorkerRegister />
          </BrandProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
