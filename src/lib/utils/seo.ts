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
  
  const titlePrefix = config.noIndex ? 'Infideli Admin' : seoConfig.siteName

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
    description: 'Discover Infideli\'s luxury lingerie collections. Elegant FIDELI and seductive INFIDELI sets crafted with premium materials for the modern woman.',
    keywords: ['luxury lingerie', 'intimate apparel', 'fideli', 'infideli', 'premium underwear', 'women lingerie'],
    canonicalUrl: '/',
  },
  
  admin: {
    title: 'Admin Dashboard',
    description: 'Infideli administration panel for managing products, orders, and content.',
    noIndex: true,
  },
  
  adminDashboard: {
    title: 'Dashboard',
    description: 'Infideli admin dashboard with analytics and overview.',
    noIndex: true,
  },
  
  adminProducts: {
    title: 'Products',
    description: 'Manage Infideli products and inventory.',
    noIndex: true,
  },
  
  adminSets: {
    title: 'Sets',
    description: 'Manage Infideli product sets and collections.',
    noIndex: true,
  },
  
  adminOrders: {
    title: 'Orders',
    description: 'Manage customer orders and shipping.',
    noIndex: true,
  },
  
  adminCategories: {
    title: 'Categories',
    description: 'Manage product categories and classifications.',
    noIndex: true,
  },
  
  adminSettings: {
    title: 'Settings',
    description: 'Configure Infideli application settings.',
    noIndex: true,
  },
  
  cart: {
    title: 'Shopping Cart',
    description: 'Review your selected Infideli lingerie items before checkout.',
    keywords: ['shopping cart', 'checkout', 'lingerie purchase'],
    canonicalUrl: '/cart',
  },
  
  checkout: {
    title: 'Checkout',
    description: 'Complete your Infideli lingerie purchase with secure payment.',
    keywords: ['checkout', 'payment', 'secure purchase'],
    canonicalUrl: '/checkout',
    noIndex: true,
  },
  
  contact: {
    title: 'Contact Us',
    description: 'Get in touch with Infideli for questions about our luxury lingerie collections.',
    keywords: ['contact', 'customer service', 'support'],
    canonicalUrl: '/contact',
  },
  
  about: {
    title: 'About Us',
    description: 'Learn about Infideli\'s story and commitment to luxury intimate apparel.',
    keywords: ['about infideli', 'luxury lingerie brand', 'company story'],
    canonicalUrl: '/about',
  },
  
  privacy: {
    title: 'Privacy Policy',
    description: 'Infideli\'s privacy policy and data protection practices.',
    canonicalUrl: '/privacy',
  },
  
  terms: {
    title: 'Terms of Service',
    description: 'Terms and conditions for using Infideli\'s website and services.',
    canonicalUrl: '/terms',
  },
}

export function generateSetMetadata(setData: {
  name: string
  description?: string
  slug: string
  type?: 'FIDELI' | 'INFIDELI'
  images?: Array<{ image_url: string; alt_text?: string }>
}): Metadata {
  const brandName = setData.type || 'Infideli'
  const title = setData.name
  const description = setData.description || `Discover the ${setData.name} collection from ${brandName}. Luxury lingerie crafted with premium materials and elegant design.`
  const image = setData.images?.[0]?.image_url || `${seoConfig.siteUrl}${seoConfig.defaultImage}`
  
  return generateMetadata({
    title,
    description,
    keywords: ['lingerie set', setData.name.toLowerCase(), brandName.toLowerCase(), 'luxury intimate apparel'],
    canonicalUrl: `/set/${setData.slug}`,
    image,
  })
}

export function generateProductMetadata(productData: {
  name: string
  description?: string
  slug: string
  price: number
  category?: { name: string }
  images?: Array<{ image_url: string; alt_text?: string }>
}): Metadata {
  const title = productData.name
  const description = productData.description || `${productData.name} - Premium lingerie piece from Infideli. High-quality intimate apparel starting at $${productData.price}.`
  const image = productData.images?.[0]?.image_url || `${seoConfig.siteUrl}${seoConfig.defaultImage}`
  
  return generateMetadata({
    title,
    description,
    keywords: [
      'lingerie',
      productData.name.toLowerCase(),
      productData.category?.name.toLowerCase() || '',
      'luxury underwear',
      'intimate apparel'
    ].filter(Boolean),
    canonicalUrl: `/product/${productData.slug}`,
    image,
  })
} 