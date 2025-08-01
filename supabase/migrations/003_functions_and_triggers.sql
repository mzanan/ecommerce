-- Function to generate unique order numbers
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  new_order_number TEXT;
  is_unique BOOLEAN := false;
BEGIN
  WHILE NOT is_unique LOOP
    -- Generate order number with format: ORD-YYYYMMDD-XXXXX
    new_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                       LPAD(FLOOR(RANDOM() * 99999 + 1)::TEXT, 5, '0');
    
    -- Check if this order number already exists
    SELECT NOT EXISTS (SELECT 1 FROM orders WHERE order_number = new_order_number) INTO is_unique;
  END LOOP;
  
  RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically set order number before insert
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically set order number
CREATE TRIGGER set_order_number_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_number();

-- Function to get dashboard statistics
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
  total_orders INTEGER;
  total_revenue DECIMAL(10,2);
  pending_orders INTEGER;
  total_products INTEGER;
  total_sets INTEGER;
  low_stock_count INTEGER;
BEGIN
  -- Get total orders
  SELECT COUNT(*) INTO total_orders FROM orders;
  
  -- Get total revenue (from all completed orders)
  SELECT COALESCE(SUM(total_amount), 0) INTO total_revenue 
  FROM orders WHERE status IN ('processing', 'delivered');
  
  -- Get pending orders
  SELECT COUNT(*) INTO pending_orders 
  FROM orders WHERE status = 'processing';
  
  -- Get total active products
  SELECT COUNT(*) INTO total_products FROM products WHERE is_active = true;
  
  -- Get total active sets
  SELECT COUNT(*) INTO total_sets FROM sets WHERE is_active = true;
  
  -- Get low stock products (stock < 10)
  SELECT COUNT(*) INTO low_stock_count 
  FROM products WHERE is_active = true AND stock_quantity < 10;
  
  -- Build result JSON
  result := json_build_object(
    'totalOrders', total_orders,
    'totalRevenue', total_revenue,
    'pendingOrders', pending_orders,
    'totalProducts', total_products,
    'totalSets', total_sets,
    'lowStockCount', low_stock_count
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent orders with customer info
CREATE OR REPLACE FUNCTION get_recent_orders(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  shipping_name TEXT,
  shipping_email TEXT,
  total_amount NUMERIC,
  status TEXT,
  shipping_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.user_id,
    o.shipping_name,
    o.shipping_email,
    o.total_amount,
    o.status,
    o.shipping_status,
    o.created_at
  FROM orders o
  ORDER BY o.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get sales data by month for charts
CREATE OR REPLACE FUNCTION get_monthly_sales(months_back INTEGER DEFAULT 12)
RETURNS TABLE (
  month_year TEXT,
  total_sales NUMERIC,
  order_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(o.created_at, 'YYYY-MM') as month_year,
    COALESCE(SUM(o.total_amount), 0) as total_sales,
    COUNT(*)::INTEGER as order_count
  FROM orders o
  WHERE o.status IN ('processing', 'delivered')
    AND o.created_at >= NOW() - INTERVAL '1 month' * months_back
  GROUP BY TO_CHAR(o.created_at, 'YYYY-MM')
  ORDER BY month_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update set total price when products change
CREATE OR REPLACE FUNCTION update_set_total_price()
RETURNS TRIGGER AS $$
DECLARE
  set_id_to_update UUID;
  new_total DECIMAL(10,2);
BEGIN
  -- Determine which set to update
  IF TG_OP = 'DELETE' THEN
    set_id_to_update := OLD.set_id;
  ELSE
    set_id_to_update := NEW.set_id;
  END IF;
  
  -- Calculate new total price
  SELECT COALESCE(SUM(p.price * sp.quantity), 0) INTO new_total
  FROM set_products sp
  JOIN products p ON sp.product_id = p.id
  WHERE sp.set_id = set_id_to_update;
  
  -- Update the set's total price
  UPDATE sets 
  SET total_price = new_total
  WHERE id = set_id_to_update;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update set prices
CREATE TRIGGER update_set_price_on_set_products_change
  AFTER INSERT OR UPDATE OR DELETE ON set_products
  FOR EACH ROW
  EXECUTE FUNCTION update_set_total_price();

-- Function to get products with set information
CREATE OR REPLACE FUNCTION get_products_with_sets()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  price NUMERIC,
  is_featured BOOLEAN,
  is_active BOOLEAN,
  stock_quantity INTEGER,
  category_name TEXT,
  set_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.slug,
    p.description,
    p.price,
    p.is_featured,
    p.is_active,
    p.stock_quantity,
    pc.name as category_name,
    COUNT(DISTINCT sp.set_id)::INTEGER as set_count,
    p.created_at
  FROM products p
  LEFT JOIN product_categories pc ON p.category_id = pc.id
  LEFT JOIN set_products sp ON p.id = sp.product_id
  GROUP BY p.id, p.name, p.slug, p.description, p.price, p.is_featured, 
           p.is_active, p.stock_quantity, pc.name, p.created_at
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get sets with complete product details
CREATE OR REPLACE FUNCTION get_sets_with_products()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  is_active BOOLEAN,
  type TEXT,
  layout_type TEXT,
  show_title_on_home BOOLEAN,
  product_count INTEGER,
  total_value NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.slug,
    s.description,
    s.is_active,
    s.type,
    s.layout_type,
    s.show_title_on_home,
    COUNT(DISTINCT sp.product_id)::INTEGER as product_count,
    COALESCE(SUM(p.price), 0) as total_value,
    s.created_at
  FROM sets s
  LEFT JOIN set_products sp ON s.id = sp.set_id
  LEFT JOIN products p ON sp.product_id = p.id
  GROUP BY s.id, s.name, s.slug, s.description, s.is_active, s.type, 
           s.layout_type, s.show_title_on_home, s.created_at
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get order with items
CREATE OR REPLACE FUNCTION get_order_with_items(order_uuid UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  shipping_name TEXT,
  shipping_email TEXT,
  shipping_address1 TEXT,
  shipping_city TEXT,
  shipping_country TEXT,
  total_amount NUMERIC,
  status TEXT,
  shipping_status TEXT,
  order_details JSONB,
  items JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.user_id,
    o.shipping_name,
    o.shipping_email,
    o.shipping_address1,
    o.shipping_city,
    o.shipping_country,
    o.total_amount,
    o.status,
    o.shipping_status,
    o.order_details,
    COALESCE(
      json_agg(
        json_build_object(
          'id', oi.id,
          'product_name', oi.product_name,
          'product_size', oi.product_size,
          'quantity', oi.quantity,
          'price_at_purchase', oi.price_at_purchase
        )
      ) FILTER (WHERE oi.id IS NOT NULL), 
      '[]'::json
    )::jsonb as items,
    o.created_at
  FROM orders o
  LEFT JOIN order_items oi ON o.id = oi.order_id
  WHERE o.id = order_uuid
  GROUP BY o.id, o.user_id, o.shipping_name, o.shipping_email, 
           o.shipping_address1, o.shipping_city, o.shipping_country,
           o.total_amount, o.status, o.shipping_status, o.order_details, o.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update order status
CREATE OR REPLACE FUNCTION update_order_status(
  order_uuid UUID,
  new_status TEXT,
  new_shipping_status TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE orders 
  SET 
    status = new_status,
    shipping_status = COALESCE(new_shipping_status, shipping_status),
    updated_at = NOW()
  WHERE id = order_uuid;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get inventory report
CREATE OR REPLACE FUNCTION get_inventory_report()
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  category_name TEXT,
  stock_quantity INTEGER,
  price NUMERIC,
  is_active BOOLEAN,
  total_sold INTEGER,
  total_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name as product_name,
    pc.name as category_name,
    p.stock_quantity,
    p.price,
    p.is_active,
    COALESCE(SUM(oi.quantity), 0)::INTEGER as total_sold,
    COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0) as total_revenue
  FROM products p
  LEFT JOIN product_categories pc ON p.category_id = pc.id
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN order_items oi ON pv.id = oi.product_variant_id
  LEFT JOIN orders o ON oi.order_id = o.id AND o.status IN ('processing', 'delivered')
  GROUP BY p.id, p.name, pc.name, p.stock_quantity, p.price, p.is_active
  ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top selling products
CREATE OR REPLACE FUNCTION get_top_selling_products(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  total_quantity INTEGER,
  total_revenue NUMERIC,
  category_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name as product_name,
    COALESCE(SUM(oi.quantity), 0)::INTEGER as total_quantity,
    COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0) as total_revenue,
    pc.name as category_name
  FROM products p
  LEFT JOIN product_categories pc ON p.category_id = pc.id
  LEFT JOIN product_variants pv ON p.id = pv.product_id
  LEFT JOIN order_items oi ON pv.id = oi.product_variant_id
  LEFT JOIN orders o ON oi.order_id = o.id AND o.status IN ('processing', 'delivered')
  GROUP BY p.id, p.name, pc.name
  HAVING SUM(oi.quantity) > 0
  ORDER BY total_quantity DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search products
CREATE OR REPLACE FUNCTION search_products(search_term TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  price NUMERIC,
  is_active BOOLEAN,
  category_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.slug,
    p.description,
    p.price,
    p.is_active,
    pc.name as category_name
  FROM products p
  LEFT JOIN product_categories pc ON p.category_id = pc.id
  WHERE p.name ILIKE '%' || search_term || '%'
     OR p.description ILIKE '%' || search_term || '%'
     OR pc.name ILIKE '%' || search_term || '%'
  ORDER BY 
    CASE WHEN p.name ILIKE search_term || '%' THEN 1 ELSE 2 END,
    p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 