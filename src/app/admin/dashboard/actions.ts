'use server';

import { createServerActionClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { SaleOrder } from '@/types/dashboard';

export async function updateOrderStatusAction(formData: FormData) {
  const orderId = formData.get('orderId') as string;
  const newStatus = formData.get('newStatus') as SaleOrder['shipping_status'];
  const currentStatus = formData.get('currentStatus') as SaleOrder['shipping_status'];
  const pageToRevalidate = formData.get('currentPage') as string || '1';

  if (!orderId || !newStatus || !currentStatus) {
    console.error('Missing orderId, newStatus, or currentStatus in form data');
    return { success: false, error: 'Missing required parameters' };
  }

  if (currentStatus === 'pending' && newStatus !== 'in_transit') {
    return { success: false, error: 'Invalid status transition from pending' };
  }
  if (currentStatus === 'in_transit' && newStatus !== 'delivered') {
    return { success: false, error: 'Invalid status transition from in_transit' };
  }
  if (currentStatus === 'delivered') {
    return { success: false, error: 'Order already delivered' };
  }

  const supabaseServerActionClient = createServerActionClient();
  
  const { error: updateError, count } = await supabaseServerActionClient
    .from('orders')
    .update({ shipping_status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('shipping_status', currentStatus);

  if (updateError) {
    console.error('Error updating order status:', updateError.message);
    return { success: false, error: `Failed to update order status: ${updateError.message}` };
  }

  if (!count || count === 0) {
    console.log(`[DUPLICATE_ACTION_PREVENTED] Order ${orderId} status was already updated. Ignoring call.`);
    return { success: true, message: 'Status already updated.' };
  }

  let emailTypeForFunction: 'order_in_transit' | 'order_delivered' | null = null;
  if (newStatus === 'in_transit') {
    emailTypeForFunction = 'order_in_transit';
  } else if (newStatus === 'delivered') {
    emailTypeForFunction = 'order_delivered';
  }

  if (emailTypeForFunction) {
    try {
      const { error: emailError } = await supabaseServerActionClient.functions.invoke('send-order-confirmation', {
        body: {
          orderId: orderId,
          emailType: emailTypeForFunction
        }
      });

      if (emailError) {
        console.error(`[ADMIN DASHBOARD] Error sending email for order ${orderId}:`, emailError);
      }
    } catch (emailErr) {
      console.error(`[ADMIN DASHBOARD] Error in email sending process for order ${orderId}:`, emailErr);
    }
  }

  revalidatePath(`/admin/dashboard?page=${pageToRevalidate}`);
  return { success: true, message: `Order status updated to ${newStatus}` };
}

export async function syncStuckOrdersAction() {
  const supabaseServerActionClient = createServerActionClient();
  
  try {    
    const { error: syncError } = await supabaseServerActionClient.functions.invoke('auto-sync-orders', {
      body: {}
    });

    if (syncError) console.error('[ADMIN DASHBOARD] Error calling auto-sync function:', syncError);
    
    revalidatePath('/admin/dashboard');
  } catch (error: any) {
    console.error('[ADMIN DASHBOARD] Error in sync process:', error);
  }
} 