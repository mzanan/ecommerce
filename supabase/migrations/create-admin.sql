-- Script to create initial admin user for Infideli
-- Execute this after deploying all migrations

-- Function to create initial admin user (bypasses RLS)
CREATE OR REPLACE FUNCTION create_initial_admin(
  auth_user_id UUID,
  admin_name TEXT DEFAULT 'Admin User'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_admin_id UUID;
BEGIN
  -- Check if admin already exists
  SELECT id INTO new_admin_id FROM admin_users WHERE id = auth_user_id;
  
  IF new_admin_id IS NOT NULL THEN
    RAISE NOTICE 'Admin user already exists with ID: %', auth_user_id;
    RETURN new_admin_id;
  END IF;
  
  -- Check if auth user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = auth_user_id) THEN
    RAISE EXCEPTION 'Auth user with ID % does not exist. Create the user in Supabase Auth first.', auth_user_id;
  END IF;
  
  -- Create new admin user
  INSERT INTO admin_users (id, full_name)
  VALUES (auth_user_id, admin_name)
  RETURNING id INTO new_admin_id;
  
  RAISE NOTICE 'Created new admin user: % with ID: %', admin_name, new_admin_id;
  RETURN new_admin_id;
END;
$$;

-- Example usage:
-- First create a user in Supabase Auth Dashboard, then use their UUID:
-- SELECT create_initial_admin('your-auth-user-uuid', 'Admin Name');

-- To run this script:
-- 1. Deploy all migrations first: supabase db push
-- 2. Create a user in Supabase Auth Dashboard and copy their UUID
-- 3. Execute this function with the UUID: SELECT create_initial_admin('uuid-here', 'Admin Name');

-- Alternative: Create admin via direct INSERT (if you have the auth user ID)
-- INSERT INTO admin_users (id, full_name) VALUES ('your-auth-user-uuid', 'Admin Name');

-- After creating admin, you can drop the function if you want:
-- DROP FUNCTION IF EXISTS create_initial_admin(UUID, TEXT);