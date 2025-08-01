'use server';

import { createServerActionClient } from '@/lib/supabase/server';
import { categoryFormSchema, type CategoryFormData } from '@/lib/schemas/categorySchema';
import { revalidatePath } from 'next/cache';
import { verifyAdmin } from '@/lib/auth/serverAuth';
import type { ProductCategoryRow } from '@/types/category';
import type { ActionResponse } from '@/types/actions';

export async function createCategoryAction(formData: CategoryFormData): Promise<ActionResponse<ProductCategoryRow>> {
  const validationResult = categoryFormSchema.safeParse(formData);

  if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.issues.forEach((issue) => {
            const path = issue.path.join('.');
            if (!errors[path]) errors[path] = [];
            errors[path].push(issue.message);
        });
        return { success: false, error: 'Validation failed', errors };
  }

    const { name, size_guide_id } = validationResult.data;

    const supabase = createServerActionClient();
    const { data, error } = await supabase
      .from('product_categories')
        .insert({ name, size_guide_id })
      .select('*, size_guide_templates(name)')
      .single();

    if (error) {
        console.error('Error creating category:', error);
        return { success: false, error: 'Failed to create category' };
    }

    revalidatePath('/admin/categories');
    return { success: true, data: data as ProductCategoryRow };
}

export async function fetchCategoriesAction(): Promise<{
  data: ProductCategoryRow[] | null;
  error: string | null;
}> {
  const supabase = createServerActionClient();
  try {
    const { data, error } = await supabase
      .from('product_categories')
      .select('*, size_guide_templates(name)')
      .order('name', { ascending: true });

    if (error) throw error;
    return { data: data as ProductCategoryRow[], error: null };
  } catch (error: any) {
    console.error('[Server Action Error] fetchCategoriesAction:', error);
    return { data: null, error: error.message || 'Failed to fetch categories.' };
  }
}

export async function updateCategoryAction(
    categoryId: string, 
  formData: CategoryFormData
): Promise<ActionResponse<ProductCategoryRow>> {
  const validationResult = categoryFormSchema.safeParse(formData);

  if (!validationResult.success) {
        const errors: Record<string, string[]> = {};
        validationResult.error.issues.forEach((issue) => {
            const path = issue.path.join('.');
            if (!errors[path]) errors[path] = [];
            errors[path].push(issue.message);
        });
        return { success: false, error: 'Validation failed', errors };
  }

    const { name, size_guide_id } = validationResult.data;

    const supabase = createServerActionClient();
    const { data, error } = await supabase
      .from('product_categories')
        .update({ name, size_guide_id, updated_at: new Date().toISOString() })
        .eq('id', categoryId)
      .select('*, size_guide_templates(name)')
      .single();

    if (error) {
        console.error('Error updating category:', error);
        return { success: false, error: 'Failed to update category' };
    }

    revalidatePath('/admin/categories');
    return { success: true, data: data as ProductCategoryRow };
}

export async function deleteCategoryAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServerActionClient();
  const isAdmin = await verifyAdmin(supabase);
  if (!isAdmin) {
    return { success: false, error: 'Admin authorization required.' };
  }

  if (!id) {
    return { success: false, error: 'Category ID is required for deletion.' };
  }

  try {
    const { data: productsInCategory, error: productsCheckError } = await supabase
      .from('products')
      .select('id')
      .eq('category_id', id)
      .limit(1);

    if (productsCheckError) throw productsCheckError;
    if (productsInCategory && productsInCategory.length > 0) {
      return {
        success: false,
        error: 'Cannot delete category: It is currently associated with one or more products. Please reassign or delete these products first.',
      };
    }
    
    const { error } = await supabase.from('product_categories').delete().eq('id', id);

    if (error) throw error;

    revalidatePath('/admin/categories');
    return { success: true };
  } catch (error: any) {
    console.error('[Server Action Error] deleteCategoryAction:', error);
    if (error.code === '23503') {
        return { success: false, error: 'Cannot delete category: It is referenced by other data (e.g., products). Please ensure no products are linked to this category before deleting.' };
    }
    return { success: false, error: error.message || 'Failed to delete category.' };
  }
} 