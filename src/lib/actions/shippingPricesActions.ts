'use server';

import { createServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function upsertShippingPriceAction(formData: FormData): Promise<{success: boolean, message: string}> {
  const supabase = createServerActionClient();
  
  try {
    const countryCode = formData.get('country_code') as string;
    const countryName = formData.get('country_name') as string;
    const shippingPrice = parseFloat(formData.get('shipping_price') as string);
    const minDeliveryDays = formData.get('min_delivery_days') ? parseInt(formData.get('min_delivery_days') as string) : null;
    const maxDeliveryDays = formData.get('max_delivery_days') ? parseInt(formData.get('max_delivery_days') as string) : null;
    
    const { error } = await supabase
      .from('country_shipping_prices')
      .upsert({
        country_code: countryCode.toUpperCase(),
        country_name: countryName,
        shipping_price: shippingPrice,
        min_delivery_days: minDeliveryDays,
        max_delivery_days: maxDeliveryDays,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'country_code'
      });
    
    if (error) {
      return { success: false, message: `Failed to upsert shipping price: ${error.message}` };
    }
    
    revalidatePath('/admin/shipping-prices');
    return { success: true, message: 'Shipping price updated successfully' };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, message: `Failed to upsert shipping price: ${message}` };
  }
}

export async function deleteShippingPriceAction(id: number): Promise<{success: boolean, message: string}> {
  const supabase = createServerActionClient();
  
  try {
    const { error } = await supabase
      .from('country_shipping_prices')
      .delete()
      .eq('id', id);
    
    if (error) {
      return { success: false, message: `Failed to delete shipping price: ${error.message}` };
    }
    
    revalidatePath('/admin/shipping-prices');
    return { success: true, message: 'Shipping price deleted successfully' };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, message: `Failed to delete shipping price: ${message}` };
  }
}

export async function updateDefaultShippingPrice(price: number): Promise<{success: boolean, message: string}> {
  const supabase = createServerActionClient();
  
  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key: 'default_shipping_price',
        value: price.toString()
      }, {
        onConflict: 'key'
      });
    
    if (error) {
      return { success: false, message: `Failed to update default shipping price: ${error.message}` };
    }
    
    revalidatePath('/admin/shipping-prices');
    return { success: true, message: 'Default shipping price updated successfully' };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, message: `Failed to update default shipping price: ${message}` };
  }
}

export async function getCountryShippingPricesAction(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  const supabase = createServerActionClient();
  try {
    const { data, error } = await supabase
      .from('country_shipping_prices')
      .select('*')
      .order('country_name', { ascending: true });

    if (error) {
      console.error('Error fetching shipping prices:', error.message);
      return { success: false, error: `Failed to fetch shipping prices: ${error.message}` };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('Unexpected error fetching shipping prices:', err.message);
    return { success: false, error: `An unexpected error occurred: ${err.message}` };
  }
} 