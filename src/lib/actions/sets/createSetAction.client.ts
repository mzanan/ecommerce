'use client';

import { createClient } from "@/lib/supabase/client";
import { createSetFormSchema } from '@/lib/schemas/setSchema';
import type { ActionResponse } from '@/types/actions';
import type { SetRow } from '@/types/db';

export async function createSetAction(prevState: ActionResponse<SetRow> | null, formData: FormData): Promise<ActionResponse<SetRow>> {
    const supabase = createClient();
    
    try {
        const rawData = {
            name: formData.get('name') as string,
            slug: formData.get('slug') as string,
            type: formData.get('type') as string,
            description: formData.get('description') as string,
            layout_type: formData.get('layout_type') as string,
            is_active: formData.get('is_active') === 'true',
        };

        const validationResult = createSetFormSchema.safeParse(rawData);
        if (!validationResult.success) {
            return { success: false, error: 'Validation failed' };
        }

        const { data, error } = await supabase
            .from('sets')
            .insert(validationResult.data)
            .select()
            .single();

        if (error) {
            return { success: false, error: `Failed to create set: ${error.message}` };
        }

        return { success: true, data };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return { success: false, error: message };
    }
} 