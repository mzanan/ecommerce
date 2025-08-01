#!/bin/bash

# Infideli Supabase Setup Script
# This script sets up the complete Supabase backend for the Infideli project

set -e

echo "🚀 Infideli Supabase Setup"
echo "=========================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI is not installed.${NC}"
    echo "Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI is installed${NC}"

# Check if user is logged in
if ! supabase auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Supabase${NC}"
    echo "Please login first:"
    echo "supabase login"
    exit 1
fi

echo -e "${GREEN}✅ Logged in to Supabase${NC}"

# Get project reference from user
echo ""
echo -e "${BLUE}📝 Enter your Supabase project reference ID:${NC}"
echo "(You can find this in your Supabase dashboard URL)"
read -p "Project Ref: " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo -e "${RED}❌ Project reference is required${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔗 Linking to project: $PROJECT_REF${NC}"

# Link to the project
if supabase link --project-ref "$PROJECT_REF"; then
    echo -e "${GREEN}✅ Successfully linked to project${NC}"
else
    echo -e "${RED}❌ Failed to link to project${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📊 Deploying database migrations...${NC}"

# Push all migrations
if supabase db push; then
    echo -e "${GREEN}✅ Database migrations deployed successfully${NC}"
else
    echo -e "${RED}❌ Failed to deploy migrations${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}🔧 Deploying Edge Functions...${NC}"

# Deploy Edge Functions
echo "Deploying send-order-confirmation function..."
if supabase functions deploy send-order-confirmation; then
    echo -e "${GREEN}✅ send-order-confirmation function deployed${NC}"
else
    echo -e "${YELLOW}⚠️  Failed to deploy send-order-confirmation function${NC}"
fi

echo "Deploying stripe-webhook function..."
if supabase functions deploy stripe-webhook; then
    echo -e "${GREEN}✅ stripe-webhook function deployed${NC}"
else
    echo -e "${YELLOW}⚠️  Failed to deploy stripe-webhook function${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Supabase setup completed!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Update your .env.local file with the new Supabase credentials:"
echo "   - NEXT_PUBLIC_SUPABASE_URL"
echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "   - SUPABASE_SERVICE_ROLE_KEY"
echo ""
echo "2. Get your credentials from: https://supabase.com/dashboard/project/$PROJECT_REF/settings/api"
echo ""
echo "3. Configure Stripe webhook endpoint in your Stripe dashboard:"
echo "   - Endpoint URL: https://your-project-ref.supabase.co/functions/v1/stripe-webhook"
echo "   - Events to listen for: checkout.session.completed, payment_intent.succeeded, payment_intent.payment_failed"
echo ""
echo "4. Update environment variables for Edge Functions:"
echo "   supabase secrets set STRIPE_SECRET_KEY=sk_test_..."
echo "   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_..."
echo "   supabase secrets set SMTP_HOST=your-smtp-host"
echo "   supabase secrets set SMTP_PORT=587"
echo "   supabase secrets set SMTP_USER=your-email"
echo "   supabase secrets set SMTP_PASS=your-password"
echo ""
echo -e "${GREEN}✨ Your Infideli backend is ready!${NC}" 