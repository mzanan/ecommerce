import type { Metadata } from 'next';

export const seoConfig = {
  siteName: 'Noire',
  siteUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://noire.com',
  defaultTitle: 'Noire - Urban Streetwear',
  defaultDescription: 'Modern streetwear collections featuring day and night styles. Premium quality urban fashion.',
  defaultKeywords: ['streetwear', 'urban fashion', 'modern clothing', 'day collection', 'night collection'] as string[],
  defaultImage: '/og-image.png',
  twitterHandle: '@noire',
  locale: 'en_US',
  organization: {
    name: 'Noire',
    url: process.env.NEXT_PUBLIC_APP_URL || 'https://noire.com',
    logo: '/logo.png',
    description: 'Modern urban streetwear featuring day and night collections.',
    contactPoint: {
      telephone: '+1-555-0123',
      contactType: 'Customer Service',
      email: 'contact@noire.com',
    },
    sameAs: [
      'https://facebook.com/noire',
      'https://instagram.com/noire',
      'https://twitter.com/noire',
    ],
  },
} as const;

export const baseMetadata: Metadata = {
  title: {
    default: seoConfig.defaultTitle,
    template: `%s | ${seoConfig.siteName}`,
  },
  description: seoConfig.defaultDescription,
  keywords: seoConfig.defaultKeywords,
  authors: [{ name: seoConfig.siteName }],
  creator: seoConfig.siteName,
  metadataBase: new URL(seoConfig.siteUrl),
  
  openGraph: {
    type: 'website',
    locale: seoConfig.locale,
    url: seoConfig.siteUrl,
    title: seoConfig.defaultTitle,
    description: seoConfig.defaultDescription,
    siteName: seoConfig.siteName,
    images: [
      {
        url: seoConfig.defaultImage,
        width: 1200,
        height: 630,
        alt: seoConfig.siteName,
      },
    ],
  },
  
  twitter: {
    card: 'summary_large_image',
    title: seoConfig.defaultTitle,
    description: seoConfig.defaultDescription,
    site: seoConfig.twitterHandle,
    creator: seoConfig.twitterHandle,
    images: [seoConfig.defaultImage],
  },
  
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};
