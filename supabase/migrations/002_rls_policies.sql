-- Helper function to check if user is admin (prevents RLS recursion)
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE id = auth.uid()
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.is_admin() TO anon;

-- Enable Row Level Security
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE size_guide_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE homepage_layout ENABLE ROW LEVEL SECURITY;
ALTER TABLE country_shipping_prices ENABLE ROW LEVEL SECURITY;

-- Admin users policies
CREATE POLICY "Admins can view all admin_users" ON admin_users
  FOR SELECT USING (auth.is_admin());

CREATE POLICY "Admins can insert admin_users" ON admin_users
  FOR INSERT WITH CHECK (auth.is_admin());

CREATE POLICY "Admins can update admin_users" ON admin_users
  FOR UPDATE USING (auth.is_admin());

CREATE POLICY "Admins can delete admin_users" ON admin_users
  FOR DELETE USING (auth.is_admin());

-- Product categories policies (public read, admin write)
CREATE POLICY "Public can view product_categories" ON product_categories
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage product_categories" ON product_categories
  FOR ALL USING (auth.is_admin()) WITH CHECK (auth.is_admin());

-- Size guide templates policies (public read, admin write)
CREATE POLICY "Public can view size_guide_templates" ON size_guide_templates
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage size_guide_templates" ON size_guide_templates
  FOR ALL USING (auth.is_admin()) WITH CHECK (auth.is_admin());

-- Category sizes policies (public read, admin write)
CREATE POLICY "Public can view category_sizes" ON category_sizes
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage category_sizes" ON category_sizes
  FOR ALL USING (auth.is_admin()) WITH CHECK (auth.is_admin());

-- Products policies (public read active products, admin manage all)
CREATE POLICY "Public can view active products" ON products
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage products" ON products
  FOR ALL USING (auth.is_admin()) WITH CHECK (auth.is_admin());

-- Product images policies (public read, admin write)
CREATE POLICY "Public can view product_images" ON product_images
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage product_images" ON product_images
  FOR ALL USING (auth.is_admin()) WITH CHECK (auth.is_admin());

-- Product variants policies (public read, admin write)
CREATE POLICY "Public can view product_variants" ON product_variants
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage product_variants" ON product_variants
  FOR ALL USING (auth.is_admin()) WITH CHECK (auth.is_admin());

-- Sets policies (public read active sets, admin manage all)
CREATE POLICY "Public can view active sets" ON sets
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage sets" ON sets
  FOR ALL USING (auth.is_admin()) WITH CHECK (auth.is_admin());

-- Set images policies (public read, admin write)
CREATE POLICY "Public can view set_images" ON set_images
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage set_images" ON set_images
  FOR ALL USING (auth.is_admin()) WITH CHECK (auth.is_admin());

-- Set products policies (public read, admin write)
CREATE POLICY "Public can view set_products" ON set_products
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage set_products" ON set_products
  FOR ALL USING (auth.is_admin()) WITH CHECK (auth.is_admin());

-- Orders policies (users can see their own orders, admins see all)
CREATE POLICY "Anyone can create orders" ON orders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own orders" ON orders
  FOR SELECT USING (
    user_id = auth.uid() OR 
    shipping_email = auth.jwt() ->> 'email' OR 
    auth.is_admin()
  );

CREATE POLICY "Admins can manage all orders" ON orders
  FOR ALL USING (auth.is_admin()) WITH CHECK (auth.is_admin());

-- Order items policies (follow parent order policies)
CREATE POLICY "Public can insert order items" ON order_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their order items" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id 
      AND (orders.user_id = auth.uid() OR orders.shipping_email = auth.jwt() ->> 'email')
    ) OR auth.is_admin()
  );

CREATE POLICY "Admins have full access to order items" ON order_items
  FOR ALL USING (auth.is_admin()) WITH CHECK (auth.is_admin());

-- App settings policies (public read, admin write)
CREATE POLICY "Public can view app_settings" ON app_settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage app_settings" ON app_settings
  FOR ALL USING (auth.is_admin()) WITH CHECK (auth.is_admin());

-- Hero content policies (public read, admin write)
CREATE POLICY "Public can view hero_content" ON hero_content
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage hero_content" ON hero_content
  FOR ALL USING (auth.is_admin()) WITH CHECK (auth.is_admin());

-- Page components policies (public read active components, admin manage all)
CREATE POLICY "Public can view active page_components" ON page_components
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage page_components" ON page_components
  FOR ALL USING (auth.is_admin()) WITH CHECK (auth.is_admin());

-- Homepage layout policies (public read, admin write)
CREATE POLICY "Public can view homepage_layout" ON homepage_layout
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage homepage_layout" ON homepage_layout
  FOR ALL USING (auth.is_admin()) WITH CHECK (auth.is_admin());

-- Country shipping prices policies (public read, admin write)
CREATE POLICY "Public can view country_shipping_prices" ON country_shipping_prices
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage country_shipping_prices" ON country_shipping_prices
  FOR ALL USING (auth.is_admin()) WITH CHECK (auth.is_admin()); 