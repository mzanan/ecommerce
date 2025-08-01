# 📦 Supabase Migration Guide for Noir

Complete guide to migrate the Noir backend to any Supabase project.

## 📁 Included Files

- `migrations/001_initial_schema.sql` – Initial schema with tables
- `migrations/002_rls_policies.sql` – Row Level Security (RLS) policies
- `migrations/003_functions_and_triggers.sql` – Automatic functions and triggers
- `migrations/004_additional_rpc_functions.sql` – Extra RPC functions for frontend
- `migrations/005_stock_management.sql` – Stock management system
- `migrations/006_order_email_triggers.sql` – Order email sending triggers

## 🚀 Migration Steps

### 1️⃣ Install Supabase CLI and login
npm install -g supabase
supabase login

### 2️⃣ Initialize and link project
supabase init
supabase link --project-ref your-project-ref

### 3️⃣ Apply migrations
supabase db push

### 4️⃣ Deploy Edge Functions (if you have them)
supabase functions deploy send-order-confirmation
supabase functions deploy stripe-webhook

### 5️⃣ Set secrets for Edge Functions
supabase secrets set STRIPE_SECRET_KEY=sk_test_your-key
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your-key
supabase secrets set SMTP_HOST=smtp.gmail.com
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USER=your-email@gmail.com
supabase secrets set SMTP_PASS=your-app-password

### 6️⃣ Configure environment variables in .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-key
STRIPE_SECRET_KEY=sk_test_your-key
STRIPE_WEBHOOK_SECRET=whsec_your-key
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=https://your-domain.com

### 7️⃣ Create Stripe webhook
- Go to Stripe Dashboard → Developers → Webhooks
- Add endpoint: https://your-project-ref.supabase.co/functions/v1/stripe-webhook
- Listen to events:
  - checkout.session.completed
  - payment_intent.succeeded
  - payment_intent.payment_failed

### 8️⃣ Create the admin user

Go to Supabase → Authentication → Users → Add User.

There you'll see two options:
- **Send Invitation**: enter the email of the new admin user to send them an invitation.
- **Create New User**: enter Email Address and Password, and optionally choose to auto-confirm the account.

After creating the admin user this way, you’ll be able to login to the admin panel.

## ✅ Done!
Your Noir backend should now be running on your new Supabase project.