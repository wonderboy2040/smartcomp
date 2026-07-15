import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/lib/theme-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Smart Computers — Sales & Service Panel v5.0 Secure Pro",
    template: "%s · Smart Computers",
  },
  description:
    "Complete shop management panel for computers sales & service with invoicing, quotations, GST, payments, WhatsApp enquiries and Google Sheets sync. Ultra fast v4.0 + Secure v5.0 + Advanced Theme.",
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
  themeColor: "#ffffff",
  viewportFit: "cover",
  colorScheme: "light",
};

// Premium light theme — site is locked to light mode.
// This inline script runs before React hydrates to prevent any flash of dark
// theme from a previously stored preference. The .dark class is forcibly
// removed and color-scheme is set to light.
const themeScript = `
(function() {
  try {
    // Always force light theme
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = 'light';
    // Persist so the ThemeProvider reads a consistent value
    try { localStorage.setItem('smartcomp-theme', 'light'); } catch(e) {}
    // Update theme-color meta
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', '#ffffff');
    }
  } catch(e) {
    try {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    } catch(e2) {}
  }
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
        <script src="/sw-register.js" defer />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geistSans.variable} antialiased min-h-screen bg-background text-foreground`}>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
