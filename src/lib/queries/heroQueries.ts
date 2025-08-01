import { useQuery } from '@tanstack/react-query';
import { useCacheStore } from '@/store/cacheStore';
import { createClient } from '@/lib/supabase/client';
import { HERO_CONTENT_ID } from '@/lib/schemas/heroSchema';
import type { HeroDbRow } from '@/types/hero';

async function fetchHeroContent(): Promise<HeroDbRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('hero_content')
    .select('*')
    .eq('id', HERO_CONTENT_ID)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching hero content:', error.message);
    throw new Error(error.message); 
  }
  return data;
}

export function useHeroContent() {
  const cache = useCacheStore();
  const cacheKey = `hero-content-${HERO_CONTENT_ID}`;
  
  return useQuery<HeroDbRow | null, Error>({
    queryKey: ['heroContent', HERO_CONTENT_ID],
    queryFn: async () => {
      const cached = cache.get<HeroDbRow | null>(cacheKey);
      if (cached) return cached;
      
      const data = await fetchHeroContent();
      cache.set(cacheKey, data, 5 * 60 * 1000);
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
} 