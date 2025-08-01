'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useImagePreloader } from '@/hooks/useImagePreloader';

interface ImagePreloaderProps {
  enabled?: boolean;
}

export default function ImagePreloader({ enabled = true }: ImagePreloaderProps) {
  const [allImageUrls, setAllImageUrls] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!enabled || hasLoadedRef.current) return;

    const preloadAllImages = async () => {
      if (isLoading) return;
      
      setIsLoading(true);
      hasLoadedRef.current = true;

      try {
        const supabase = createClient();
        const urls: string[] = [];

        const [setsResult, heroResult, aboutResult] = await Promise.all([
          supabase
            .from('sets')
            .select(`
              set_images(image_url),
              set_products(
                products(
                  product_images(image_url)
                )
              )
            `)
            .eq('is_active', true),
          
          supabase
            .from('hero_content')
            .select('image_url')
            .eq('id', 1)
            .maybeSingle(),

          supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'about_content')
            .maybeSingle()
        ]);

        if (setsResult.data) {
          setsResult.data.forEach((set: any) => {
            set.set_images?.forEach((img: any) => {
              if (img.image_url) urls.push(img.image_url);
            });
            
            set.set_products?.forEach((sp: any) => {
              sp.products?.product_images?.forEach((img: any) => {
                if (img.image_url) urls.push(img.image_url);
              });
            });
          });
        }

        if (heroResult.data?.image_url) {
          urls.push(heroResult.data.image_url);
        }

        if (aboutResult.data?.value) {
          try {
            const aboutData = JSON.parse(aboutResult.data.value);
            if (aboutData.image_urls && Array.isArray(aboutData.image_urls)) {
              urls.push(...aboutData.image_urls.filter((url: any) => url && typeof url === 'string'));
            }
          } catch {
            console.warn('Failed to parse about content data');
          }
        }

        const uniqueUrls = Array.from(new Set(urls)).filter(url => 
          url && 
          typeof url === 'string' && 
          url.trim() !== '' && 
          !url.includes('placeholder')
        );

        setAllImageUrls(uniqueUrls);
      } catch (error) {
        console.error('Error preloading images:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(preloadAllImages, 100);
    return () => clearTimeout(timeoutId);
  }, [enabled, isLoading]);

  useImagePreloader(allImageUrls, { enabled: allImageUrls.length > 0, priority: true });

  return null;
} 