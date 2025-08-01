'use server';

import { createServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from 'next/cache';
import type { ShippingActionResult } from '@/types/shipping';

export async function deleteShippingPriceAction(id: number): Promise<ShippingActionResult> {
    const supabase = createServerActionClient();
    
    if (!id) {
        return { success: false, message: "No ID provided for deletion." };
    }

    const { error } = await supabase
        .from('country_shipping_prices')
        .delete()
        .eq('id', id);

    if (error) {
        console.error("Supabase Error: Error deleting shipping price:", error.message);
        return { success: false, message: `Failed to delete shipping price: ${error.message}` };
    }

    revalidatePath('/admin/shipping-prices');
    return { success: true, message: "Shipping price deleted successfully!" };
}

export async function upsertShippingPriceAction(formData: FormData): Promise<ShippingActionResult> {
    const supabase = createServerActionClient();

    const idString = formData.get('id') as string | null;
    const parsedId = idString ? parseInt(idString, 10) : undefined;

    const rawFormData = {
        country_code: formData.get('country_code') as string,
        country_name: formData.get('country_name') as string | null,
        shipping_price: parseFloat(formData.get('shipping_price') as string),
        min_delivery_days: parseInt(formData.get('min_delivery_days') as string || '0'),
        max_delivery_days: parseInt(formData.get('max_delivery_days') as string || '0'),
        id: (parsedId && !isNaN(parsedId) && parsedId > 0) ? parsedId : undefined,
    };

    if (!rawFormData.country_code || isNaN(rawFormData.shipping_price)) {
        return { success: false, message: "Country code and shipping price are required." };
    }
    if (rawFormData.shipping_price <= 0) {
        return { success: false, message: "Shipping price must be greater than zero." };
    }
    if (rawFormData.min_delivery_days < 0 || rawFormData.max_delivery_days < 0) {
        return { success: false, message: "Delivery days must be positive numbers." };
    }
    if (rawFormData.min_delivery_days > rawFormData.max_delivery_days) {
        return { success: false, message: "Minimum delivery days cannot be greater than maximum delivery days." };
    }

    const basePayload = {
        country_code: rawFormData.country_code.toUpperCase(),
        country_name: rawFormData.country_name,
        shipping_price: rawFormData.shipping_price,
        min_delivery_days: rawFormData.min_delivery_days,
        max_delivery_days: rawFormData.max_delivery_days,
        updated_at: new Date().toISOString(),
    };

    let error;

    if (rawFormData.id) {
        const result = await supabase
            .from('country_shipping_prices')
            .update(basePayload)
            .eq('id', rawFormData.id)
            .select()
            .single();
        
        error = result.error;
    } else {
        const result = await supabase
            .from('country_shipping_prices')
            .insert(basePayload)
            .select()
            .single();
        
        error = result.error;
    }

    if (error) {
        console.error("Supabase Error: Error saving shipping price:", error.message);
        return { success: false, message: `Failed to save shipping price: ${error.message}` };
    }
    
    revalidatePath('/admin/shipping-prices');
    return { success: true, message: "Shipping price saved successfully!" };
}

export async function updateDefaultShippingPrice(price: number): Promise<ShippingActionResult> {
    const supabase = createServerActionClient();
    
    const { error } = await supabase
        .from('app_settings')
        .upsert({
            key: 'default_shipping_price',
            value: price.toString()
        });
    
    if (error) {
        console.error("Error updating default shipping price:", error.message);
        return { success: false, message: `Failed to update default price: ${error.message}` };
    }
    
    revalidatePath('/admin/shipping-prices');
    return { success: true, message: "Default shipping price updated successfully!" };
} 