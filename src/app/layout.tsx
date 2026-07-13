import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/lib/theme-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // Show fallback text immediately, swap to Geist when loaded
});

export const metadata: Metadata = {
  title: {
    default: "Smart Computers — Sales & Service Panel",
    template: "%s · Smart Computers",
  },
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
  // Performance: preconnect to the Apps Script host if you know it.
  // (Left empty because APPS_SCRIPT_URL is set at runtime via env var.)
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef0f6" },
    { media: "(prefers-color-scheme: dark)", color: "#16172a" },
  ],
  viewportFit: "cover",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SmartComp",
  },
};

// Inline script to prevent flash-of-wrong-theme (runs before React hydrates)
const themeScript = `
(function() {
  try {
    var stored = localStorage.getItem('smartcomp-theme');
    if (stored === 'dark') {
      document.documentElement.classList.add('dark');
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#16172a');
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* PWA: register service worker (self-destruct version, just cleans up old SWs) */}
        <script src="/sw-register.js" defer />
        {/* Theme: prevent flash of wrong theme */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} antialiased min-h-screen`}
      >
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
