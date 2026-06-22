import { useState, useEffect, useCallback, useRef } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createPaymentIntent, createPendingOrderAction } from '@/lib/actions/stripeActions';
import type { AddressFormValues } from '@/types/checkout';
import type { CartItem } from '@/types/store';

interface UseStripePaymentProps {
  cartItems: CartItem[];
  getTotalPrice: () => number;
  shippingPrice?: number;
  watchedValues: AddressFormValues;
  isHydrated: boolean;
  clearCart: () => void;
}

export function useStripePayment({
  cartItems,
  shippingPrice,
  watchedValues,
  isHydrated,
  clearCart,
}: UseStripePaymentProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [isWaitingForShipping, setIsWaitingForShipping] = useState(false);

  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  // Re-create the intent whenever the chargeable amount could change (cart, shipping
  // or country), so the PaymentIntent amount always matches the server-priced total.
  const cartSignature = cartItems
    .map((i) => `${i.variantId}:${i.quantity}`)
    .sort()
    .join(',');
  const intentKey = `${watchedValues.country || ''}|${shippingPrice ?? ''}|${cartSignature}`;
  const lastIntentKeyRef = useRef<string | null>(null);

  const buildOrderItems = useCallback(
    () =>
      cartItems.map((item) => ({
        variantId: item.variantId,
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: item.price || 0,
        size: item.size,
        name: item.name,
      })),
    [cartItems],
  );

  const initializePaymentIntent = useCallback(async () => {
    if (watchedValues.country && (shippingPrice === undefined || shippingPrice === null)) {
      return;
    }
    if (cartItems.length === 0) {
      return;
    }

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const response = await createPaymentIntent(
        buildOrderItems(),
        watchedValues.country || '',
        watchedValues.email || '',
      );

      if (response.clientSecret && response.paymentIntentId) {
        setClientSecret(response.clientSecret);
        setPaymentIntentId(response.paymentIntentId);
        setPaymentError(null);
      } else {
        throw new Error(response.error || 'Failed to initialize payment.');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Payment initialization failed.';
      console.error('[CHECKOUT] Error initializing payment intent:', message);
      setPaymentError(`Payment initialization failed: ${message}`);
      lastIntentKeyRef.current = null; // allow a retry on the next change
    } finally {
      setIsProcessing(false);
    }
  }, [watchedValues.country, watchedValues.email, shippingPrice, cartItems.length, buildOrderItems]);

  useEffect(() => {
    setIsWaitingForShipping(Boolean(watchedValues.country && shippingPrice === undefined));

    if (watchedValues.country) {
      setPaymentError(null);
    }

    const isValidEmail =
      watchedValues.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watchedValues.email);

    const shouldInitialize =
      isHydrated &&
      Boolean(isValidEmail) &&
      cartItems.length > 0 &&
      (!watchedValues.country || (watchedValues.country && shippingPrice !== undefined));

    if (shouldInitialize && intentKey !== lastIntentKeyRef.current) {
      lastIntentKeyRef.current = intentKey;
      initializePaymentIntent();
    }
  }, [
    isHydrated,
    watchedValues.email,
    watchedValues.country,
    cartItems.length,
    shippingPrice,
    intentKey,
    initializePaymentIntent,
  ]);

  const processPayment = useCallback(
    async (addressData: AddressFormValues) => {
      if (!stripe || !elements || !clientSecret || !paymentIntentId) {
        setPaymentError(
          !clientSecret
            ? 'Payment session not initialized. Please wait or refresh.'
            : 'Stripe.js has not loaded yet. Please wait.',
        );
        return;
      }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setPaymentError('Card details not found. Please ensure card information is entered correctly.');
        return;
      }

      if (cartItems.length === 0) {
        setPaymentError('Your cart is empty.');
        return;
      }

      setIsProcessing(true);
      setPaymentError(null);

      try {
        // Stage a server-validated draft BEFORE charging. If the server rejects it
        // (price mismatch, stock, tampering), the card is never confirmed.
        const prepared = await createPendingOrderAction({
          paymentIntentId,
          shippingAddress: addressData,
          items: buildOrderItems(),
        });

        if (!prepared.success) {
          setPaymentError(prepared.error || 'Could not prepare your order. Please try again.');
          return;
        }

        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: addressData.name,
              address: {
                line1: addressData.address1,
                line2: addressData.address2 || undefined,
                city: addressData.city,
                state: addressData.state,
                postal_code: addressData.postalCode,
                country: addressData.country,
              },
              phone: addressData.phone || undefined,
            },
          },
        });

        if (error) {
          setPaymentError(error.message || 'An unexpected payment error occurred.');
          return;
        }

        if (paymentIntent && paymentIntent.status === 'succeeded') {
          // The Stripe webhook is the authoritative order-writer; just clear + redirect.
          toast.success('Payment successful!');
          clearCart();
          router.push(`/checkout/success?email=${encodeURIComponent(addressData.email)}`);
        } else {
          setPaymentError('Payment did not succeed. Status: ' + paymentIntent?.status);
        }
      } catch (generalError: unknown) {
        console.error('Payment processing error:', generalError);
        setPaymentError('An unexpected error occurred while processing payment.');
      } finally {
        setIsProcessing(false);
      }
    },
    [stripe, elements, clientSecret, paymentIntentId, cartItems.length, buildOrderItems, clearCart, router],
  );

  return {
    isProcessing,
    paymentError,
    clientSecret,
    isWaitingForShipping,
    processPayment,
    stripe,
    elements,
  };
}
