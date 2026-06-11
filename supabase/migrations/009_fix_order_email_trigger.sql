CREATE OR REPLACE FUNCTION notify_order_confirmation()
RETURNS trigger AS $$
DECLARE
  supabase_function_url TEXT;
  supabase_anon_key TEXT;
  request_id BIGINT;
BEGIN
  IF NEW.status = 'paid' THEN
    supabase_function_url := 'https://fbulkjsfhkjvccijgxbc.supabase.co/functions/v1/send-order-confirmation';
    supabase_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidWxranNmaGtqdmNjaWpneGJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyMjk3NjYsImV4cCI6MjA3NjgwNTc2Nn0.S-DAJX0sfQfdke_g-w7yCAZCGFsywn1LdIgGtRk2Ujo';

    SELECT net.http_post(
        url:=supabase_function_url,
        body:=json_build_object(
          'orderId', NEW.id::text,
          'emailType', 'order_confirmation'
        )::jsonb,
        headers:=json_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || supabase_anon_key
        )::jsonb
    ) INTO request_id;

    RAISE LOG 'Asynchronously triggered order confirmation for order %, request ID %', NEW.id, request_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
