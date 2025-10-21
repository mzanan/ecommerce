'use server';

import { createServerActionClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { heroContentFormSchema, HERO_CONTENT_ID } from '@/lib/schemas/heroSchema';
import { uploadHeroImage, deleteHeroImage, getStoragePathFromUrl } from '@/lib/helpers/storageHelpers';
import type { ActionResponse } from '@/types/actions';
import type { HeroDbRow } from '@/types/hero';

export async function upsertHeroContentAction(
  prevState: ActionResponse<HeroDbRow> | null,
  formData: FormData
): Promise<ActionResponse<HeroDbRow>> {
  const supabase = await createServerActionClient();
  const bucketName = process.env.SUPABASE_BUCKET;

  if (!bucketName) {
    const errMsg = "Error: SUPABASE_BUCKET environment variable is not set.";
    return { success: false, error: `Server configuration error: ${errMsg}` };
  }

  const { extractImageFilesFromFormData } = require('@/lib/helpers/formHelpers');
  const imageFiles = extractImageFilesFromFormData(formData);
  const currentImageUrl = formData.get('current_image_url') as string | null;

  const validatedFields = heroContentFormSchema.safeParse({
    id: String(HERO_CONTENT_ID),
    images: imageFiles.length > 0 ? imageFiles[0] : undefined,
    image_url: currentImageUrl || undefined,
    imageOrderChanged: formData.get('imageOrderChanged') === 'true',
  });

  if (!validatedFields.success) {
    return {
      success: false,
      message: 'Invalid form data.',
      error: JSON.stringify(validatedFields.error.flatten().fieldErrors),
    };
  }

  let imageUrl = validatedFields.data.image_url || null;
  let uploadedImagePath: string | null = null;
  
  try {
    if (imageFiles.length > 0) {
      const uploadResult = await uploadHeroImage(imageFiles[0]);
      
      if (uploadResult.error || !uploadResult.publicUrl || !uploadResult.path) {
        console.error('[HERO DEBUG] Upload failed:', uploadResult.error);
        throw new Error(uploadResult.error || 'Image upload failed');
      }

      if (currentImageUrl && currentImageUrl !== uploadResult.publicUrl) {
        const oldImagePath = getStoragePathFromUrl(currentImageUrl, bucketName);
        if (oldImagePath) await deleteHeroImage(oldImagePath);
      }

      imageUrl = uploadResult.publicUrl;
      uploadedImagePath = uploadResult.path;
    }

    const dataToUpsert = {
      image_url: imageUrl,
      title: '',
      subtitle: '',
    };

    const { data: result, error } = await supabase
      .from('hero_content')
      .upsert({ ...dataToUpsert, id: HERO_CONTENT_ID, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      if (uploadedImagePath) await deleteHeroImage(uploadedImagePath);
      
      return { success: false, message: `Database error: ${error.message}` };
    }

    revalidatePath('/');
    revalidatePath('/admin/hero-settings');
    
    return { success: true, message: 'Hero image updated successfully.', data: result as HeroDbRow };

  } catch (e: any) {
    
    if (uploadedImagePath) await deleteHeroImage(uploadedImagePath);
    
    return { success: false, message: e.message || 'Failed to save hero content.' };
  }
} 