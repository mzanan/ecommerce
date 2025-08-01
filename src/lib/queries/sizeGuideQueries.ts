import { useQuery } from '@tanstack/react-query';
import { useCacheStore } from '@/store/cacheStore';
import { createClient } from '@/lib/supabase/client';
import { getAdminSizeGuidesList as getAdminSizeGuidesListAction } from '@/lib/actions/sizeGuideActions';
import type { 
  SizeGuideTemplateExtended,
  AdminSizeGuidesListResponse,
  UseAdminSizeGuidesListParams
} from '@/types/sizeGuide';

export interface SizeGuideTemplate {
  id: string;
  name: string;
  guide_data: any;
  created_at: string;
  updated_at: string;
}

async function fetchSizeGuideTemplates(): Promise<SizeGuideTemplate[]> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('size_guide_templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching size guide templates:', error);
    throw new Error(error.message);
  }

  return data || [];
}

export function useSizeGuidesTable() {
  const cache = useCacheStore();
  const cacheKey = 'size-guide-templates';
  
  const {
    data: templates = [],
    isLoading,
    error,
    refetch
  } = useQuery<SizeGuideTemplate[], Error>({
    queryKey: ['sizeGuideTemplates'],
    queryFn: async () => {
      const cached = cache.get<SizeGuideTemplate[]>(cacheKey);
      if (cached) return cached;
      
      const data = await fetchSizeGuideTemplates();
      cache.set(cacheKey, data, 5 * 60 * 1000);
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    templates,
    isLoading,
    error,
    refetch
  };
}

async function wrappedGetAdminSizeGuidesList(params: UseAdminSizeGuidesListParams): Promise<AdminSizeGuidesListResponse> {
  const result = await getAdminSizeGuidesListAction(params);
  
  if (!result.success || !result.data) {
    return result as AdminSizeGuidesListResponse;
  }
  
  const convertedTemplates: SizeGuideTemplateExtended[] = result.data.templates.map(template => ({
    id: template.id,
    name: template.name,
    guide_data: template.guide_data as any,
    created_at: template.created_at,
    updated_at: template.updated_at,
  }));
  
  return {
    success: true,
    data: {
      templates: convertedTemplates,
      count: result.data.count,
    }
  };
}

export function useAdminSizeGuidesList(params: UseAdminSizeGuidesListParams) {
  const cache = useCacheStore();
  const cacheKey = `admin-size-guides-${JSON.stringify(params)}`;
  
  return useQuery<AdminSizeGuidesListResponse, Error>({
    queryKey: ['adminSizeGuides', params],
    queryFn: async () => {
      const cached = cache.get<AdminSizeGuidesListResponse>(cacheKey);
      if (cached) return cached;
      
      const data = await wrappedGetAdminSizeGuidesList(params);
      cache.set(cacheKey, data, 5 * 60 * 1000);
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
} 