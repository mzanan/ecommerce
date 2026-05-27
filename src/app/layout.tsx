import React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Cormorant_Garamond, Great_Vibes } from "next/font/google";
import "./global.css";
import { AppThemeProvider } from "@/components/providers/AppThemeProvider";
import { ScrollRestorationProvider } from "@/components/providers/ScrollRestorationProvider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils/cn";
import ReactQueryProvider from "@/components/providers/ReactQueryProvider";
import { StoreProvider } from "@/components/providers/StoreProvider";
import { OrganizationStructuredData, WebsiteStructuredData } from "@/components/seo/StructuredData";

const geistSans = GeistSans;
const geistMono = GeistMono;

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant-garamond",
});

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-great-vibes",
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL) : undefined,
  title: {
    default: "NOIRE - Luxury Lingerie Collections",
    template: "NOIRE - %s",
  },
  description: "Luxury lingerie collections featuring elegant and seductive sets. Premium quality intimate apparel for the modern woman.",
  keywords: "luxury lingerie, intimate apparel, day, night, premium underwear, women lingerie",
  authors: [{ name: "night" }],
  creator: "night",
  publisher: "night",
  robots: "index, follow",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    type: "website",
    siteName: "NOIRE",
    title: "NOIRE - Luxury Lingerie Collections",
    description: "Luxury lingerie collections featuring elegant day and seductive night sets. Premium quality intimate apparel for the modern woman.",
  },
  twitter: {
    card: "summary_large_image",
    title: "NOIRE - Luxury Lingerie Collections",
    description: "Luxury lingerie collections featuring elegant day and seductive night sets. Premium quality intimate apparel for the modern woman.",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1.0,
  shrinkToFit: 'no',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <OrganizationStructuredData />
        <WebsiteStructuredData />
      </head>
      <body
        className={cn(
          geistSans.variable, 
          geistMono.variable, 
          cormorantGaramond.variable,
          greatVibes.variable,
          "font-sans antialiased"
        )}
        suppressHydrationWarning
      >
        <AppThemeProvider
          attribute="class"
          defaultTheme="light"
          disableTransitionOnChange
        >
          <ScrollRestorationProvider>
            <StoreProvider>
              <ReactQueryProvider>
              <div>{children}</div>
              <Toaster richColors position="top-center" />
              </ReactQueryProvider>
            </StoreProvider>
          </ScrollRestorationProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
