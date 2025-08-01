import { createServerActionClient } from "@/lib/supabase/server";
import type { CountryShippingPrice } from '@/types/shipping';

export async function getCountryShippingPrices(): Promise<CountryShippingPrice[]> {
  const supabase = createServerActionClient();
  const { data, error } = await supabase
    .from('country_shipping_prices')
    .select('*')
    .order('country_name', { ascending: true });
  if (error) {
    console.error("Error fetching country shipping prices:", error.message);
    return [];
  }
  return data || [];
}

export async function getDefaultShippingPrice(): Promise<number> {
  const supabase = createServerActionClient();
  
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'default_shipping_price')
    .single();
  
  if (data && !error && data.value) {
    return parseFloat(data.value) || 10.00;
  }
  
  return 10.00;
}

export async function getShippingPriceForCountry(countryCode: string): Promise<number> {
  const supabase = createServerActionClient();
  
  const { data: countryPrice, error: countryError } = await supabase
    .from('country_shipping_prices')
    .select('shipping_price')
    .eq('country_code', countryCode.toUpperCase())
    .single();
  
  if (countryPrice && !countryError) {
    return countryPrice.shipping_price;
  }
  
  return await getDefaultShippingPrice();
} 