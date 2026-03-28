import type { Metadata } from "next";
import "./globals.css";
import { BrandProvider } from "@/components/providers/brand-provider";
import { ToastContainer } from "@/components/ui/toast";
import ServiceWorkerRegister from "@/components/pwa/service-worker-register";
import I18nProvider from "@/i18n/provider";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDirection } from "@/lib/i18n/direction";

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

  return (
    <html lang={locale} dir={direction}>
      <head>
        <meta name="theme-color" content="#005089" />
        <link rel="icon" href="/learnhub-icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
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
