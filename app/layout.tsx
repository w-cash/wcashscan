import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { NavBar } from "@/components/NavBar";
import { StatsBar } from "@/components/StatsBar";
import { Footer } from "@/components/Footer";
import { MaintenanceBanner } from "@/components/MaintenanceBanner";
import { WcashNetworkBanner } from "@/components/WcashNetworkBanner";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { buildPageMetadata, getBaseUrl, getNetwork } from "@/lib/seo";
import "./globals.css";

const geistSans = localFont({
  src: "../node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});

const network = getNetwork();
const baseUrl = getBaseUrl();

const siteCopy = network === 'mainnet'
  ? {
      title: 'WcashExplorer Mainnet Preview — W.cash Block Explorer',
      description: 'WcashExplorer mainnet preview showing W.cash Testnet blocks, transactions, mining and network activity in TWC.',
      keywords: ['W.cash explorer', 'WcashExplorer', 'W.cash Testnet', 'TWC explorer'],
      imageAlt: 'WcashExplorer Mainnet Preview',
    }
  : network === 'testnet'
    ? {
        title: 'WcashExplorer Testnet — W.cash Block Explorer',
        description: 'Explore W.cash Testnet blocks, transactions, transparent addresses, Ironwood activity and mining metrics in TWC.',
        keywords: ['W.cash Testnet', 'WcashExplorer', 'TWC explorer', 'W.cash blocks'],
        imageAlt: 'WcashExplorer Testnet',
      }
    : {
        title: 'WcashExplorer Testnet — W.cash Block Explorer',
        description: 'Explore W.cash Testnet blocks, transactions, transparent addresses, Ironwood activity and mining metrics in TWC.',
        keywords: ['W.cash Testnet', 'WcashExplorer', 'TWC explorer', 'W.cash blocks'],
        imageAlt: 'WcashExplorer Testnet',
      };

const rootPageMetadata = buildPageMetadata({
  ...siteCopy,
  path: '/',
  indexOnTestnet: true,
});

export const metadata: Metadata = {
  ...rootPageMetadata,
  authors: [{ name: "W.cash" }],
  creator: "W.cash",
  publisher: "WcashExplorer",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: `${baseUrl}/`,
    types: {
      'application/rss+xml': `${baseUrl}/newsletter/rss`,
    },
  },
  category: 'technology',
};

// Site-wide JSON-LD structured data.
// WebSite.name + alternateName establish the WcashExplorer site-name entity;
// Organization with sameAs links the domain to the W.cash source repository.
const websiteAlternateNames = network === 'mainnet'
  ? ['WcashExplorer Mainnet Preview', 'W.cash Explorer']
  : ['WcashExplorer Testnet', 'W.cash Testnet Explorer', 'TWC Explorer'];

const siteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${baseUrl}/#website`,
      name: 'WcashExplorer',
      alternateName: websiteAlternateNames,
      description: siteCopy.description,
      url: `${baseUrl}/`,
      publisher: { '@id': `${baseUrl}/#organization` },
    },
    {
      '@type': 'Organization',
      '@id': `${baseUrl}/#organization`,
      name: 'W.cash',
      url: baseUrl,
      logo: `${baseUrl}/apple-touch-icon.png`,
      sameAs: ['https://github.com/w-cash/wcashscan'],
    },
  ],
};

function AppContent({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-cipher-surface focus:px-4 focus:py-2 focus:text-primary focus:shadow-lg"
      >
        Skip to main content
      </a>
      <MaintenanceBanner />
      <WcashNetworkBanner />
      <NavBar />
      <StatsBar />
      <main id="main-content" tabIndex={-1} className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}

// Script to prevent flash of wrong theme
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('theme');
      var userChose = localStorage.getItem('theme-user-set');
      if (!theme || !userChose) {
        theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      }
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(theme);
    } catch (e) {}
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
        {/* Supports sitemap-detection tools; robots.txt remains the standards-based declaration. */}
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
        {/*
          next/script's beforeInteractive strategy is Next's own documented
          mechanism for exactly this case (must run before hydration/paint
          to avoid a flash of the wrong theme). It's injected outside the
          normal React child-render path, which avoids React 19's "script
          tag inside a component" warning that a plain <script> here would
          trigger. JSON-LD scripts below stay as plain <script> tags on
          purpose — that's the separate Next-recommended pattern for
          structured data, needed to keep it in the initial server HTML for
          crawlers (next/script's strategies inject client-side instead).
        */}
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <ThemeProvider>
          <WebSocketProvider>
            <AppContent>{children}</AppContent>
          </WebSocketProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
