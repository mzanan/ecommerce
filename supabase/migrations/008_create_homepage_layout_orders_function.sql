-- Create composite type for homepage layout updates
CREATE TYPE IF NOT EXISTS public.homepage_layout_upsert_item AS (
  item_id UUID,
  item_type TEXT,
  new_display_order INTEGER
);

-- Create function to update homepage layout orders
CREATE OR REPLACE FUNCTION public.update_homepage_layout_orders(
  p_page_path TEXT,
  items_to_insert homepage_layout_upsert_item[]
) RETURNS VOID AS $$
DECLARE
  item homepage_layout_upsert_item;
BEGIN
  FOREACH item IN ARRAY items_to_insert
  LOOP
    INSERT INTO public.homepage_layout (
      item_id,
      item_type,
      page_path,
      display_order,
      updated_at
    ) VALUES (
      item.item_id,
      item.item_type,
      p_page_path,
      item.new_display_order,
      NOW()
    )
    ON CONFLICT (item_id, page_path)
    DO UPDATE SET
      display_order = EXCLUDED.display_order,
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

