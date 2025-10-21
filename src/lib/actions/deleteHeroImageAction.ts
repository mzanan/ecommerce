'use server';

import { createServerActionClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { deleteHeroImage, getStoragePathFromUrl } from '@/lib/helpers/storageHelpers';
import { HERO_CONTENT_ID } from '@/lib/schemas/heroSchema';
import type { ActionResponse } from '@/types/actions';
import type { HeroDbRow } from '@/types/hero';

export async function deleteHeroImageAction(): Promise<ActionResponse<HeroDbRow>> {
  console.log('[HERO DELETE] Starting hero image deletion');
  
  const supabase = await createServerActionClient();
  const bucketName = process.env.SUPABASE_BUCKET;

  if (!bucketName) {
    const errMsg = "Error: SUPABASE_BUCKET environment variable is not set.";
    console.error('[HERO DELETE]', errMsg);
    return { success: false, error: `Server configuration error: ${errMsg}` };
  }

  try {
    const { data: currentHero, error: fetchError } = await supabase
      .from('hero_content')
      .select('*')
      .eq('id', HERO_CONTENT_ID)
      .maybeSingle();

    if (fetchError) {
      console.error('[HERO DELETE] Fetch error:', fetchError);
      return { success: false, error: `Fetch error: ${fetchError.message}` };
    }

    if (currentHero?.image_url) {
      console.log('[HERO DELETE] Deleting image from storage:', currentHero.image_url);
      const imagePath = getStoragePathFromUrl(currentHero.image_url, bucketName);
      
      if (imagePath) {
        const deleteResult = await deleteHeroImage(imagePath);
        console.log('[HERO DELETE] Storage deletion result:', deleteResult);
        
        if (!deleteResult.success) {
          console.warn('[HERO DELETE] Failed to delete from storage:', deleteResult.error);
        }
      }
    }

    const { data: result, error: updateError } = await supabase
      .from('hero_content')
      .upsert({ 
        id: HERO_CONTENT_ID, 
        image_url: null,
        title: '',
        subtitle: '',
        updated_at: new Date().toISOString() 
      }, { onConflict: 'id' })
      .select()
      .single();

    if (updateError) {
      console.error('[HERO DELETE] DB update error:', updateError);
      return { success: false, error: `Database error: ${updateError.message}` };
    }

    console.log('[HERO DELETE] Hero image deleted successfully');

    revalidatePath('/');
    revalidatePath('/admin/hero-settings');

    return { success: true, message: 'Hero image deleted successfully.', data: result as HeroDbRow };

  } catch (e: any) {
    console.error('[HERO DELETE] Unexpected error:', e);
    return { success: false, error: e.message || 'Failed to delete hero image.' };
  }
}

