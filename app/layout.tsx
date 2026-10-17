import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script"
import "./globals.css";
import { LanguageProvider } from "@/lib/language-context";
import { PlayersProvider } from "@/lib/players-context";
import { ThemeProvider } from "@/lib/theme-context";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#E30613",
};

export const metadata: Metadata = {
  title: "Tunisia WNT - Elite Squad Manager",
  description: "Elite Squad Manager for Tunisia Women's National Football Team",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Tunisia WNT",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Tunisia WNT" />
        <meta name="theme-color" content="#E30613" />
        <meta name="application-name" content="Tunisia WNT" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ("serviceWorker" in navigator) {
                var isDev = location.hostname.includes("localhost") || location.hostname.includes("127.0.0.1");
                if (isDev) {
                  // Dev: a leftover service worker from a previous session can keep
                  // serving stale JS and mask live edits. Kick it out and wipe caches.
                  navigator.serviceWorker.getRegistrations().then(function (regs) {
                    regs.forEach(function (r) { r.unregister(); });
                  });
                  if (window.caches) {
                    caches.keys().then(function (keys) {
                      keys.forEach(function (k) { if (k.indexOf("tunisia-wnt") === 0) caches.delete(k); });
                    });
                  }
                } else {
                  window.addEventListener("load", () => {
                    navigator.serviceWorker.register("/sw.js");
                  });
                }
              }
              (function(){var t=localStorage.getItem('ftf-theme')||'dark';document.documentElement.setAttribute('data-theme',t)})()
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <LanguageProvider>
            <PlayersProvider>
              {children}
            </PlayersProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}