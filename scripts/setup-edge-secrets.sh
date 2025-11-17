#!/bin/bash

# Script to configure NOIRE Edge Function secrets
# This script configures all necessary environment variables for Edge Functions

set -e

echo "🔐 Configuring Supabase Edge Function Secrets"
echo "=============================================="
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
echo ""

# Function to set secret with validation
set_secret() {
    local key=$1
    local description=$2
    local example=$3
    
    echo -e "${BLUE}📝 $description${NC}"
    echo "Example: $example"
    read -p "Value: " value
    
    if [ -z "$value" ]; then
        echo -e "${YELLOW}⚠️  Skipping $key (empty value)${NC}"
        return
    fi
    
    if supabase secrets set "$key=$value"; then
        echo -e "${GREEN}✅ $key configured${NC}"
    else
        echo -e "${RED}❌ Failed to set $key${NC}"
    fi
    echo ""
}

echo -e "${YELLOW}🔧 Configuring Stripe secrets...${NC}"
set_secret "STRIPE_SECRET_KEY" "Stripe Secret Key" "sk_test_..."
set_secret "STRIPE_WEBHOOK_SECRET" "Stripe Webhook Secret" "whsec_..."

echo -e "${YELLOW}📧 Configuring SMTP settings for email notifications...${NC}"
set_secret "SMTP_HOST" "SMTP Host" "smtp.gmail.com"
set_secret "SMTP_PORT" "SMTP Port" "587"
set_secret "SMTP_USER" "SMTP Username/Email" "your-email@gmail.com"
set_secret "SMTP_PASS" "SMTP Password/App Password" "your-app-password"

echo -e "${YELLOW}🌐 Configuring application URLs...${NC}"
set_secret "NEXT_PUBLIC_APP_URL" "Your app URL (for emails)" "https://your-domain.com"

echo ""
echo -e "${GREEN}🎉 Edge Function secrets configuration completed!${NC}"
echo ""
echo -e "${BLUE}📋 Next steps:${NC}"
echo "1. Verify secrets are set: supabase secrets list"
echo "2. Test your Edge Functions:"
echo "   - Send test order confirmation: Test order creation flow"
echo "   - Test Stripe webhook: Create test payment in Stripe"
echo ""
echo -e "${YELLOW}⚠️  Important notes:${NC}"
echo "- For Gmail SMTP, use App Passwords, not your regular password"
echo "- Test emails will be sent to real addresses, use test emails"
echo "- Stripe webhook endpoint should be configured in your Stripe dashboard"
echo ""
echo -e "${GREEN}✨ Your Edge Functions are ready to handle real traffic!${NC}" 