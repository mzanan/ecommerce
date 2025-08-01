'use server';

import { createServerActionClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { SaleOrder } from '@/types/dashboard';
import type { ActionResponse } from '@/types/actions';

export async function updateOrderStatusAction(formData: FormData): Promise<ActionResponse> {
  const orderId = formData.get('orderId') as string;
  const newStatus = formData.get('newStatus') as SaleOrder['shipping_status'];
  const currentStatus = formData.get('currentStatus') as SaleOrder['shipping_status'];
  const pageToRevalidate = formData.get('currentPage') as string || '1';

  if (!orderId || !newStatus || !currentStatus) {
    console.error('Missing orderId, newStatus, or currentStatus in form data');
    return { success: false, error: 'Missing required parameters' };
  }

  if (currentStatus === 'pending' && newStatus !== 'in_transit') {
    return { success: false, error: 'Invalid status transition' };
  }
  if (currentStatus === 'in_transit' && newStatus !== 'delivered') {
    return { success: false, error: 'Invalid status transition' };
  }
  if (currentStatus === 'delivered') {
    return { success: false, error: 'Order already delivered' };
  }

  const supabase = createServerActionClient();
  const { error: updateError } = await supabase
    .from('orders')
    .update({ shipping_status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  if (updateError) {
    console.error('Error updating order status:', updateError.message);
    return { success: false, error: `Failed to update order status: ${updateError.message}` };
  }

  let emailTypeForFunction: 'order_in_transit' | 'order_delivered' | null = null;
  if (newStatus === 'in_transit') {
    emailTypeForFunction = 'order_in_transit';
  } else if (newStatus === 'delivered') {
    emailTypeForFunction = 'order_delivered';
  }

  if (emailTypeForFunction) {
    try {
      const { data: orderData } = await supabase
        .from('orders')
        .select('shipping_email, shipping_name, id')
        .eq('id', orderId)
        .single();

      if (orderData?.shipping_email) {
        const { error: emailError } = await supabase.functions.invoke('send-order-confirmation', {
          body: {
            orderId: orderData.id,
            emailType: emailTypeForFunction
          }
        });

        if (emailError) {
          console.error(`[ADMIN DASHBOARD] Error sending email for order ${orderId}:`, emailError);
        } 
      } else {
        console.warn(`[ADMIN DASHBOARD] No email address found for order ${orderId}`);
      }
    } catch (emailErr) {
      console.error(`[ADMIN DASHBOARD] Error in email sending process for order ${orderId}:`, emailErr);
    }
  }

  revalidatePath(`/admin/dashboard?page=${pageToRevalidate}`);
  return { success: true, message: `Order status updated to ${newStatus}` };
}

export async function syncStuckOrdersAction(): Promise<ActionResponse> {
  const supabase = createServerActionClient();
  
  try {
    const { error: syncError } = await supabase.functions.invoke('auto-sync-orders', {
      body: {}
    });

    if (syncError) {
      console.error('[ADMIN DASHBOARD] Error calling auto-sync function:', syncError);
      return { success: false, error: syncError.message };
    } 
    
    revalidatePath('/admin/dashboard');
    return { success: true, message: 'Orders synced successfully' };
  } catch (error: any) {
    console.error('[ADMIN DASHBOARD] Error in sync process:', error);
    return { success: false, error: 'Failed to sync orders' };
  }
} 