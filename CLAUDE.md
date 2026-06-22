# CLAUDE.md — Ecommerce (NOIR)

Plataforma ecommerce real para una marca de streetwear ficticia. Contexto completo y backlog en `~/Documents/projects/personal/personal-brain/01-Projects/05-ecommerce/`.

## Stack

Next 16 · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres / Auth / RLS / Edge Functions) · Stripe · React Hook Form + Zod · Zustand · TanStack Table · dnd-kit · ffmpeg-static / fluent-ffmpeg · `motion` (ex framer-motion).

## Comandos

```bash
npm run dev
npm run build
npx eslint src --max-warnings=9999   # Next 16 removió `next lint`; el script `npm run lint` está obsoleto
```

## Paths críticos

- `src/lib/actions/orders/orderActions.ts` — `createPendingOrderAction()`: valida y stagea un borrador server-side; el webhook lo promueve a orden pagada. (Reemplazó a `saveOrderAction`, que escribía la orden desde el cliente — eliminado.)
- `src/lib/actions/orders/pricing.ts` — `priceCartFromDb` / `getShippingPriceFromDb`: re-cotización autoritativa desde la DB.
- `src/lib/actions/stripe/stripePaymentActions.ts` — `createPaymentIntent`: cotiza desde la DB y crea el PI.
- `src/app/api/webhooks/stripe/route.ts` — webhook autoritativo: en `payment_intent.succeeded` llama a `create_order_from_payment` (RPC). Único que escribe la orden pagada; idempotente.
- `src/lib/queries/stripeSyncQueries.ts` — sync Stripe ↔ Supabase.
- `supabase/migrations/006_order_email_triggers.sql` — trigger SQL del email post-compra.
- `supabase/migrations/010_secure_order_flow.sql` — `pending_orders` (borrador RLS-locked) + `create_order_from_payment` (SECURITY DEFINER, idempotente).
- `supabase/migrations/*` — schema, RLS, functions.

## Env vars

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

## Convenciones del proyecto

- Email post-compra: trigger `trigger_order_confirmation_email` (`AFTER INSERT ON orders`, solo cuando `status='paid'`) → `notify_order_confirmation()` hace `pg_net.http_post` **async (fire-and-forget)** a la Edge Function `send-order-confirmation`, que envía por **SMTP propio (denomailer)**. NO usa Supabase Auth → SMTP (eso es solo para mails de auth). Si no llega un mail, revisar en orden: (1) que la orden se haya insertado con `status='paid'` (el webhook es quien la crea, vía `create_order_from_payment`); (2) que la Edge Function esté desplegada y con sus secrets `SMTP_HOST/PORT/USERNAME/PASSWORD/FROM_EMAIL` seteados **en la function** (`supabase secrets set`), no en el dashboard de Auth; (3) que `pg_net` esté habilitado. El envío es fire-and-forget: los fallos no rebotan a la orden, solo quedan en los logs (`RAISE LOG` / logs de la function); no hay reintento.
- Validación de precios y stock: el cliente NUNCA decide precios. `priceCartFromDb` re-cotiza cada línea desde la DB y valida stock; el monto del PaymentIntent debe coincidir exacto con el total recalculado (ver `createPendingOrderAction`). El stock se descuenta atómicamente vía trigger al insertarse la orden `status='paid'`.
- Productos de Stripe se sincronizan a Supabase via `stripeSyncQueries`.
- Animaciones: `import { motion } from "motion/react"` (NO `framer-motion`).
- Videos: usar `src/components/LazyVideo/LazyVideo.tsx` en vez de `<video>` directo. Tiene `preload="none"` + IntersectionObserver con `rootMargin: 50%`. Para above-the-fold (hero), pasar `eager` → arranca carga inmediata + `preload="auto"`, sin esperar al observer.
- `react-icons`: namespace import (`import { FaX } from "react-icons/fa"`). Subpath no anda en v5; el tree-shake lo hace `optimizePackageImports`.
- **NO usar `<link rel="preload" as="image">` manualmente para imágenes que ya van por `<Image>` de Next**. Borrado `ImagePreloader` 2026-05-28 — duplicaba la descarga: el `<link>` bajaba el original (Unsplash/Supabase) en paralelo a la versión optimizada de `/_next/image`, sumando 3.8MB en home. Next/Image + `loading="lazy"` para fold-down y `priority` para above-fold ya alcanza.

## Heurísticas

- No commits ni PRs sin confirmación explícita.
- Antes de tocar migrations: ver el orden numérico, todas se aplican en cascada.
