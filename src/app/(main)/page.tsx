import React from 'react';
import Home from '@/components/ecommerce/home/Home/Home';
import { createServerComponentClient } from '@/lib/supabase/server';
import { getHomepageItems, getAboutContent } from '@/lib/helpers/homeHelpers';
import { getHeroContent } from '@/lib/queries/heroQueries.server';
import { isIosDevice } from '@/lib/utils/deviceDetection';
import type { HomePageItemOrchestrator, AboutContentData } from '@/types/home';
import { cookies } from 'next/headers';
import { generateMetadata } from '@/lib/utils/seo';

export const revalidate = 3600;

export default async function HomePage() {
  let homepageItems: HomePageItemOrchestrator[] = [];
  let aboutContent: AboutContentData | null = null;
  let heroContent = null;
  let isIos = false;

  cookies();

  const supabase = createServerComponentClient();

  try {
    [homepageItems, aboutContent, heroContent, isIos] = await Promise.all([
      getHomepageItems(supabase),
      getAboutContent(supabase),
      getHeroContent(),
      isIosDevice()
    ]);
  } catch (e: any) {
    console.error('Error fetching homepage data:', e);
    homepageItems = [];
    aboutContent = null;
    heroContent = null;
    isIos = false;
  }

  return (
    <div className="relative">
      <Home 
        homepageItemsData={homepageItems}
        aboutContentData={aboutContent}
        heroContentData={heroContent}
        isIosDevice={isIos}
      />
    </div>
  );
}

export const metadata = generateMetadata({
  title: 'Home',
  description: 'Discover Infideli\'s luxury lingerie collections. Elegant FIDELI and seductive INFIDELI sets crafted with premium materials for the modern woman.',
  keywords: ['luxury lingerie', 'intimate apparel', 'fideli', 'infideli', 'premium underwear', 'women lingerie'],
  canonicalUrl: '/',
});

