import { SOCIAL_LINKS, CONTACT_INFO, COMPANY_INFO } from '@/lib/constants/social';

export const seoConfig = {
  siteName: COMPANY_INFO.NAME,
  siteUrl: process.env.NEXT_PUBLIC_APP_URL,
  defaultTitle: 'Infideli - Luxury Lingerie Collections',
  defaultDescription: 'Luxury lingerie collections featuring elegant FIDELI and seductive INFIDELI sets. Premium quality intimate apparel for the modern woman.',
  defaultKeywords: ['luxury lingerie', 'intimate apparel', 'fideli', 'infideli', 'premium underwear', 'women lingerie'],
  defaultImage: '/images/og-default.jpg',
  twitterHandle: COMPANY_INFO.TWITTER_HANDLE,
  
  organization: {
    name: COMPANY_INFO.NAME,
    url: process.env.NEXT_PUBLIC_APP_URL,
    logo: '/images/logo.png',
    description: COMPANY_INFO.DESCRIPTION,
    contactPoint: {
      telephone: CONTACT_INFO.PHONE,
      contactType: 'customer service',
      email: CONTACT_INFO.EMAIL
    },
    sameAs: [
      SOCIAL_LINKS.INSTAGRAM,
      SOCIAL_LINKS.FACEBOOK,
      SOCIAL_LINKS.TWITTER
    ]
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
} as const;

export type SEOConfig = typeof seoConfig; 