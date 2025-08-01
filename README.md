# Infideli - Luxury Lingerie E-commerce Platform

An elegant, high-performance e-commerce platform built with Next.js 14, TypeScript, and Supabase. Featuring dual-brand support (Fideli/Infideli), advanced product sets with dynamic layouts, comprehensive admin dashboard, and seamless payment processing.

## 🚀 Features

### Frontend
- **Next.js 14** with App Router and Server Components
- **TypeScript** for type safety
- **Tailwind CSS** for responsive design
- **Framer Motion** for smooth animations
- **React Hook Form** with validation
- **Zustand** for state management
- **Next.js Image** optimization
- **Comprehensive SEO** with dynamic metadata and structured data

### Backend & Database
- **Supabase** for database, authentication, and real-time updates
- **PostgreSQL** with Row Level Security (RLS)
- **Edge Functions** for server-side logic
- **Comprehensive database schema** with proper relationships

### E-commerce Features
- **Dual Brand Support** (Fideli/Infideli)
- **Product Sets** with 5 dynamic layout types
- **Advanced Product Management** with variants and images
- **Shopping Cart** with drag & drop on mobile
- **Stripe Payment Integration**
- **Order Management System**
- **Country-specific Shipping** prices
- **Real-time Inventory Management** with automatic stock deduction
- **Stock Management System** with audit trail and overselling prevention  
- **Admin Dashboard** with analytics

### Stock Management Features
- **Real-time Stock Updates** using database-level validation
- **Automatic Stock Deduction** when orders are completed
- **Shared Stock Model** - all product variants share stock
- **Overselling Prevention** with concurrent user safety
- **Stock Movement Audit Trail** for complete transparency
- **Out of Stock UI States** with disabled/crossed-out variants
- **Low Stock Warnings** ("Only X left in stock!")

### UI/UX Features
- **Responsive Design** (mobile-first)
- **Floating Cart** with drag functionality
- **Dynamic Layouts** for product sets
- **Toast Notifications** (dismissible)
- **Loading States** and error handling
- **SEO Optimized** with metadata
- **Dark/Light Mode** support

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Payments**: Stripe
- **Deployment**: Vercel
- **State Management**: Zustand
- **Forms**: React Hook Form + Zod
- **Icons**: Lucide React

## 📦 Project Structure

```
src/
├── app/                    # Next.js 14 App Router
│   ├── (admin)/           # Admin dashboard routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx          # Homepage
├── components/            # Reusable components
│   ├── admin/            # Admin-specific components
│   ├── ui/               # Base UI components
│   └── ...              # Feature components
├── lib/                  # Utilities and configurations
│   ├── supabase/         # Supabase client and types
│   ├── stripe/           # Stripe configuration
│   └── utils/           # Helper functions
├── store/               # Zustand stores
├── types/               # TypeScript type definitions
└── hooks/               # Custom React hooks

supabase/                # Database and deployment
├── migrations/          # Database migrations
│   ├── 001_initial_schema.sql
│   ├── 002_rls_policies.sql
│   ├── 003_functions_and_triggers.sql
│   ├── 004_additional_rpc_functions.sql
│   └── 005_stock_management.sql
├── functions/           # Edge Functions
│   └── create-admin.sql     # Admin user creation
├── functions/           # Edge Functions
└── MIGRATION_GUIDE.md   # Migration documentation

scripts/                 # Deployment scripts
├── deploy-complete.sh   # Complete deployment
└── setup-edge-secrets.sh # Edge Function secrets
```

## 🗄️ Database Schema

### Core Tables

- **`admin_users`** - Admin user management (linked to auth.users)
- **`product_categories`** - Product categorization with size guides
- **`size_guide_templates`** - Reusable size guide templates
- **`products`** - Main product catalog
- **`product_images`** - Product image management
- **`product_variants`** - Product size variants
- **`sets`** - Product sets with dynamic layouts
- **`set_images`** - Set image management
- **`set_products`** - Set-product relationships
- **`orders`** - Order management
- **`order_items`** - Order line items
- **`country_shipping_prices`** - Shipping rates by country

