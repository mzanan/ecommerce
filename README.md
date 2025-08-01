# 🖤 NOIR — Urban Streetwear E-commerce Platform

A modern, production-ready e-commerce platform built with **Next.js 15.4**, **React 19.1.0**, and Supabase.  
Designed for NOIR, a minimalist yet edgy streetwear brand — fully optimized for performance, SEO, and scalability.

---

## 🚀 Features

### Frontend
- **Next.js 15.4** (App Router, Server Components, Turbopack)
- **React 19.1.0**
- **TypeScript**
- **Tailwind CSS** for responsive design
- **Framer Motion** for animations
- **React Hook Form** + **Zod** for validation
- **Zustand** for state management
- **next/image** optimization
- Dynamic SEO with metadata & JSON-LD

### Backend & Database
- **Supabase** (PostgreSQL, Auth, Edge Functions)
- Row Level Security (RLS)
- Real-time stock updates & audit trail
- Schema: products, variants, orders, stock movements

### E-commerce
- Limited edition drops & curated collections
- Variants (size/color) with shared stock
- Floating cart with drag & drop
- **Stripe** integration
- Admin dashboard

### UI/UX
- Dark-first theme (light optional)
- Collection layouts
- Toast notifications
- Loading & empty states
- Fully responsive

---

## 🛠️ Tech Stack

| Layer       | Technology                                      |
|------------|-------------------------------------------------|
| Frontend    | Next.js 15.4, React 19.1.0, TypeScript          |
| Styling     | Tailwind CSS                                    |
| Animations  | Framer Motion                                   |
| State       | Zustand                                         |
| Forms       | React Hook Form + Zod                           |
| Backend     | Supabase (PostgreSQL, Auth, Edge Functions)     |
| Payments    | Stripe                                          |
| Deployment  | Vercel / Self-hosted                            |
| Logging     | instrumentation.js & server actions             |

---

## 📦 Project Structure

src/  
├── app/                # App Router  
│   ├── (admin)/       # Admin dashboard routes  
│   ├── layout.tsx     # Root layout  
│   └── page.tsx       # Homepage  
├── components/        # UI & feature components  
├── lib/               # Supabase & Stripe config, utils  
├── store/             # Zustand stores  
├── hooks/             # Custom React hooks  
├── types/             # TypeScript types  

supabase/  
├── migrations/        # SQL migrations  
├── functions/         # Edge Functions  

scripts/               # Setup & deployment scripts

---

## 📄 Getting Started

### Requirements
- Node.js 20+
- Supabase project
- Stripe account

### Install & setup
git clone <repo-url>  
cd noir  
npm install

Create `.env.local`:

NEXT_PUBLIC_SUPABASE_URL=  
NEXT_PUBLIC_SUPABASE_ANON_KEY=  
SUPABASE_SERVICE_ROLE_KEY=  
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  
STRIPE_SECRET_KEY=  
STRIPE_WEBHOOK_SECRET=  
NEXT_PUBLIC_APP_URL=  

Setup database:

chmod +x supabase/setup-supabase.sh  
./supabase/setup-supabase.sh

Run development server:

npm run dev

---

## ✅ Testing & Deployment

npm run lint  
npm run type-check  
npm run test  
npm run build

**Deploy:**
- Vercel → conecta el repo y configura env vars
- Self-host → build + npm start

---

## 🧠 Notes (August 2025)
- Next.js 15.4 (Active LTS) + Turbopack
- React 19.1.0 stable
- Supports Server Actions, async APIs & Edge runtime

---

## 📄 License

This is a portfolio project.  
All product names, brand & data are fictional.

---

Built with ❤️ by Matias Zanan