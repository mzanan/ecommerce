-- Additional RPC functions for frontend operations

-- Function to get products with their set relationships
DROP FUNCTION IF EXISTS get_products_with_sets() CASCADE;
DROP FUNCTION IF EXISTS get_order_with_items(UUID);
DROP FUNCTION IF EXISTS get_inventory_report();
DROP FUNCTION IF EXISTS get_sets_with_products();
DROP FUNCTION IF EXISTS get_sets_complete();

CREATE OR REPLACE FUNCTION get_products_with_sets()
RETURNS TABLE (
  id UUID,
  name VARCHAR(255),
  description TEXT,
  price DECIMAL(10,2),
  category_name VARCHAR(255),
  is_in_sets BOOLEAN,
  set_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.description,
    p.price,
    c.name as category_name,
    (COUNT(sp.set_id) > 0) as is_in_sets,
    COUNT(sp.set_id)::INTEGER as set_count
  FROM products p
  LEFT JOIN product_categories c ON p.category_id = c.id
  LEFT JOIN set_products sp ON p.id = sp.product_id
  WHERE p.is_active = true
  GROUP BY p.id, p.name, p.description, p.price, c.name
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get sets with their products
CREATE OR REPLACE FUNCTION get_sets_with_products()
RETURNS TABLE (
  id UUID,
  name VARCHAR(255),
  description TEXT,
  total_price DECIMAL(10,2),
  final_price DECIMAL(10,2),
  discount_percentage DECIMAL(5,2),
  layout layout_type,
  product_count INTEGER,
  products JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.name,
    s.description,
    s.total_price,
    s.final_price,
    s.discount_percentage,
    s.layout_type,
    COUNT(sp.product_id)::INTEGER as product_count,
    COALESCE(
      json_agg(
        json_build_object(
          'id', p.id,
          'name', p.name,
          'price', p.price,
          'quantity', sp.quantity,
          'position', sp.position
        ) ORDER BY sp.position
      ) FILTER (WHERE p.id IS NOT NULL),
      '[]'::json
    )::jsonb as products
  FROM sets s
  LEFT JOIN set_products sp ON s.id = sp.set_id
  LEFT JOIN products p ON sp.product_id = p.id AND p.is_active = true
  WHERE s.is_active = true
  GROUP BY s.id, s.name, s.description, s.total_price, s.final_price, 
           s.discount_percentage, s.layout_type
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get order details with items
CREATE OR REPLACE FUNCTION get_order_with_items(order_id UUID)
RETURNS TABLE (
  id UUID,
  shipping_name TEXT,
  shipping_email TEXT,
  shipping_address1 TEXT,
  shipping_address2 TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_postal_code TEXT,
  shipping_country TEXT,
  total_amount NUMERIC,
  status TEXT,
  shipping_status TEXT,
  items JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.shipping_name,
    o.shipping_email,
    o.shipping_address1,
    o.shipping_address2,
    o.shipping_city,
    o.shipping_state,
    o.shipping_postal_code,
    o.shipping_country,
    o.total_amount,
    o.status,
    o.shipping_status,
    COALESCE(
      json_agg(
        json_build_object(
          'id', oi.id,
          'product_name', oi.product_name,
          'product_size', oi.product_size,
          'quantity', oi.quantity,
          'price_at_purchase', oi.price_at_purchase,
          'total_price', oi.quantity * oi.price_at_purchase
        )
      ) FILTER (WHERE oi.id IS NOT NULL),
      '[]'::json
    )::jsonb as items,
    o.created_at
  FROM orders o
  LEFT JOIN order_items oi ON o.id = oi.order_id
  WHERE o.id = order_id
  GROUP BY o.id, o.shipping_name, o.shipping_email, o.shipping_address1,
           o.shipping_address2, o.shipping_city, o.shipping_state,
           o.shipping_postal_code, o.shipping_country, o.total_amount,
           o.status, o.shipping_status, o.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update order status (for admin)
CREATE OR REPLACE FUNCTION update_order_status(
  order_uuid UUID,
  new_status TEXT,
  new_shipping_status TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  updated_rows INTEGER;
BEGIN
  UPDATE orders 
  SET 
    status = new_status,
    shipping_status = COALESCE(new_shipping_status, shipping_status),
    updated_at = NOW()
  WHERE id = order_uuid;
  
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  
  RETURN updated_rows > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get inventory report
CREATE OR REPLACE FUNCTION get_inventory_report()
RETURNS TABLE (
  product_id UUID,
  product_name VARCHAR(255),
  current_stock INTEGER,
  stock_status TEXT,
  category_name VARCHAR(255),
  last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name as product_name,
    p.stock_quantity as current_stock,
    CASE 
      WHEN p.stock_quantity = 0 THEN 'Out of Stock'
      WHEN p.stock_quantity < 10 THEN 'Low Stock'
      WHEN p.stock_quantity < 50 THEN 'Normal'
      ELSE 'In Stock'
    END as stock_status,
    c.name as category_name,
    p.updated_at as last_updated
  FROM products p
  LEFT JOIN product_categories c ON p.category_id = c.id
  WHERE p.is_active = true
  ORDER BY 
    CASE 
      WHEN p.stock_quantity = 0 THEN 1
      WHEN p.stock_quantity < 10 THEN 2
      ELSE 3
    END,
    p.stock_quantity ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get sales analytics by category
CREATE OR REPLACE FUNCTION get_sales_by_category(
  start_date DATE DEFAULT NULL,
  end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  category_name VARCHAR(255),
  total_revenue DECIMAL(10,2),
  total_orders INTEGER,
  total_items_sold INTEGER,
  avg_order_value DECIMAL(10,2)
) AS $$
DECLARE
  filter_start_date DATE;
  filter_end_date DATE;
BEGIN
  -- Set default dates if not provided
  filter_start_date := COALESCE(start_date, CURRENT_DATE - INTERVAL '30 days');
  filter_end_date := COALESCE(end_date, CURRENT_DATE);
  
  RETURN QUERY
  SELECT 
    COALESCE(c.name, 'Uncategorized') as category_name,
    COALESCE(SUM(oi.quantity * oi.price_at_purchase), 0) as total_revenue,
    COUNT(DISTINCT o.id)::INTEGER as total_orders,
    COALESCE(SUM(oi.quantity), 0)::INTEGER as total_items_sold,
    COALESCE(AVG(o.total_amount), 0) as avg_order_value
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
  LEFT JOIN products p ON pv.product_id = p.id
  LEFT JOIN product_categories c ON p.category_id = c.id
  WHERE o.status IN ('processing', 'delivered')
    AND o.created_at::date BETWEEN filter_start_date AND filter_end_date
  GROUP BY c.name
  ORDER BY total_revenue DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get homepage layout with item details
CREATE OR REPLACE FUNCTION get_homepage_layout(page_path_param TEXT DEFAULT '/')
RETURNS TABLE (
  item_id UUID,
  item_type TEXT,
  display_order SMALLINT,
  page_path TEXT,
  item_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hl.item_id,
    hl.item_type,
    hl.display_order,
    hl.page_path,
    CASE 
      WHEN hl.item_type = 'set' THEN
        (SELECT json_build_object(
          'id', s.id,
          'name', s.name,
          'slug', s.slug,
          'description', s.description,
          'is_active', s.is_active,
          'type', s.type,
          'layout_type', s.layout_type,
          'show_title_on_home', s.show_title_on_home
        )::jsonb
        FROM sets s WHERE s.id = hl.item_id)
      WHEN hl.item_type = 'page_component' THEN
        (SELECT json_build_object(
          'id', pc.id,
          'type', pc.type,
          'content', pc.content,
          'position', pc.position,
          'is_active', pc.is_active,
          'display_order', pc.display_order,
          'affiliation', pc.affiliation
        )::jsonb
        FROM page_components pc WHERE pc.id = hl.item_id)
      ELSE '{}'::jsonb
    END as item_details,
    hl.created_at
  FROM homepage_layout hl
  WHERE hl.page_path = page_path_param
  ORDER BY hl.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active page components by affiliation
CREATE OR REPLACE FUNCTION get_page_components_by_affiliation(
  affiliation_param TEXT,
  page_path_param TEXT DEFAULT '/'
)
RETURNS TABLE (
  id UUID,
  type TEXT,
  content JSONB,
  position_data JSONB,
  page_path TEXT,
  is_active BOOLEAN,
  display_order INTEGER,
  affiliation TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id,
    pc.type,
    pc.content,
    pc.position,
    pc.page_path,
    pc.is_active,
    pc.display_order,
    pc.affiliation,
    pc.created_at
  FROM page_components pc
  WHERE pc.affiliation = affiliation_param
    AND pc.page_path = page_path_param
    AND pc.is_active = true
  ORDER BY pc.display_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get sets with images and products
CREATE OR REPLACE FUNCTION get_sets_complete()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  is_active BOOLEAN,
  type TEXT,
  layout_type TEXT,
  show_title_on_home BOOLEAN,
  images JSONB,
  products JSONB,
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
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', si.id,
          'image_url', si.image_url,
          'alt_text', si.alt_text,
          'position', si.position
        ) ORDER BY si.position
      )
      FROM set_images si WHERE si.set_id = s.id),
      '[]'::json
    )::jsonb as images,
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', p.id,
          'name', p.name,
          'slug', p.slug,
          'price', p.price,
          'position', sp.position,
          'images', (
            SELECT json_agg(
              json_build_object(
                'id', pi.id,
                'image_url', pi.image_url,
                'alt_text', pi.alt_text,
                'position', pi.position
              ) ORDER BY pi.position
            )
            FROM product_images pi WHERE pi.product_id = p.id
          )
        ) ORDER BY sp.position
      )
      FROM set_products sp
      JOIN products p ON sp.product_id = p.id
      WHERE sp.set_id = s.id),
      '[]'::json
    )::jsonb as products,
    s.created_at
  FROM sets s
  WHERE s.is_active = true
  ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get a single set with complete details
