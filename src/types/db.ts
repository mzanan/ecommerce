import type { Database } from './supabase'; 

export type ProductRow = Database['public']['Tables']['products']['Row'];
export type ProductImageRow = Database['public']['Tables']['product_images']['Row'];
export type VariantRow = Database['public']['Tables']['product_variants']['Row'];
export type SetRow = Database['public']['Tables']['sets']['Row'];
export type SetImageRow = Database['public']['Tables']['set_images']['Row'];
export type SetProductRow = Database['public']['Tables']['set_products']['Row'];
export type ProductCategoryRow = Database['public']['Tables']['product_categories']['Row'];

export type ProductWithPosition = ProductRow & {
    position: number | null;
    product_images: ProductImageRow[] | null;
};

export type ProductWithIncludes = ProductRow & {
  product_images: ProductImageRow[] | null;
  product_variants: VariantRow[] | null;
  sets: Pick<SetRow, 'id' | 'name' | 'slug'>[] | null;
};

export type PageComponent = Database['public']['Tables']['page_components']['Row'];
export type PageComponentContent = {
    title?: string;
    text?: string;
    imageUrl?: string;
    bgTheme?: 'light' | 'dark';
};
export type PageComponentInsert = Database['public']['Tables']['page_components']['Insert'];
export type PageComponentUpdate = Database['public']['Tables']['page_components']['Update'];

export type Product = Database['public']['Tables']['products']['Row'];
export type Set = Database['public']['Tables']['sets']['Row'];

export interface StaticSectionItem {
    id: string;
    type: 'static';
  item_type: 'static';
    title: string;
    subtitle?: string;
    className?: string;
}

export type HomepageLayoutRow = Database['public']['Tables']['homepage_layout']['Row'];

export interface SetProductWithProductDetails extends SetProductRow {
  products: Product & { product_images: ProductImageRow[] };
}

export type SortablePageItem = PageComponent & { 
  item_type: 'page_component'; 
  display_order: number; 
};

export type SortableSetItem = SetRow & { 
  item_type: 'set'; 
  display_order: number; 
};

export type SortableStaticItem = StaticSectionItem & {
  item_type: 'static'; 
};

export type SortableListItem =
  | SortablePageItem
  | SortableSetItem
  | SortableStaticItem; 