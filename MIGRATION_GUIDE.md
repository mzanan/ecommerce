# Supabase Migration Guide for Infideli

This document explains how to completely migrate the Infideli project to a new Supabase account.

## 🎯 Overview

The project includes **all necessary migrations and configurations** to deploy the complete backend to any Supabase account with just a few commands.

## 📁 Included Files

### Database Migrations
- `supabase/migrations/001_initial_schema.sql` - Complete schema with all tables
- `supabase/migrations/002_rls_policies.sql` - Row Level Security policies
- `supabase/migrations/003_functions_and_triggers.sql` - Automatic functions and triggers
- `supabase/migrations/004_additional_rpc_functions.sql` - Additional RPC functions for frontend
- `supabase/migrations/005_stock_management.sql` - Stock management system with automatic triggers

### Edge Functions
- `supabase/functions/send-order-confirmation/` - Email confirmation sending
- `supabase/functions/stripe-webhook/` - Stripe webhook processing

### Configuration Scripts
- `supabase/setup-supabase.sh` - Automatic configuration script (database only)
- `scripts/deploy-complete.sh` - Complete script with DB, Edge Functions and secrets
- `scripts/setup-edge-secrets.sh` - Edge Functions secrets configuration
- `supabase/config.toml` - Project configuration
- `supabase/create-admin.sql` - Script to create first admin user (execute after migrations)

## 🚀 Automatic Migration (Recommended)

### Option 1: Complete Deployment (Recommended)
```bash
# Script that does everything automatically
chmod +x scripts/deploy-complete.sh
./scripts/deploy-complete.sh
```

This script:
- ✅ Verifies prerequisites
- 🔗 Connects to Supabase project
- 📊 Deploys all migrations
- 🔧 Deploys Edge Functions
- 🔐 Optionally configures secrets
- 📋 Shows next steps

### Option 2: Database Only
```bash
# Only migrations and Edge Functions (without secrets)
chmod +x supabase/setup-supabase.sh
./supabase/setup-supabase.sh
```

### 1. Prerequisites
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login
```

### 2. Run Configuration Script
```bash
# Make the script executable
chmod +x supabase/setup-supabase.sh

# Run automatic configuration
./supabase/setup-supabase.sh
```

The script will ask for:
- **Project Reference ID**: Your Supabase project ID (e.g., `abc123def456`)

### 3. Configure Environment Variables
After the script, update your `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-key
STRIPE_SECRET_KEY=sk_test_your-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Next.js Configuration
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=your-domain-url
```

### 4. Configure Secrets for Edge Functions
```bash
# Configure Stripe secrets
supabase secrets set STRIPE_SECRET_KEY=sk_test_your-secret-key
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# Configure SMTP for emails
supabase secrets set SMTP_HOST=your-smtp-host
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USER=your-email@domain.com
supabase secrets set SMTP_PASS=your-email-password
```

### 5. Configure Webhook in Stripe
1. Go to your Stripe Dashboard
2. Navigate to **Developers > Webhooks**
3. Create a new endpoint:
   - **URL**: `https://your-project-ref.supabase.co/functions/v1/stripe-webhook`
   - **Events**:
     - `checkout.session.completed`
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`

## 🔧 Manual Migration

If you prefer step-by-step migration:

### 1. Initialize Project
```bash
supabase init
supabase link --project-ref your-project-ref
```

### 2. Deploy Migrations
```bash
# Deploy all migrations in order
supabase db push
```

### 3. Deploy Edge Functions
```bash
supabase functions deploy send-order-confirmation
supabase functions deploy stripe-webhook
```

## 📊 Database Structure

### Main Tables
- **categories** - Product categories (FIDELI, INFIDELI, etc.)
- **products** - Individual products
- **sets** - Product sets with layouts
- **set_products** - Many-to-many relationship between sets and products
- **orders** - Customer orders
- **order_items** - Individual items in each order
- **admin_users** - Administrator users

### Configuration Tables
- **homepage_sections** - Homepage sections
- **hero_settings** - Hero configuration
- **size_guides** - Size guides
- **shipping_zones** - Shipping zones
- **about_content** - About page content

### Included Functions
- `generate_order_number()` - Automatic order number generation
- `get_dashboard_stats()` - Dashboard statistics
- `get_recent_orders()` - Recent orders
- `get_monthly_sales()` - Monthly sales
- `search_products()` - Product search
- `get_products_with_sets()` - Products with set information
- `get_sets_with_products()` - Sets with complete product details
- `get_order_with_items()` - Complete order details
- `update_order_status()` - Order status updates
- `get_inventory_report()` - Inventory report
- `get_top_selling_products()` - Best selling products
- `get_sales_by_category()` - Sales analysis by category

### Stock Management System
- `update_stock_for_order()` - Automatically reduces stock when orders are paid
- `get_available_stock()` - Gets current stock for any product
- `validate_cart_stock()` - Validates cart items against current stock
- `restore_stock_for_cancelled_order()` - Restores stock for cancelled orders
- **Automatic triggers** - Stock is reduced automatically when orders are completed
- **Stock movements table** - Complete audit trail of all stock changes
- **Real-time validation** - Prevents overselling with database-level checks

## 🔐 Security (RLS)

All tables have **Row Level Security** enabled with policies that:

- ✅ Allow public reading of active content
- 🔒 Require authentication for write operations
- 👤 Users can only see their own orders
- 🛡️ Admins have full access
- 📊 Stock movements: Admin write access, public read access for transparency

## 📧 Email Configuration

Edge Functions require SMTP configuration for email sending:

```bash
supabase secrets set SMTP_HOST=smtp.gmail.com
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USER=your-email@gmail.com
supabase secrets set SMTP_PASS=your-app-password
```

## 🧪 Migration Verification

### 1. Verify Tables
```sql
-- Execute in Supabase SQL Editor
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

