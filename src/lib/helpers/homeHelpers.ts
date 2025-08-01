import { createServerComponentClient } from '@/lib/supabase/server';
import type { PageComponent, SetRow as Set } from '@/types/db';
import type { HomePageItemOrchestrator, AboutContentData } from '@/types/home';
import { APP_SETTINGS_ABOUT_KEY } from '@/lib/constants/home';

export async function getHomepageItems(client: ReturnType<typeof createServerComponentClient>): Promise<HomePageItemOrchestrator[]> {
  try {
    const { data: layoutData, error: layoutError } = await client
      .from('homepage_layout')
      .select('item_id, item_type, display_order, page_path')
      .eq('page_path', '/')
      .order('display_order', { ascending: true });

    if (layoutError) throw layoutError;
    if (!layoutData || layoutData.length === 0) return [];

    const componentIds = layoutData
      .filter(item => item.item_type === 'page_component')
      .map(item => item.item_id);
    const setIds = layoutData
      .filter(item => item.item_type === 'set')
      .map(item => item.item_id);

    const [componentsResult, setsResult] = await Promise.all([
      componentIds.length > 0 
        ? client.from('page_components').select('*').in('id', componentIds).eq('is_active', true) 
        : Promise.resolve({ data: [], error: null }),
      setIds.length > 0 
        ? client.from('sets').select('*, set_images(*), set_products(*, products(*, product_images(*)))').in('id', setIds).eq('is_active', true)
        : Promise.resolve({ data: [], error: null })
    ]);

    if (componentsResult.error) throw componentsResult.error;
    if (setsResult.error) throw setsResult.error;

    const fetchedComponents = (componentsResult.data || []) as PageComponent[];
    const fetchedSets = (setsResult.data || []) as Set[];

    const componentMap = new Map(fetchedComponents.map(c => [c.id, c]));
    const setMap = new Map(fetchedSets.map(s => [s.id, s]));

    const finalItems: HomePageItemOrchestrator[] = layoutData.reduce((acc: HomePageItemOrchestrator[], layoutItem) => {
      if (layoutItem.item_type === 'page_component') {
        const component = componentMap.get(layoutItem.item_id);
        if (component) {
          acc.push({ ...component, item_type: 'page_component' });
        }
      } else if (layoutItem.item_type === 'set') {
        const set = setMap.get(layoutItem.item_id) as (Set & { set_images?: any[], set_products?: any[] }) | undefined;
        if (set && set.set_products && set.set_products.length > 0) {
          acc.push({ ...set, item_type: 'set' });
        }
      }
      return acc;
    }, []);
    return finalItems;
  } catch (error: any) {
    console.error("[Server Fetch Error] getHomepageItems:", error);
    return [];
  }
}

export async function getAboutContent(client: ReturnType<typeof createServerComponentClient>): Promise<AboutContentData | null> {
  const { data: settingsData, error: settingsError } = await client
    .from('app_settings')
    .select('value')
    .eq('key', APP_SETTINGS_ABOUT_KEY)
    .maybeSingle();

  if (settingsError) {
    console.error('Error fetching about content from app_settings:', settingsError);
    return null;
  }

  if (!settingsData || !settingsData.value || typeof settingsData.value !== 'string') {
    return null;
  }

  try {
    const content = JSON.parse(settingsData.value) as AboutContentData;
    return {
        text_content: content.text_content || null,
        image_urls: Array.isArray(content.image_urls) ? content.image_urls.filter(img => typeof img === 'string' || img === null) : [],
        image_aspect_ratio: content.image_aspect_ratio || 'square',
    };
  } catch (parseError: any) {
    console.error("Error parsing about content JSON from app_settings:", parseError);
    return { text_content: null, image_urls: [], image_aspect_ratio: 'square', error: "Failed to parse about content data." } as any;
  }
} 