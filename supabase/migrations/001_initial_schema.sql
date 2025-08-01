-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE layout_type AS ENUM (
  'SINGLE_COLUMN',
  'SPLIT_SMALL_LEFT',
  'SPLIT_SMALL_RIGHT',
  'STAGGERED_THREE',
  'TWO_HORIZONTAL'
);
CREATE TYPE order_status AS ENUM ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- Admin users table (connected to auth.users)
CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product categories table
CREATE TABLE product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  size_guide_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Size guide templates table
CREATE TABLE size_guide_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (char_length(TRIM(BOTH FROM name)) > 0),
  guide_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for size guide
ALTER TABLE product_categories ADD CONSTRAINT product_categories_size_guide_id_fkey 
  FOREIGN KEY (size_guide_id) REFERENCES size_guide_templates(id);

-- Category sizes table
CREATE TABLE category_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES product_categories(id),
  size_name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price NUMERIC NOT NULL CHECK (price >= 0),
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  category_id UUID REFERENCES product_categories(id),
  stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product images table
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  image_url TEXT NOT NULL,
  alt_text TEXT,
  position SMALLINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product variants table
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  size_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sets table
CREATE TABLE sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  type TEXT CHECK (type = ANY (ARRAY['FIDELI'::text, 'INFIDELI'::text])),
  layout_type TEXT CHECK (layout_type = ANY (ARRAY['SINGLE_COLUMN'::text, 'SPLIT_SMALL_LEFT'::text, 'SPLIT_SMALL_RIGHT'::text, 'STAGGERED_THREE'::text, 'TWO_HORIZONTAL'::text])),
  show_title_on_home BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set images table
CREATE TABLE set_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id UUID NOT NULL REFERENCES sets(id),
  image_url TEXT NOT NULL,
  alt_text TEXT,
  position SMALLINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set products relationship table (composite primary key)
CREATE TABLE set_products (
  set_id UUID NOT NULL REFERENCES sets(id),
  product_id UUID NOT NULL REFERENCES products(id),
  position SMALLINT DEFAULT 0,
  PRIMARY KEY (set_id, product_id)
);

-- Orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  shipping_name TEXT NOT NULL,
  shipping_address1 TEXT NOT NULL,
  shipping_address2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT,
  shipping_postal_code TEXT NOT NULL,
  shipping_country TEXT NOT NULL,
  shipping_phone TEXT,
  shipping_email TEXT,
  total_amount NUMERIC NOT NULL,
  payment_intent_id TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'processing' NOT NULL,
  shipping_status TEXT DEFAULT 'pending' CHECK (shipping_status = ANY (ARRAY['pending'::text, 'in_transit'::text, 'delivered'::text])),
  stripe_session_id TEXT,
  order_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order items table
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  product_variant_id UUID NOT NULL REFERENCES product_variants(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_at_purchase NUMERIC NOT NULL CHECK (price_at_purchase >= 0::numeric),
  product_name TEXT NOT NULL,
  product_size TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- App settings table (key-value store)
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Hero content table
CREATE TABLE hero_content (
  id INTEGER PRIMARY KEY DEFAULT 1,
  title TEXT,
  subtitle TEXT,
  image_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Page components table
CREATE TABLE page_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type = ANY (ARRAY['text'::text, 'about'::text])),
  content JSONB NOT NULL,
  position JSONB NOT NULL,
  page_path TEXT DEFAULT '/' NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  display_order INTEGER,
  affiliation TEXT NOT NULL CHECK (affiliation = ANY (ARRAY['FIDELI'::text, 'INFIDELI'::text])),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Homepage layout table (composite primary key)
CREATE TABLE homepage_layout (
  item_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK ((item_type = ANY (ARRAY['page_component'::text, 'set'::text])) AND char_length(TRIM(BOTH FROM item_type)) > 0),
  display_order SMALLINT DEFAULT 0 NOT NULL,
  page_path TEXT DEFAULT '/' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (item_id, page_path)
);

-- Country shipping prices table
CREATE TABLE country_shipping_prices (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  country_code TEXT NOT NULL UNIQUE,
  country_name TEXT,
  shipping_price NUMERIC DEFAULT 0.00 NOT NULL,
  min_delivery_days INTEGER DEFAULT 3,
  max_delivery_days INTEGER DEFAULT 7,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments for important tables
COMMENT ON TABLE app_settings IS 'Almacena configuraciones generales de la aplicación como pares clave-valor.';
COMMENT ON COLUMN orders.shipping_status IS 'Tracks the shipping status of the order: pending, in_transit, delivered.';
COMMENT ON COLUMN orders.order_details IS 'Stores a JSON object or array with detailed information about the products in the order, including product IDs, quantities, and prices at the time of purchase.';
COMMENT ON TABLE country_shipping_prices IS 'Stores shipping prices per country.';
COMMENT ON COLUMN country_shipping_prices.country_code IS 'Country code (e.g., US, ES, MX).';
COMMENT ON COLUMN country_shipping_prices.country_name IS 'Name of the country.';
COMMENT ON COLUMN country_shipping_prices.shipping_price IS 'Shipping price for this country.';

-- Create indexes for better performance
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_slug ON products(slug);

CREATE INDEX idx_sets_is_active ON sets(is_active);
CREATE INDEX idx_sets_slug ON sets(slug);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_variant_id ON order_items(product_variant_id);

-- Function for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_admin_users_updated_at 
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_categories_updated_at 
  BEFORE UPDATE ON product_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_size_guide_templates_updated_at 
  BEFORE UPDATE ON size_guide_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at 
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sets_updated_at 
  BEFORE UPDATE ON sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at 
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_page_components_updated_at 
  BEFORE UPDATE ON page_components
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_homepage_layout_updated_at 
  BEFORE UPDATE ON homepage_layout
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_country_shipping_prices_updated_at 
  BEFORE UPDATE ON country_shipping_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 