### Stock Management

- **`stock_movements`** - Complete audit trail of stock changes (sale, restock, adjustment, return)
- **Automatic triggers** on `order_items` for real-time stock deduction
- **Real-time validation** preventing overselling
- **Shared stock model** - all product variants share the same stock pool

### Content Management

- **`hero_content`** - Homepage hero section
- **`page_components`** - Dynamic page components
- **`homepage_layout`** - Homepage layout configuration
- **`app_settings`** - Application settings (key-value store)

### Key Features

- **Row Level Security (RLS)** for all tables
- **Comprehensive indexes** for performance
- **Automatic timestamp triggers** for audit trails
- **Advanced RPC functions** for complex queries
- **Admin authentication** with `auth.is_admin()` helper

### SEO & Performance

- **Dynamic Metadata** - Page-specific titles and descriptions with "Infideli - [Section]" format
- **Structured Data** - JSON-LD for enhanced search results (Organization, Website, Product schemas)
- **Open Graph** - Social media optimization with proper images and descriptions
- **Canonical URLs** - Proper URL structure for SEO
- **Robots Meta** - Granular search engine control (admin pages excluded)
- **Set-Specific Titles** - Dynamic titles for `/set/[slug]` pages showing set names

### Set Layout Types

1. **SINGLE_COLUMN** - Traditional single column layout
2. **SPLIT_SMALL_LEFT** - Small image left, large right
3. **SPLIT_SMALL_RIGHT** - Large left, small image right
4. **STAGGERED_THREE** - Three images in staggered layout
5. **TWO_HORIZONTAL** - Two images side by side (rectangular)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm/yarn/pnpm
- Supabase account
- Stripe account

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd infideli
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Setup**
Create `.env.local` with your configuration:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# App
NEXT_PUBLIC_APP_URL=your_app_url
```

4. **Database Setup**
```bash
# Run the setup script
chmod +x supabase/setup-supabase.sh
./supabase/setup-supabase.sh

# Create an admin user
psql -h your_db_host -U postgres -d postgres -f supabase/migrations/create-admin.sql
```

### 🎯 Demo Data

The project includes comprehensive dummy data for immediate testing:

- **6 Complete Sets** (3 FIDELI white + 3 INFIDELI black)
- **12 Products** with images and multiple variants
- **5 Product Categories** with size guides  
- **Homepage Components** with brand-specific text
- **Country Shipping Rates** for major regions
- **Complete Size Guide Templates**

**Included Collections:**
- **FIDELI**: Ethereal Dreams, Pure Serenity, Bridal Bliss
- **INFIDELI**: Midnight Passion, Shadow Mystique, Dark Romance

All products include:
- ✅ Multiple high-quality images
- ✅ Size variants (XS-XL)
- ✅ Proper categorization
- ✅ SEO-optimized descriptions
- ✅ Stock management integration

5. **Run Development Server**
```bash
npm run dev
```

6. **Deploy (Optional)**
```bash
chmod +x scripts/deploy-complete.sh
./scripts/deploy-complete.sh
```

## 📚 Documentation

- [Migration Guide](supabase/MIGRATION_GUIDE.md) - Database setup and migration instructions
- [API Documentation](docs/api.md) - API endpoints and usage
- [Component Guide](docs/components.md) - Component usage and props

## 🔧 Development

### Database Changes

1. Create new migration files in `supabase/migrations/`
2. Apply migrations using Supabase CLI or direct SQL execution
3. Update TypeScript types as needed

### Adding New Features

1. Create components in appropriate directories
2. Add types to `src/types/`
3. Update database schema if needed
4. Add admin interface if applicable

### Testing

```bash
npm run test        # Run tests
npm run type-check  # TypeScript checking
npm run lint        # ESLint
```

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Set environment variables
3. Deploy automatically on push

### Manual Deployment

```bash
npm run build
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For support and questions:
- Check the documentation
- Review the migration guide
- Contact the development team

---

Built with ❤️ for luxury e-commerce
