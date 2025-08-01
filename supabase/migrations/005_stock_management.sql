-- Stock Management System - Complete Implementation
-- This migration creates a robust stock management system with proper triggers

-- 1. Function to update stock when an order is placed
CREATE OR REPLACE FUNCTION update_stock_for_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  item_record RECORD;
  current_stock INTEGER;
BEGIN
  -- Get all order items for this order with product_id from product_variants
  FOR item_record IN 
    SELECT 
      pv.product_id,
      oi.quantity
    FROM order_items oi
    JOIN product_variants pv ON oi.product_variant_id = pv.id
    WHERE oi.order_id = order_uuid
  LOOP
    -- Get current stock for this product
    SELECT stock_quantity INTO current_stock
    FROM products 
    WHERE id = item_record.product_id;
    
    -- Update stock only if there's enough stock
    IF current_stock >= item_record.quantity THEN
      UPDATE products 
      SET 
        stock_quantity = stock_quantity - item_record.quantity,
        updated_at = NOW()
      WHERE id = item_record.product_id;
      
      -- Log the stock update
      INSERT INTO stock_movements (
        product_id,
        movement_type,
        quantity_change,
        new_stock_level,
        reference_type,
        reference_id,
        created_at
      ) VALUES (
        item_record.product_id,
        'sale',
        -item_record.quantity,
        current_stock - item_record.quantity,
        'order',
        order_uuid,
        NOW()
      );
    ELSE
      -- Not enough stock - this should have been caught earlier
      RAISE EXCEPTION 'Insufficient stock for product ID %: available %, requested %', 
        item_record.product_id, current_stock, item_record.quantity;
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Function to check available stock for a product
CREATE OR REPLACE FUNCTION get_available_stock(product_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  SELECT stock_quantity INTO current_stock
  FROM products
  WHERE id = product_uuid AND is_active = true;
  
  RETURN COALESCE(current_stock, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Function to validate cart items against current stock
CREATE OR REPLACE FUNCTION validate_cart_stock(
  cart_items JSONB
)
RETURNS TABLE (
  product_id UUID,
  available_stock INTEGER,
  requested_quantity INTEGER,
  is_valid BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  item_record RECORD;
  current_stock INTEGER;
BEGIN
  -- Group cart items by product_id and sum quantities
  FOR item_record IN
    SELECT 
      (item->>'productId')::UUID as product_id,
      SUM((item->>'quantity')::INTEGER) as total_quantity
    FROM jsonb_array_elements(cart_items) as item
    GROUP BY (item->>'productId')::UUID
  LOOP
    -- Get current stock for this product
    SELECT stock_quantity INTO current_stock
    FROM products
    WHERE id = item_record.product_id AND is_active = true;
    
    current_stock := COALESCE(current_stock, 0);
    
    RETURN QUERY SELECT
      item_record.product_id,
      current_stock,
      item_record.total_quantity::INTEGER,
      (current_stock >= item_record.total_quantity),
      CASE 
        WHEN current_stock >= item_record.total_quantity THEN NULL
        ELSE 'Insufficient stock: available ' || current_stock || ', requested ' || item_record.total_quantity
      END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create stock_movements table for tracking stock changes
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'restock', 'adjustment', 'return')),
  quantity_change INTEGER NOT NULL, -- Negative for decreases, positive for increases
  new_stock_level INTEGER NOT NULL,
  reference_type TEXT, -- 'order', 'manual', 'return', etc.
  reference_id UUID, -- Reference to order, return, etc.
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID -- For manual adjustments
);

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- 6. Trigger function for order items (CORRECT LOCATION)
CREATE OR REPLACE FUNCTION trigger_stock_update_on_order_item()
RETURNS TRIGGER AS $$
DECLARE
  order_status TEXT;
  existing_movements INTEGER;
BEGIN
  -- Get the order status
  SELECT status INTO order_status
  FROM orders 
  WHERE id = NEW.order_id;
  
  -- Only proceed if the order is paid
  IF order_status = 'paid' THEN
    -- Check if we already processed this order (avoid duplicate processing)
    SELECT COUNT(*) INTO existing_movements
    FROM stock_movements 
    WHERE reference_type = 'order' AND reference_id = NEW.order_id;
    
    IF existing_movements = 0 THEN
      PERFORM update_stock_for_order(NEW.order_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Create the trigger on order_items table (CORRECT TABLE)
DROP TRIGGER IF EXISTS order_items_stock_update ON order_items;
CREATE TRIGGER order_items_stock_update
  AFTER INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_stock_update_on_order_item();

-- 8. Function to restore stock when an order is cancelled
CREATE OR REPLACE FUNCTION restore_stock_for_cancelled_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  item_record RECORD;
  current_stock INTEGER;
BEGIN
  -- Get all order items for this order and restore stock
  FOR item_record IN 
    SELECT 
      pv.product_id,
      oi.quantity
    FROM order_items oi
    JOIN product_variants pv ON oi.product_variant_id = pv.id
    WHERE oi.order_id = order_uuid
  LOOP
    -- Get current stock
    SELECT stock_quantity INTO current_stock
    FROM products 
    WHERE id = item_record.product_id;
    
    -- Restore stock
    UPDATE products 
    SET 
      stock_quantity = stock_quantity + item_record.quantity,
      updated_at = NOW()
    WHERE id = item_record.product_id;
    
    -- Log the stock restoration
    INSERT INTO stock_movements (
      product_id,
      movement_type,
      quantity_change,
      new_stock_level,
      reference_type,
      reference_id,
      created_at
    ) VALUES (
      item_record.product_id,
      'return',
      item_record.quantity,
      current_stock + item_record.quantity,
      'cancelled_order',
      order_uuid,
      NOW()
    );
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Clean up old/incorrect triggers from orders table
DROP TRIGGER IF EXISTS order_paid_stock_update ON orders;
DROP TRIGGER IF EXISTS order_status_stock_update ON orders;

-- Enable RLS for stock_movements table
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_movements
CREATE POLICY "Admin full access to stock_movements" ON stock_movements
FOR ALL USING (
  public.is_admin()
);

CREATE POLICY "Public read access to stock_movements" ON stock_movements
FOR SELECT USING (true);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_stock_for_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_stock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_cart_stock(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_stock_for_cancelled_order(UUID) TO authenticated; 