CREATE OR REPLACE FUNCTION get_set_by_slug(set_slug TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  is_active BOOLEAN,
  type TEXT,
  layout_type TEXT,
  show_title_on_home BOOLEAN,
  images JSONB,
  products JSONB,
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
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', si.id,
          'image_url', si.image_url,
          'alt_text', si.alt_text,
          'position', si.position
        ) ORDER BY si.position
      )
      FROM set_images si WHERE si.set_id = s.id),
      '[]'::json
    )::jsonb as images,
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', p.id,
          'name', p.name,
          'slug', p.slug,
          'description', p.description,
          'price', p.price,
          'is_active', p.is_active,
          'stock_quantity', p.stock_quantity,
          'position', sp.position,
          'images', (
            SELECT json_agg(
              json_build_object(
                'id', pi.id,
                'image_url', pi.image_url,
                'alt_text', pi.alt_text,
                'position', pi.position
              ) ORDER BY pi.position
            )
            FROM product_images pi WHERE pi.product_id = p.id
          ),
          'variants', (
            SELECT json_agg(
              json_build_object(
                'id', pv.id,
                'size_name', pv.size_name
              )
            )
            FROM product_variants pv WHERE pv.product_id = p.id
          )
        ) ORDER BY sp.position
      )
      FROM set_products sp
      JOIN products p ON sp.product_id = p.id
      WHERE sp.set_id = s.id),
      '[]'::json
    )::jsonb as products,
    s.created_at
  FROM sets s
  WHERE s.slug = set_slug AND s.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get products with complete details