### 2. Verify Database Structure
```sql
-- Verify all tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verify RLS policies are active
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;
```

### 3. Verify Edge Functions
- Go to **Edge Functions** in your Supabase dashboard
- You should see `send-order-confirmation` and `stripe-webhook`

## 👤 Admin User Setup

**ℹ️ NOTE**: No default admin users are included for security. 

To create your first admin user after deploying migrations:

**Option 1: Using the provided script (recommended)**
```bash
# Execute the admin creation script
supabase db push --file supabase/create-admin.sql

# Then in Supabase SQL Editor:
SELECT create_initial_admin('your-email@domain.com', 'Your Name', 'secure-password');
```

**Option 2: Manual creation**
```sql
-- Create admin user directly (execute in Supabase SQL Editor)
INSERT INTO admin_users (email, password_hash, name, role) VALUES
('your-email@domain.com', crypt('your_secure_password', gen_salt('bf')), 'Admin User', 'admin');
```

The script approach is safer as it bypasses RLS policies and includes additional validations.

## 📦 Stock Management System

The migration includes a comprehensive stock management system that:

### ✅ Features
- **Automatic stock deduction** when orders are marked as 'paid'
- **Real-time stock validation** in cart and checkout
- **Shared stock across variants** - all sizes share the same product stock
- **Prevents overselling** with database-level constraints
- **Complete audit trail** in `stock_movements` table with RLS policies
- **Stock restoration** for cancelled orders
- **Admin-only write access** to stock movements for security
- **Public read access** for transparency and audit purposes

### 🔧 How It Works
1. **Stock Validation**: Cart items are validated against real database stock
2. **Order Processing**: When an order is completed with `status = 'paid'`:
   - Trigger fires on `order_items` INSERT
   - Stock is automatically reduced for each product
   - Movements are logged in `stock_movements` table
3. **Real-time Updates**: Frontend components use `useProductStock` hook for live stock data
4. **Variant Management**: All product variants (sizes) share the same stock pool

### 🗄️ Database Tables
- **`stock_movements`** - Audit trail of all stock changes
- **`products.stock_quantity`** - Current stock level for each product
- **Automatic triggers** on `order_items` table

### 🚨 Important Notes
- Stock is shared between ALL variants of the same product
- When stock reaches 0, ALL sizes show as "Out of Stock"
- System prevents multiple users from over-purchasing
- Stock updates happen at the database level for consistency

## 🔄 Future Updates

To apply new migrations:

```bash
# Create new migration
supabase migration new migration_name

# Apply migrations
supabase db push
```

## 📞 Support

If you encounter issues during migration:

1. Verify all environment variables are configured
2. Confirm Supabase CLI is updated
3. Check Edge Function logs in dashboard
4. Verify webhook configuration in Stripe

---

**✅ With this migration you'll have the complete Infideli backend running on your new Supabase account.** 