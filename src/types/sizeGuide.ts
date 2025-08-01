import type { Database } from '@/types/supabase';
import type { ActionResponse } from '@/types/actions';
import type { FetchDataParams } from '@/types/adminDataTable';

export type SizeGuideTemplate = Database['public']['Tables']['size_guide_templates']['Row'];
export type BasicSizeGuideTemplate = Pick<SizeGuideTemplate, 'id' | 'name'>;

export interface SizeGuideTemplateExtended {
  id: string;
  name: string;
  guide_data: any;
  created_at: string;
  updated_at: string;
}

export interface AdminSizeGuidesListResponseData {
  templates: SizeGuideTemplateExtended[];
  count: number | null;
}

export type AdminSizeGuidesListResponse = ActionResponse<AdminSizeGuidesListResponseData>;

export interface UseAdminSizeGuidesListParams extends FetchDataParams {}