CREATE OR REPLACE FUNCTION get_products_complete()
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  price NUMERIC,
  is_featured BOOLEAN,
  is_active BOOLEAN,
  stock_quantity INTEGER,
  category JSONB,
  images JSONB,
  variants JSONB,
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
    CASE WHEN pc.id IS NOT NULL THEN
      json_build_object(
        'id', pc.id,
        'name', pc.name
      )::jsonb
    ELSE NULL::jsonb
    END as category,
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', pi.id,
          'image_url', pi.image_url,
          'alt_text', pi.alt_text,
          'position', pi.position
        ) ORDER BY pi.position
      )
      FROM product_images pi WHERE pi.product_id = p.id),
      '[]'::json
    )::jsonb as images,
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', pv.id,
          'size_name', pv.size_name
        )
      )
      FROM product_variants pv WHERE pv.product_id = p.id),
      '[]'::json
    )::jsonb as variants,
    p.created_at
  FROM products p
  LEFT JOIN product_categories pc ON p.category_id = pc.id
  WHERE p.is_active = true
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get a single product by slug
CREATE OR REPLACE FUNCTION get_product_by_slug(product_slug TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  description TEXT,
  price NUMERIC,
  is_featured BOOLEAN,
  is_active BOOLEAN,
  stock_quantity INTEGER,
  category JSONB,
  images JSONB,
  variants JSONB,
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
    CASE WHEN pc.id IS NOT NULL THEN
      json_build_object(
        'id', pc.id,
        'name', pc.name
      )::jsonb
    ELSE NULL::jsonb
    END as category,
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', pi.id,
          'image_url', pi.image_url,
          'alt_text', pi.alt_text,
          'position', pi.position
        ) ORDER BY pi.position
      )
      FROM product_images pi WHERE pi.product_id = p.id),
      '[]'::json
    )::jsonb as images,
    COALESCE(
      (SELECT json_agg(
        json_build_object(
          'id', pv.id,
          'size_name', pv.size_name
        )
      )
      FROM product_variants pv WHERE pv.product_id = p.id),
      '[]'::json
    )::jsonb as variants,
    p.created_at
  FROM products p
  LEFT JOIN product_categories pc ON p.category_id = pc.id
  WHERE p.slug = product_slug AND p.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get shipping price for a country
