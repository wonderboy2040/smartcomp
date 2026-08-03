import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/lib/theme-context";

const geistSans = localFont({
  src: [
    { path: "../../public/fonts/GeistVF.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-geist-sans",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "Smart Computers — Sales & Service Panel v10.0 Ultra",
    template: "%s · Smart Computers",
  },
  description:
    "Complete shop management panel for computer sales and service with invoicing, quotations, GST, payments, WhatsApp enquiries, Google Sheets sync, PWA support, and complete light/dark theme support.",
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
  other: {
    'google-site-verification': process.env.GOOGLE_SITE_VERIFICATION || '',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  viewportFit: "cover",
  colorScheme: "light dark",
};

const themeScript = `
(function(){try{var s=localStorage.getItem('smartcomp-theme'),t=s==='light'?'light':'dark',r=document.documentElement;if(t==='dark'){r.classList.add('dark');r.style.colorScheme='dark'}else{r.classList.remove('dark');r.style.colorScheme='light'}var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='dark'?'#020617':'#f8fafc')}catch(e){}})()
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
        <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://script.google.com" />
      </head>
      <body className={`${geistSans.variable} antialiased min-h-screen bg-background text-foreground`}>
        <ThemeProvider>
          {children}
          <Toaster />
          <SonnerToaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
