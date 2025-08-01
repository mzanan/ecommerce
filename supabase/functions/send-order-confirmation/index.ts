import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const COMPANY_INFO = {
  NAME: 'INFIDELI',
  WEBSITE_URL: Deno.env.get('NEXT_PUBLIC_APP_URL'),
  SUPPORT_EMAIL: 'support@infideli.com',
  CONTACT_EMAIL: 'contact@infideli.com',
} as const;

interface OrderPayloadRecord {
  id: string;
  shipping_name: string;
  shipping_email: string;
  shipping_address1: string;
  shipping_city: string;
  total_amount?: number;
  shipping_address2?: string | null;
  shipping_state?: string | null;
  shipping_postal_code?: string;
  shipping_country?: string;
}

interface TriggerPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: OrderPayloadRecord;
  old_record: OrderPayloadRecord | null;
}

type EmailType = 'order_confirmation' | 'order_in_transit' | 'order_delivered';

interface DirectInvocationPayload {
  orderId: string;
  emailType: EmailType;
}

interface OrderItem {
    product_name: string;
    quantity: number;
    price_at_purchase: number;
    product_size: string | null;
}

interface FullOrderDetails extends OrderPayloadRecord {
    order_items: OrderItem[];
    total_amount: number;
    order_details?: any;
}

async function getOrderDetails(supabaseClient: SupabaseClient, orderId: string): Promise<FullOrderDetails> {
  console.log(`Attempting to fetch order details for order: ${orderId}`);
  
  const { data: orderDetails, error } = await supabaseClient
    .from('orders')
    .select(`
        id, shipping_name, shipping_email, shipping_address1, shipping_address2, 
        shipping_city, shipping_state, shipping_postal_code, shipping_country, 
        total_amount, order_details
    `)
    .eq('id', orderId)
    .single();

  console.log(`Query result - data:`, orderDetails);
  console.log(`Query result - error:`, error);

  if (error) {
    console.error('Error fetching order details:', error);
    if (error.code === 'PGRST116') {
      console.log(`Order ${orderId} not found - it may have been deleted or is not accessible`);
      throw new Error(`Order ${orderId} not found or not accessible`);
    }
    throw new Error(`Failed to fetch details for order ${orderId}: ${error.message}`);
  }
  if (!orderDetails) {
    throw new Error(`Order ${orderId} not found.`);
  }
  
  let orderItems: OrderItem[] = [];
  if (orderDetails.order_details) {
    try {
      const orderDetailsJson = typeof orderDetails.order_details === 'string' 
        ? JSON.parse(orderDetails.order_details) 
        : orderDetails.order_details;
      
      const itemsArray = orderDetailsJson.items || orderDetailsJson;
      
      if (Array.isArray(itemsArray)) {
        orderItems = itemsArray.map((item: any) => ({
          product_name: item.product_name,
          quantity: item.quantity,
          price_at_purchase: item.price_at_purchase,
          product_size: item.size
        }));
      }
    } catch (parseError) {
      console.warn(`Failed to parse order_details JSON for order ${orderId}:`, parseError);
    }
  }
  
  const ensuredOrderDetails = {
    ...orderDetails,
    total_amount: orderDetails.total_amount ?? 0,
    order_items: orderItems
  };
  
  return ensuredOrderDetails as FullOrderDetails;
}

function getEmailSubject(emailType: EmailType, orderId: string): string {
  switch (emailType) {
    case 'order_confirmation':
      return `${COMPANY_INFO.NAME} - Order Confirmation`;
    case 'order_in_transit':
      return `${COMPANY_INFO.NAME} - Your Order is on its Way!`;
    case 'order_delivered':
      return `${COMPANY_INFO.NAME} - Your Order Has Been Delivered!`;
    default:
      console.warn(`Unknown email type: ${emailType} for order ${orderId}`);
      return `${COMPANY_INFO.NAME} - Order Update`;
  }
}

