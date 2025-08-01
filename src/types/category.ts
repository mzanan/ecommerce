import type { Database } from '@/types/supabase';

export type ProductCategoryRow = Database['public']['Tables']['product_categories']['Row'] & {
  size_guide_templates?: {
    name: string;
  } | null;
}; 