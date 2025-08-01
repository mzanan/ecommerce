'use server';

import { createServerActionClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { heroContentFormSchema, HERO_CONTENT_ID } from '@/lib/schemas/heroSchema';
import type { ActionResponse } from '@/types/actions';
import type { HeroDbRow } from '@/types/hero';

async function uploadHeroImage(supabase: ReturnType<typeof createServerActionClient>, imageFile: File): Promise<string | null> {
  const fileName = `hero_image_${Date.now()}.${imageFile.name.split('.').pop()}`;
  const bucketName = process.env.SUPABASE_BUCKET;

  if (!bucketName) {
    const errorMessage = "Error: SUPABASE_BUCKET environment variable is not set.";
    console.error(errorMessage);
    throw new Error(errorMessage); 
  }
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(fileName, imageFile, { upsert: true });

  if (uploadError) {
    console.error('Storage Error:', uploadError);
    throw new Error(`Storage Error: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(uploadData.path);
  return publicUrlData.publicUrl;
}

export async function upsertHeroContentAction(
  prevState: ActionResponse<HeroDbRow> | null,
  formData: FormData
): Promise<ActionResponse<HeroDbRow>> {
  const supabase = await createServerActionClient();

  const rawFormData: Record<string, any> = {};
  formData.forEach((value, key) => {
    if (key === 'images' || key === 'id' || key === 'current_image_url') return; 
    rawFormData[key] = value;
  });
  rawFormData.id = HERO_CONTENT_ID;

  const imageFile = formData.get('images') as File | null;

  const validatedFields = heroContentFormSchema.safeParse({
    id: String(HERO_CONTENT_ID),
    images: imageFile,
    image_url: formData.get('current_image_url') || undefined,
    imageOrderChanged: formData.get('imageOrderChanged') === 'true',
  });

  if (!validatedFields.success) {
    console.error("Validation Errors:", validatedFields.error.flatten().fieldErrors);
    return {
      success: false,
      message: 'Invalid form data.',
      error: JSON.stringify(validatedFields.error.flatten().fieldErrors),
    };
  }

  let imageUrl = validatedFields.data.image_url || null;
  
  try {
    if (imageFile && imageFile.size > 0) {
      imageUrl = await uploadHeroImage(supabase, imageFile);
      if (!imageUrl) throw new Error('Image upload failed and did not return a URL.');
    }

    const dataToUpsert = {
      image_url: imageUrl,
      title: '',
      subtitle: '',
    };
    if (!imageUrl && !imageFile) { 
        dataToUpsert.image_url = null;
    }

    const { data: result, error } = await supabase
      .from('hero_content')
      .upsert({ ...dataToUpsert, id: HERO_CONTENT_ID, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      console.error('DB Error:', error.message);
      return { success: false, message: `Database error: ${error.message}` };
    }

    revalidatePath('/');
    revalidatePath('/admin/hero-settings');
    return { success: true, message: 'Hero image updated successfully.', data: result as HeroDbRow };

  } catch (e: any) {
    console.error('Action Error:', e.message);
            return { success: false, message: e.message || 'Failed to save hero content due to database error.' };
  }
} 