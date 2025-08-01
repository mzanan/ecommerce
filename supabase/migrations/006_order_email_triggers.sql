-- Enable pg_net extension for asynchronous HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to trigger email sending for new orders (INSERT only)
CREATE OR REPLACE FUNCTION notify_order_confirmation()
RETURNS trigger AS $$
DECLARE
  supabase_function_url TEXT;
  request_id BIGINT;
BEGIN
  -- Only send confirmation email for new orders with 'paid' status
  IF NEW.status = 'paid' THEN
    supabase_function_url := 'https://mxcnpiqjbidjtcdvywih.supabase.co/functions/v1/send-order-confirmation';
    
    -- Make an asynchronous HTTP request to the edge function, casting body to jsonb
    SELECT net.http_post(
        url:=supabase_function_url,
        body:=json_build_object(
          'orderId', NEW.id::text,
          'emailType', 'order_confirmation'
        )::jsonb,
        headers:='{"Content-Type": "application/json"}'::JSONB
    ) INTO request_id;
    
    -- Log the async request
    RAISE LOG 'Asynchronously triggered order confirmation for order %, request ID %', NEW.id, request_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new orders only (INSERT)
CREATE TRIGGER trigger_order_confirmation_email
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_confirmation(); 