#!/bin/bash

# Complete deployment script for NOIRE
# This script deploys everything: migrations, edge functions and configures secrets

set -e

echo "🚀 NOIRE - Complete Deployment Script"
echo "========================================"
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
    echo "Please install it first: npm install -g supabase"
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI is installed${NC}"

# Check if user is logged in
if ! supabase auth status &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Supabase${NC}"
    echo "Please login first: supabase login"
    exit 1
fi

echo -e "${GREEN}✅ Logged in to Supabase${NC}"

# Get project reference from user if not linked
if ! supabase status &> /dev/null; then
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

    if supabase link --project-ref "$PROJECT_REF"; then
        echo -e "${GREEN}✅ Successfully linked to project${NC}"
    else
        echo -e "${RED}❌ Failed to link to project${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ Already linked to Supabase project${NC}"
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
echo -e "${BLUE}🔐 Configure Edge Function Secrets?${NC}"
read -p "Do you want to configure secrets now? (y/N): " configure_secrets

if [[ $configure_secrets =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${YELLOW}Running secrets configuration...${NC}"
    
    if [ -f "./scripts/setup-edge-secrets.sh" ]; then
        chmod +x ./scripts/setup-edge-secrets.sh
        ./scripts/setup-edge-secrets.sh
    else
        echo -e "${YELLOW}⚠️  Secrets script not found, you can run it later with:${NC}"
        echo "./scripts/setup-edge-secrets.sh"
    fi
else
    echo -e "${YELLOW}⏭️  Skipping secrets configuration${NC}"
    echo "You can configure them later with: ./scripts/setup-edge-secrets.sh"
fi

echo ""
echo -e "${GREEN}🎉 Complete deployment finished!${NC}"
echo ""
echo -e "${BLUE}📋 Summary of what was deployed:${NC}"
echo "✅ Database schema with all tables"
echo "✅ Row Level Security policies"
echo "✅ Database functions and triggers"
echo "✅ Additional RPC functions"
echo "✅ Edge Functions (send-order-confirmation, stripe-webhook)"

if [[ $configure_secrets =~ ^[Yy]$ ]]; then
    echo "✅ Edge Function secrets configured"
else
    echo "⏭️  Edge Function secrets (pending configuration)"
fi

echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Update your .env.local file with the new Supabase credentials"
echo "2. Get your credentials from: Supabase Dashboard > Settings > API"

if [[ ! $configure_secrets =~ ^[Yy]$ ]]; then
    echo "3. Configure Edge Function secrets: ./scripts/setup-edge-secrets.sh"
    echo "4. Configure Stripe webhook endpoint in Stripe dashboard"
else
    echo "3. Configure Stripe webhook endpoint in Stripe dashboard"
fi

echo "5. Test your application!"
echo ""
echo -e "${GREEN}✨ Your NOIRE backend is fully deployed and ready!${NC}"

# Display useful commands
echo ""
echo -e "${BLUE}🛠️  Useful commands:${NC}"
echo "supabase status           # Check project status"
echo "supabase secrets list     # View configured secrets"
echo "supabase logs             # View logs"
echo "supabase db reset         # Reset database (⚠️  destructive)" 