function generateEmailHtml(
  emailType: EmailType,
  orderDetails: FullOrderDetails,
  itemsHtmlList: string,
  deliveryTimeframe: string
): string {
  const customerName = orderDetails.shipping_name;
  const orderTotal = orderDetails.total_amount.toFixed(2);

  let greeting = "";
  let messageBody = "";
  let noticeText = "";
  let noticeBgColor = "#000000";

  switch (emailType) {
    case 'order_confirmation':
      greeting = `Thank you for your order, ${customerName}!`;
      messageBody = `<p>We've received your order and it will be processed shortly.</p>`;
      noticeText = "We'll be shipping your order soon";
      break;
    case 'order_in_transit':
      greeting = `Your order is on its way, ${customerName}!`;
      messageBody = `<p>Great news! Your order has been shipped and is now on its way to you.</p>
                     <p>You can typically expect your package within ${deliveryTimeframe}.</p>
                     <!-- Optional: Add tracking link if available -->
                     <!-- <p>Track your shipment: <a href="[TRACKING_LINK_HERE]" style="color: #000000; text-decoration: underline;">Click Here</a></p> -->`;
      noticeText = "Your items are in transit";
      break;
    case 'order_delivered':
      greeting = `Your order has been delivered, ${customerName}!`;
      messageBody = `<p>Wonderful news! Your order has been successfully delivered.</p>
                     <p>We hope you love your new items from ${COMPANY_INFO.NAME}. If you have any questions or feedback, please don't hesitate to reach out.</p>
                     <p>Thank you for shopping with us!</p>`;
      noticeText = "Order Delivered Successfully";
      noticeBgColor = "#4CAF50";
      break;
    default:
      greeting = `Order Update, ${customerName}`;
      messageBody = `<p>There's an update regarding your order ${orderDetails.id.substring(0,8)}.</p>`;
      noticeText = "Order Status Update";
      break;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${getEmailSubject(emailType, orderDetails.id)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Geist', Arial, sans-serif; line-height: 1.6; color: #000000; background-color: #f4f4f4; padding: 20px; }
        .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;}
        .header { background-color: #000000; padding: 30px 40px; text-align: center; }
        .logo { font-family: 'Geist', Arial, sans-serif; font-size: 24px; font-weight: 600; color: #ffffff !important; letter-spacing: 1px; text-decoration: none; }
        .content { padding: 30px 40px; }
        .greeting { font-size: 22px; font-weight: 600; margin-bottom: 20px; color: #000000; }
        .message-section p { margin-bottom: 15px; line-height: 1.7; color: #333333; }
        .shipping-notice { background-color: ${noticeBgColor}; color: #ffffff; padding: 15px 20px; margin: 25px 0; text-align: center; font-weight: 500; border-radius: 4px;}
        .section-title { font-size: 18px; font-weight: 600; margin: 30px 0 15px 0; color: #000000; border-bottom: 2px solid #eeeeee; padding-bottom: 8px; }
        .order-summary {}
        .order-item { padding: 15px 0; border-bottom: 1px solid #eeeeee; }
        .order-item:last-child { border-bottom: none; }
        .item-details {}
        .item-name { font-weight: 500; color: #000000; margin-bottom: 4px;}
        .item-price { color: #555555; font-size: 14px; }
        .shipping-row { padding: 15px 0; border-bottom: 1px solid #eeeeee; }
        .shipping-label { font-weight: 500; color: #000000; display: block; margin-bottom: 4px; }
        .shipping-amount { color: #555555; font-size: 14px; display: block; }
        .total-row { padding: 20px 0 0 0; display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #000000; margin-top:10px;}
        .total-label { font-weight: 600; font-size: 18px; color: #000000; }
        .total-amount { font-weight: 600; font-size: 18px; color: #000000; }
        .shipping-address { background-color: #f9f9f9; padding: 20px; margin: 25px 0; border-radius: 4px; }
        .address-line { margin-bottom: 5px; color: #333333; }
        .address-line strong { color: #000000; }
        .footer { background-color: #000000; color: #ffffff; padding: 30px 40px; text-align: center; }
        .footer p { margin: 5px 0 0 0; font-size: 13px; color: #bbbbbb;}
        .support-text { margin-top: 25px; padding: 20px; background-color: #f9f9f9; text-align: center; font-style: italic; color: #555555; border-radius: 4px;}
        @media only screen and (max-width: 600px) {
            body { padding: 0; }
            .email-container { width: 100% !important; border-radius: 0; border: none;}
            .content, .header, .footer { padding: 20px !important; }
            .greeting { font-size: 20px !important; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <a href="${COMPANY_INFO.WEBSITE_URL}" class="logo">INFIDELI</a>
        </div>
        <div class="content">
            <h1 class="greeting">${greeting}</h1>
            <div class="message-section">
                ${messageBody}
            </div>
            <div class="shipping-notice">
                ${noticeText}
            </div>
            <h2 class="section-title">Order Summary</h2>
            <div class="order-summary">
                ${itemsHtmlList}
                <div class="total-row">
                    <span class="total-label">Total:</span>
                    <span class="total-amount">$${orderTotal}</span>
                </div>
            </div>
            <h2 class="section-title">Shipping to</h2>
            <div class="shipping-address">
                <div class="address-line"><strong>${orderDetails.shipping_name}</strong></div>
                <div class="address-line">${orderDetails.shipping_address1}</div>
                ${orderDetails.shipping_address2 ? `<div class="address-line">${orderDetails.shipping_address2}</div>` : ''}
                <div class="address-line">${orderDetails.shipping_city}, ${orderDetails.shipping_state || ''} ${orderDetails.shipping_postal_code || ''}</div>
                <div class="address-line">${orderDetails.shipping_country || 'N/A'}</div>
                <div class="address-line" style="margin-top: 15px; font-size: 12px; color: #666;">Order ID: ${orderDetails.id.substring(0, 8)}</div>
            </div>
            <div class="support-text">
                If you have any questions, please contact our support at ${COMPANY_INFO.SUPPORT_EMAIL} or visit our website.
            </div>
        </div>
        <div class="footer">
            <a href="${COMPANY_INFO.WEBSITE_URL}" class="logo" style="font-size: 20px; color: #ffffff !important;">INFIDELI</a>
            <p>Premium Women's Lingerie</p>
        </div>
    </div>
</body>
</html>
  `;
}

async function getDeliveryTimeframe(supabaseClient: SupabaseClient, shippingCountry: string): Promise<string> {
  if (!shippingCountry) {
    return "3-5 business days";
  }

  const { data: countryShipping, error } = await supabaseClient
    .from('country_shipping_prices')
    .select('min_delivery_days, max_delivery_days')
    .eq('country_code', shippingCountry.toUpperCase())
    .single();

  if (countryShipping && !error && countryShipping.min_delivery_days && countryShipping.max_delivery_days) {
    return `${countryShipping.min_delivery_days}-${countryShipping.max_delivery_days} business days`;
  }

  return "3-5 business days";
}

Deno.serve(async (req: Request) => {
  let payload: any;
  try {
    payload = await req.json();
  } catch (e: any) {
    console.error(`ERROR: Invalid JSON payload - ${e.message}`);
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  let orderId: string | undefined;
  let emailType: EmailType | undefined;

  if (payload && typeof payload === 'object') {
    if (payload.type === 'INSERT' && payload.table === 'orders' && payload.record && typeof payload.record.id === 'string') {
      const dbPayload = payload as TriggerPayload;
      orderId = dbPayload.record.id;
      emailType = 'order_confirmation';
    } else if (typeof payload.orderId === 'string' && typeof payload.emailType === 'string') {
      const directPayload = payload as DirectInvocationPayload;
      orderId = directPayload.orderId;
      const receivedEmailType = directPayload.emailType;
      if (['order_confirmation', 'order_in_transit', 'order_delivered'].includes(receivedEmailType)) {
        emailType = receivedEmailType as EmailType;
      } else {
        console.error(`ERROR: Invalid emailType '${receivedEmailType}'`);
        return new Response(JSON.stringify({ error: "Direct Invocation: Invalid email type provided." }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

  if (!orderId || !emailType) {
    console.error(`ERROR: Failed to determine orderId or emailType from payload`);
    return new Response(JSON.stringify({ 
      error: "Invalid payload. Ensure 'orderId' and 'emailType' are provided for direct calls, or that DB trigger ('type', 'table', 'record.id') is correctly formatted." 
    }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const smtpHost = Deno.env.get('SMTP_HOST');
  const smtpPortStr = Deno.env.get('SMTP_PORT');
  const smtpUsername = Deno.env.get('SMTP_USERNAME');
  const smtpPassword = Deno.env.get('SMTP_PASSWORD');
  const smtpFromEmail = Deno.env.get('SMTP_FROM_EMAIL');

  if (!supabaseUrl || !supabaseServiceRoleKey || !smtpHost || !smtpPortStr || !smtpUsername || !smtpPassword || !smtpFromEmail) {
    console.error(`ERROR: Missing environment variables`);
    return new Response(JSON.stringify({ error: "Internal server configuration error for email service." }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
  const smtpPort = parseInt(smtpPortStr, 10);
  if (isNaN(smtpPort)) {
    console.error(`ERROR: Invalid SMTP_PORT`);
    return new Response(JSON.stringify({ error: "Invalid SMTP port configuration." }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  try {
    const fullOrderDetails = await getOrderDetails(supabaseClient, orderId);
    const customerEmail = fullOrderDetails.shipping_email;

    if (!customerEmail) {
      console.error(`ERROR: No customer email found for order ${orderId}`);
      return new Response(JSON.stringify({ 
        warning: `No customer email found for order ${orderId}. Email type '${emailType}' not sent.`
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let deliveryTimeframe = "3-5 business days";
    if (emailType === 'order_in_transit') {
      deliveryTimeframe = await getDeliveryTimeframe(supabaseClient, fullOrderDetails.shipping_country || '');
    }

    const subject = getEmailSubject(emailType, orderId);
    
    let shippingPrice = 0;
    if (fullOrderDetails.order_details) {
      try {
        const orderDetailsJson = typeof fullOrderDetails.order_details === 'string' 
          ? JSON.parse(fullOrderDetails.order_details) 
          : fullOrderDetails.order_details;
        
        if (orderDetailsJson.shipping_price !== undefined) {
          shippingPrice = orderDetailsJson.shipping_price || 0;
        }
      } catch (error) {
        console.warn(`Failed to parse order_details JSON for order ${orderId}:`, error);
      }
    }
    
    const itemsHtmlList = Array.isArray(fullOrderDetails.order_items) && fullOrderDetails.order_items.length > 0
      ? fullOrderDetails.order_items.map((item: OrderItem) => 
          `<div class="order-item">
              <div class="item-details">
                  <div class="item-name">${item.quantity}x ${item.product_name} ${item.product_size ? `(${item.product_size})` : ''}</div>
                  <div class="item-price"><strong>$ ${(item.price_at_purchase * item.quantity).toFixed(2)}</strong></div>
              </div>
           </div>`
        ).join('')
      : '<div class="order-item"><div class="item-details"><div class="item-name">Order details not available.</div></div></div>';
    
    const shippingHtml = `<div class="shipping-row">
        <span class="shipping-label">Shipping:</span>
        <span class="shipping-amount"><strong>$${shippingPrice.toFixed(2)}</strong></span>
    </div>`;
    
    const finalItemsHtmlList = itemsHtmlList + shippingHtml;
    const emailBodyHtml = generateEmailHtml(emailType, fullOrderDetails, finalItemsHtmlList, deliveryTimeframe);

    const mailerClient = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: { username: smtpUsername, password: smtpPassword },
      },
      debug: { log: Deno.env.get("SMTP_DEBUG_LOG") === "true" }
    });

    await mailerClient.send({
      from: smtpFromEmail,
      to: customerEmail,
      subject: subject,
      html: emailBodyHtml,
    });
    
    console.log(`SUCCESS: Email sent to ${customerEmail}`);
    
    try { 
      await mailerClient.close(); 
    } catch (closeErr: any) { 
      console.warn(`Warning: Failed to close SMTP client:`, closeErr.message); 
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      message: `Email sent successfully`,
      orderId,
      recipient: customerEmail
    }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error(`ERROR: Failed to send email for order ${orderId} - ${error.message}`);
    
    if (error.message.includes('not found') || error.message.includes('not accessible')) {
      console.log(`Order ${orderId} not found - likely deleted or test data. Returning success to avoid retries.`);
      return new Response(JSON.stringify({ 
        success: true,
        message: `Order ${orderId} not found - likely deleted or test data`,
        orderId
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    return new Response(JSON.stringify({ 
      error: error.message,
      orderId
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
