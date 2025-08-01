'use server';

import { revalidatePath } from 'next/cache';
import { createServerActionClient } from '@/lib/supabase/server';
import { sizeGuideTemplateFormSchema } from '@/lib/schemas/sizeGuideTemplateSchema';
import type { ActionResponse } from '@/types/actions';
import type { FetchDataParams } from '@/types/adminDataTable';
import type { SizeGuideTemplate, BasicSizeGuideTemplate } from '@/types/sizeGuide';

export async function getSizeGuideTemplates(): Promise<SizeGuideTemplate[]> {
    const supabase = createServerActionClient();
    const { data, error } = await supabase
        .from('size_guide_templates')
        .select('id, name, guide_data, created_at, updated_at')
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching size guide templates:', error);
        return []; 
    }

    return (data || []) as SizeGuideTemplate[];
}

export async function createSizeGuideTemplate(
    prevState: ActionResponse | null, 
    formData: FormData
): Promise<ActionResponse> {
    const supabase = createServerActionClient();

    let rawData: any = {};
    try {
        rawData = {
            name: formData.get('name') as string,
            guide_data: JSON.parse(formData.get('guide_data') as string)
        };
    } catch {
         return { success: false, message: 'Invalid guide data format.' };
    }

    const validatedFields = sizeGuideTemplateFormSchema.safeParse(rawData);

    if (!validatedFields.success) {
        console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
        return { 
            success: false, 
            message: 'Validation failed. Please check the fields.',
            error: JSON.stringify(validatedFields.error.flatten().fieldErrors)
        };
    }

    const { name, guide_data } = validatedFields.data;

    const { error } = await supabase
        .from('size_guide_templates')
        .insert({
            name: name,
            guide_data: guide_data
        });

    if (error) {
        console.error('Supabase Error creating template:', error);
        if (error.code === '23505') { 
             return { success: false, message: 'A template with this name already exists.' };
        }
        return { success: false, message: error.message || 'Failed to create size guide template.' };
    }

    revalidatePath('/admin/size-guides');
    revalidatePath('/admin/products');
    return { success: true, message: 'Size guide template created successfully.' };
}

export async function updateSizeGuideTemplate(
    id: string,
    prevState: ActionResponse | null,
    formData: FormData
): Promise<ActionResponse> {
     if (!id) return { success: false, message: 'Template ID is missing.' };

    const supabase = createServerActionClient();

    let rawData: any = {};
    try {
        rawData = {
            name: formData.get('name') as string,
            guide_data: JSON.parse(formData.get('guide_data') as string)
        };
    } catch {
         return { success: false, message: 'Invalid guide data format.' };
    }

    const validatedFields = sizeGuideTemplateFormSchema.safeParse(rawData);

    if (!validatedFields.success) {
        console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
        return { 
            success: false, 
            message: 'Validation failed. Please check the fields.',
            error: JSON.stringify(validatedFields.error.flatten().fieldErrors)
        };
    }

    const { name, guide_data } = validatedFields.data;

    const { error } = await supabase
        .from('size_guide_templates')
        .update({
            name: name,
            guide_data: guide_data,
            updated_at: new Date().toISOString()
        })
        .eq('id', id);

    if (error) {
        console.error('Supabase Error updating template:', error);
         if (error.code === '23505') {
             return { success: false, message: 'A template with this name already exists.' };
        }
        return { success: false, message: error.message || 'Failed to update size guide template.' };
    }

    revalidatePath('/admin/size-guides');
    revalidatePath(`/admin/size-guides/${id}/edit`);
    revalidatePath('/admin/products');

    return { success: true, message: 'Size guide template updated successfully.' };
}

export async function getSizeGuideTemplateById(id: string): Promise<ActionResponse<SizeGuideTemplate>> {
    if (!id) {
        return { success: false, message: 'Template ID is missing.' };
    }
    const supabase = createServerActionClient();
    const { data, error } = await supabase
        .from('size_guide_templates')
        .select('id, name, guide_data, created_at, updated_at')
        .eq('id', id)
        .single();

    if (error) {
        console.error(`Error fetching size guide template ${id}:`, error);
        if (error.code === 'PGRST116') { // Not found
             return { success: false, message: 'Size guide template not found.' };
        }
        return { success: false, message: error.message || 'Failed to fetch size guide template.' };
    }

    if (!data) {
         return { success: false, message: 'Size guide template not found.' };
    }

    return { success: true, data: data as SizeGuideTemplate }; 
}

