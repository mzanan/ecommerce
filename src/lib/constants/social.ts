export const SOCIAL_LINKS = {
  FACEBOOK: 'https://facebook.com/infideli',
  INSTAGRAM: 'https://instagram.com/infideli',
  TWITTER: 'https://twitter.com/infideli',
  STRIPE_DASHBOARD: 'https://dashboard.stripe.com/dashboard',
} as const;

export const CONTACT_INFO = {
  EMAIL: 'contact@infideli.com',
  SUPPORT_EMAIL: 'support@infideli.com',
  PHONE: '+1-555-0123',
  WEBSITE_URL: process.env.NEXT_PUBLIC_APP_URL
} as const;

export const COMPANY_INFO = {
  NAME: 'Infideli',
  FOUNDED_YEAR: 2025,
  TWITTER_HANDLE: '@infideli',
  DESCRIPTION: 'Luxury lingerie brand offering premium intimate apparel for the modern woman.',
} as const;
