import { createServerComponentClient } from '@/lib/supabase/server';
import { HERO_CONTENT_ID } from '@/lib/schemas/heroSchema';
import type { HeroDbRow } from '@/types/hero';

export async function getHeroContent(): Promise<HeroDbRow | null> {
  const supabase = await createServerComponentClient();
  const { data, error } = await supabase
    .from('hero_content')
    .select('*')
    .eq('id', HERO_CONTENT_ID)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching hero content:', error.message);
    return null;
  }
  return data;
} 