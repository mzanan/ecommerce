export const BRAND_CONFIG = {
  name: 'Noire',
  title: 'Noire - Urban Streetwear',
  description: 'Modern streetwear collections featuring day and night styles',
  keywords: ['streetwear', 'urban fashion', 'modern clothing'],
  
  contact: {
    email: 'contact@noire.com',
    supportEmail: 'support@noire.com',
    phone: '+1 (555) 000-0000',
  },

  social: {
    facebook: 'https://facebook.com/noire',
    instagram: 'https://instagram.com/noire',
    twitter: 'https://twitter.com/noire',
    twitterHandle: '@noire',
  },

  storage: {
    bucketName: 'noire',
  },

  categories: {
    primary: {
      id: 'DAY',
      label: 'Day',
      description: 'Casual and comfortable daytime wear',
    },
    secondary: {
      id: 'NIGHT',
      label: 'Night',
      description: 'Bold and stylish evening wear',
    },
  },
} as const;

export type CategoryType = 'DAY' | 'NIGHT';
export const CATEGORY_TYPES = ['DAY', 'NIGHT'] as const;

