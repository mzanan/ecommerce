import React from 'react';
import { createServerActionClient } from "@/lib/supabase/server";
import { redirect } from 'next/navigation';
import { 
    deleteShippingPriceAction, 
    upsertShippingPriceAction, 
    updateDefaultShippingPrice 
} from '@/lib/actions/shippingPricesActions';
import { getCountryShippingPrices, getDefaultShippingPrice } from '@/lib/helpers/shippingHelpers';
import ShippingPricesPageClient from '@/components/admin/shipping/ShippingPricesPageClient';

export { getShippingPriceForCountry } from '@/lib/helpers/shippingHelpers';

export default async function ShippingPricesPageWrapper() {
    const supabase = createServerActionClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        redirect('/admin/login');
    }

    const initialPrices = await getCountryShippingPrices();
    const defaultPrice = await getDefaultShippingPrice();

    return <ShippingPricesPageClient 
                initialPrices={initialPrices} 
                defaultPrice={defaultPrice}
                upsertAction={upsertShippingPriceAction} 
                deleteAction={deleteShippingPriceAction}
                updateDefaultAction={updateDefaultShippingPrice}
            />;
}