export async function deleteSizeGuideTemplate(id: string): Promise<ActionResponse> {
    if (!id) return { success: false, message: 'Template ID is missing.' };
    
    const supabase = createServerActionClient();

    const { data: categoriesUsing, error: categoriesCheckError } = await supabase
        .from('product_categories')
        .select('id, name')
        .eq('size_guide_id', id);

    if (categoriesCheckError) {
        console.error('Error checking category usage:', categoriesCheckError);
        return { success: false, message: 'Could not verify category usage before deletion.' };
    }

    if (categoriesUsing && categoriesUsing.length > 0) {
        const categoryNames = categoriesUsing.map(cat => cat.name).join(', ');
        const count = categoriesUsing.length;
        
        return {
            success: false,
            message: `Cannot delete size guide template: It is currently being used by ${count} product categor${count > 1 ? 'ies' : 'y'}: ${categoryNames}. Please remove it from these categories first before deleting.`,
        };
    }
    
    const { error } = await supabase
        .from('size_guide_templates')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Supabase Error deleting template:', error);
        return { success: false, message: error.message || 'Failed to delete size guide template.' };
    }

    revalidatePath('/admin/size-guides');
    revalidatePath('/admin/products');
    revalidatePath('/admin/categories');
    return { success: true, message: 'Size guide template deleted.' };
}

export async function getAdminSizeGuidesList(
    params: FetchDataParams
): Promise<ActionResponse<{ templates: SizeGuideTemplate[], count: number | null }>> {
    const supabase = createServerActionClient();
    
    const { limit = 10, offset = 0, orderBy = 'name', orderAsc = true, filters = {} } = params;
    
    let query = supabase
        .from('size_guide_templates')
        .select('id, name, guide_data, created_at, updated_at', { count: 'exact' });

    if (filters.name) {
        query = query.ilike('name', `%${filters.name}%`);
    }
    
    if (orderBy) {
        query = query.order(orderBy, { ascending: orderAsc });
    }

    query = query.range(offset, offset + limit - 1);
    
    const { data, error, count } = await query;

    if (error) {
        console.error('Error fetching size guide list:', error);
        return { success: false, message: error.message || 'Failed to fetch size guides.' };
    }

    return { 
        success: true, 
        data: { 
            templates: data as SizeGuideTemplate[], 
            count: count 
        }
    };
}

export async function fetchBasicSizeGuideTemplatesAction(): Promise<{
  data: BasicSizeGuideTemplate[] | null;
  error: string | null;
}> {
  const supabase = createServerActionClient();
  try {
    const { data, error } = await supabase
      .from('size_guide_templates')
      .select('id, name')
      .order('name', { ascending: true });

    if (error) throw error;
    return { data, error: null };
  } catch (error: any) {
    console.error('[Server Action Error] fetchBasicSizeGuideTemplatesAction:', error);
    return { data: null, error: error.message || 'Failed to fetch size guide templates.' };
  }
}

export async function fetchSizesFromSizeGuideAction(sizeGuideId: string): Promise<{
  data: string[] | null;
  error: string | null;
}> {
  if (!sizeGuideId) {
    return { data: [], error: null };
  }

  const supabase = createServerActionClient();
  try {
    const { data: sizeGuide, error: fetchError } = await supabase
      .from('size_guide_templates')
      .select('guide_data')
      .eq('id', sizeGuideId)
      .single();

    if (fetchError) throw fetchError;

    if (!sizeGuide || !sizeGuide.guide_data) {
      return { data: [], error: 'Size guide data not found.' };
    }

    const guideData = sizeGuide.guide_data as { rows?: string[][] };
    const sizes = guideData.rows?.map(row => row[0]).filter(Boolean) || [];
    
    return { data: sizes, error: null };
  } catch (error: any) {
    console.error('[Server Action Error] fetchSizesFromSizeGuideAction:', error);
    return { data: null, error: error.message || 'Failed to fetch sizes from size guide.' };
  }
} 