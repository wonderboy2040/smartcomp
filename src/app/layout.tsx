import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smart Computers - Sales & Service Panel",
  description:
    "Complete shop management panel for computers sales & service with invoicing, quotations, GST, payments, WhatsApp enquiries and Google Sheets sync.",
  applicationName: "Smart Computers",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SmartComp",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0f172a",
  viewportFit: "cover",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SmartComp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA: register service worker */}
        <script src="/sw-register.js" defer />
      </head>
      <body
        className={`${geistSans.variable} antialiased bg-slate-50 text-slate-900 min-h-screen`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
