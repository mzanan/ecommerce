import type { Metadata } from 'next'
import { seoConfig } from '@/config/seo'

export interface SEOConfig {
  title: string
  description?: string
  keywords?: string[]
  image?: string
  canonicalUrl?: string
  noIndex?: boolean
}

export function generateMetadata(config: SEOConfig): Metadata {
  const title = config.title
  const description = config.description || seoConfig.defaultDescription
  const url = config.canonicalUrl ? `${seoConfig.siteUrl}${config.canonicalUrl}` : seoConfig.siteUrl
  const image = config.image || `${seoConfig.siteUrl}${seoConfig.defaultImage}`
  
  const titlePrefix = config.noIndex ? 'Noire Admin' : seoConfig.siteName

  return {
    title,
    description,
    keywords: config.keywords?.join(', '),
    ...(config.noIndex && { robots: 'noindex, nofollow' }),
    
    openGraph: {
      type: 'website',
      siteName: seoConfig.siteName,
      title: `${titlePrefix} - ${title}`,
      description,
      url,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    
    twitter: {
      card: 'summary_large_image',
      title: `${titlePrefix} - ${title}`,
      description,
      images: [image],
    },
    
    alternates: {
      canonical: url,
    },
  }
}

export const seoConfigs = {
  home: {
    title: 'Home',
    description: 'Discover Noire\'s urban streetwear collections. Modern day and night styles for the contemporary wardrobe.',
    keywords: ['streetwear', 'urban fashion', 'day collection', 'night collection', 'modern clothing'],
    canonicalUrl: '/',
  },
  
  admin: {
    title: 'Admin Dashboard',
    description: 'Noire administration panel for managing products, orders, and content.',
    noIndex: true,
  },
  
  adminDashboard: {
    title: 'Dashboard',
    description: 'Noire admin dashboard with analytics and overview.',
    noIndex: true,
  },
  
  adminProducts: {
    title: 'Products',
    description: 'Manage Noire products and inventory.',
    noIndex: true,
  },
  
  adminSets: {
    title: 'Sets',
    description: 'Manage Noire product sets and collections.',
    noIndex: true,
  },
  
  adminOrders: {
    title: 'Orders',
    description: 'View and manage customer orders.',
    noIndex: true,
  },
  
  adminSettings: {
    title: 'Settings',
    description: 'Configure Noire application settings.',
    noIndex: true,
  },
  
  cart: {
    title: 'Shopping Cart',
    description: 'Review your selected Noire items before checkout.',
    canonicalUrl: '/cart',
  },
  
  checkout: {
    title: 'Checkout',
    description: 'Complete your Noire purchase with secure payment.',
    noIndex: true,
  },
  
  contact: {
    title: 'Contact Us',
    description: 'Get in touch with Noire for questions about our collections.',
    canonicalUrl: '/contact',
  },
  
  about: {
    title: 'About',
    description: 'Learn about Noire\'s story and commitment to modern urban fashion.',
    keywords: ['about noire', 'streetwear brand', 'company story'],
    canonicalUrl: '/about',
  },
  
  privacy: {
    title: 'Privacy Policy',
    description: 'Noire\'s privacy policy and data protection practices.',
    canonicalUrl: '/privacy',
  },
  
  terms: {
    title: 'Terms & Conditions',
    description: 'Terms and conditions for using Noire\'s website and services.',
    canonicalUrl: '/terms',
  },
}

export function generateSetMetadata(setData: {
  name: string
  description?: string | null
  type?: 'DAY' | 'NIGHT'
  imageUrl?: string
}) {
  const brandName = setData.type || 'Noire'
  const keywords = [
    'urban fashion',
    'streetwear',
    setData.type?.toLowerCase() || 'collection',
    setData.name.toLowerCase(),
  ]
  
  return generateMetadata({
    title: setData.name,
    description: setData.description || `${setData.name} - Premium ${brandName} collection from Noire. Modern urban fashion.`,
    keywords,
    image: setData.imageUrl,
  })
}

export function generateProductMetadata(productData: {
  name: string
  price: number
  description?: string | null
  imageUrl?: string
}) {
  const description = productData.description || `${productData.name} - Premium fashion piece from Noire. High-quality urban wear starting at $${productData.price}.`
  const keywords = [
    'urban fashion',
    'streetwear',
    productData.name.toLowerCase(),
  ]
  
  return generateMetadata({
    title: productData.name,
    description,
    keywords,
    image: productData.imageUrl,
  })
}
