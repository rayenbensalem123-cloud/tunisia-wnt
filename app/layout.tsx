import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script"
import "./globals.css";
import { LanguageProvider } from "@/lib/language-context";
import { PlayersProvider } from "@/lib/players-context";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="en" dir="ltr">
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
                window.addEventListener("load", () => {
                  navigator.serviceWorker.register("/sw.js");
                });
              }
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <LanguageProvider>
          <PlayersProvider>
            {children}
          </PlayersProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}