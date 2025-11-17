export const SOCIAL_LINKS = {
  FACEBOOK: 'https://facebook.com/noire',
  INSTAGRAM: 'https://instagram.com/noire',
  TWITTER: 'https://twitter.com/noire',
  STRIPE_DASHBOARD: 'https://dashboard.stripe.com/dashboard',
} as const;

export const CONTACT_INFO = {
  EMAIL: 'contact@noire.com',
  SUPPORT_EMAIL: 'support@noire.com',
  PHONE: '+1-555-0123',
  WEBSITE_URL: process.env.NEXT_PUBLIC_APP_URL
} as const;

export const COMPANY_INFO = {
  NAME: 'Noire',
  FOUNDED_YEAR: 2025,
  TWITTER_HANDLE: '@noire',
  DESCRIPTION: 'Modern urban streetwear featuring day and night collections.',
} as const;
