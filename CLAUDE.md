# CLAUDE.md — Ecommerce (NOIR)

Plataforma ecommerce real para una marca de streetwear ficticia. Contexto completo y backlog en `~/Documents/projects/personal/personal-brain/01-Projects/05-ecommerce/`.

## Stack

Next 16 · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres / Auth / RLS / Edge Functions) · Stripe · React Hook Form + Zod · Zustand · TanStack Table · dnd-kit · ffmpeg-static / fluent-ffmpeg.

## Comandos

```bash
npm run dev
npm run build
npm run lint         # next lint
```

## Paths críticos

- `src/lib/actions/orders/orderActions.ts` — `saveOrderAction()`.
- `src/lib/actions/stripe/stripePaymentActions.ts` — server actions Stripe.
- `src/lib/queries/stripeSyncQueries.ts` — sync Stripe ↔ Supabase.
- `supabase/migrations/006_order_email_triggers.sql` — trigger SQL del email post-compra.
- `supabase/migrations/*` — schema, RLS, functions.

## Env vars

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

## Convenciones del proyecto

- Email post-compra **no usa nodemailer**: se dispara desde un trigger SQL en Supabase. Si no llega un mail, la causa más probable es la config de Supabase Auth → SMTP en el dashboard.
- Validación de stock vive en `saveOrderAction` antes de insertar la orden.
- Productos de Stripe se sincronizan a Supabase via `stripeSyncQueries`.

## Heurísticas

- No commits ni PRs sin confirmación explícita.
- Antes de tocar migrations: ver el orden numérico, todas se aplican en cascada.
