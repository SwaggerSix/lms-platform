import type { Metadata } from "next";
import "./globals.css";
import { BrandProvider } from "@/components/providers/brand-provider";
import { ToastContainer } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "LearnHub LMS",
  description: "Enterprise Learning Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <BrandProvider>
          {children}
          <ToastContainer />
        </BrandProvider>
      </body>
    </html>
  );
}