CREATE OR REPLACE FUNCTION get_shipping_price_for_country(country_code_param TEXT)
RETURNS TABLE (
  country_code TEXT,
  country_name TEXT,
  shipping_price NUMERIC,
  min_delivery_days INTEGER,
  max_delivery_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    csp.country_code,
    csp.country_name,
    csp.shipping_price,
    csp.min_delivery_days,
    csp.max_delivery_days
  FROM country_shipping_prices csp
  WHERE csp.country_code = UPPER(country_code_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all available countries for shipping
CREATE OR REPLACE FUNCTION get_available_shipping_countries()
RETURNS TABLE (
  country_code TEXT,
  country_name TEXT,
  shipping_price NUMERIC,
  min_delivery_days INTEGER,
  max_delivery_days INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    csp.country_code,
    csp.country_name,
    csp.shipping_price,
    csp.min_delivery_days,
    csp.max_delivery_days
  FROM country_shipping_prices csp
  ORDER BY csp.country_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get hero content
CREATE OR REPLACE FUNCTION get_hero_content()
RETURNS TABLE (
  id INTEGER,
  title TEXT,
  subtitle TEXT,
  image_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    hc.id,
    hc.title,
    hc.subtitle,
    hc.image_url,
    hc.updated_at
  FROM hero_content hc
  ORDER BY hc.id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update hero content
CREATE OR REPLACE FUNCTION update_hero_content(
  new_title TEXT DEFAULT NULL,
  new_subtitle TEXT DEFAULT NULL,
  new_image_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE hero_content 
  SET 
    title = COALESCE(new_title, title),
    subtitle = COALESCE(new_subtitle, subtitle),
    image_url = COALESCE(new_image_url, image_url),
    updated_at = NOW()
  WHERE id = 1;
  
  -- If no row exists, insert one
  IF NOT FOUND THEN
    INSERT INTO hero_content (id, title, subtitle, image_url)
    VALUES (1, new_title, new_subtitle, new_image_url);
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get app settings
CREATE OR REPLACE FUNCTION get_app_setting(setting_key TEXT)
RETURNS TEXT AS $$
DECLARE
  setting_value TEXT;
BEGIN
  SELECT value INTO setting_value
  FROM app_settings
  WHERE key = setting_key;
  
  RETURN setting_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set app settings
CREATE OR REPLACE FUNCTION set_app_setting(setting_key TEXT, setting_value TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO app_settings (key, value)
  VALUES (setting_key, setting_value)
  ON CONFLICT (key) 
  DO UPDATE SET value = setting_value;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on all functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon; 