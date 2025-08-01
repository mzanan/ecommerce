'use client'

import React, { useEffect, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { addressSchema } from '@/lib/schemas/checkoutSchemas';
import type { AddressFormValues } from '@/types/checkout';
import { AddressForm } from '@/components/ecommerce/checkout/AddressForm/AddressForm';
import { useDebounce } from '@/hooks/useDebounce';
import { useAppStore } from '@/components/providers/StoreProvider';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type { StripeCardElementOptions } from '@stripe/stripe-js';
import { 
  createPaymentIntent, 
  createPaymentIntentWithStripeProducts,
  validateCartItemsInStripe,
  saveOrderAction 
} from '@/lib/actions/stripeActions';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const LOCAL_STORAGE_KEY = 'checkoutAddress';

type DisplayedAddress = AddressFormValues | null;

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const CheckoutFormContents = ({ onCountryChange, shippingPrice }: { onCountryChange?: (country: string) => void, shippingPrice?: number }) => {
    const methods = useForm<AddressFormValues>({
        resolver: zodResolver(addressSchema),
        mode: 'onChange',
        defaultValues: {
            name: '',
            address1: '',
            address2: '',
            city: '',
            state: '',
            postalCode: '',
            country: '',
            phone: '',
            email: ''
        }
    });

    const [isLoaded, setIsLoaded] = useState(false);
    const [_displayedAddress, _setDisplayedAddress] = useState<DisplayedAddress>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [validationWarning, setValidationWarning] = useState<string | null>(null);
    const [paymentIntentInitialized, setPaymentIntentInitialized] = useState(false);
    const [isWaitingForShipping, setIsWaitingForShipping] = useState(false);

    const isHydrated = useAppStore((state) => state._isHydrated);
    const cartItems = useAppStore((state) => state.cartItems);
    const getTotalPrice = useAppStore((state) => state.getCartTotalPrice);
    const stripe = useStripe();
    const elements = useElements();
    const router = useRouter();
    const clearCart = useAppStore((state) => state.clearCart);

    const watchedValues = methods.watch();

    const getTotalWithShipping = () => {
        const subtotal = getTotalPrice();
        const shipping = shippingPrice || 0;
        return subtotal + shipping;
    };

    const initializePaymentIntent = async () => {
        const currentEmail = watchedValues.email;
        const totalWithShipping = getTotalWithShipping();
        
        if (paymentIntentInitialized) return;
        
        if (watchedValues.country && (shippingPrice === undefined || shippingPrice === null)) {
            console.warn('[CHECKOUT] Shipping price not loaded yet for country:', watchedValues.country);
            return;
        }
        
        if (cartItems.length > 0 && totalWithShipping > 0) { 
            setIsProcessing(true);
            setPaymentError(null);
            setValidationWarning(null);
            
            try {
                const orderItems = cartItems.map(item => ({
                    variantId: item.variantId,
                    productId: item.productId,
                    quantity: item.quantity,
                    priceAtPurchase: item.price || 0,
                    size: item.size,
                    name: item.name
                }));

                const validation = await validateCartItemsInStripe(orderItems);
                
                if (!validation.isValid) {
                    if (validation.errors.length > 0) {
                        console.error('Stripe validation errors:', validation.errors);
                    }

                    const amountInCents = Math.round(totalWithShipping * 100);
                    
                    const response = await createPaymentIntent(amountInCents, currentEmail || "", {
                        shipping_price: (shippingPrice || 0).toString(),
                        payment_method: 'traditional_fallback',
                        country: watchedValues.country || 'unknown'
                    });
                    
                    if (response.clientSecret) {
                        setClientSecret(response.clientSecret);
                        setPaymentIntentInitialized(true);
                        setPaymentError(null);
                    } else {
                        throw new Error(response.error || "Failed to initialize payment.");
                    }
                } else {
                    const response = await createPaymentIntentWithStripeProducts(
                        orderItems,
                        shippingPrice || 0,
                        currentEmail || "",
                        {
                            payment_method: 'stripe_products',
                            country: watchedValues.country || 'unknown'
                        }
                    );
                    
                    if (response.clientSecret) {
                        setClientSecret(response.clientSecret);
                        setPaymentIntentInitialized(true);
                        setPaymentError(null);
                    } else {
                        throw new Error(response.error || "Failed to initialize payment.");
                    }
                }
            } catch (error: any) {
                console.error('[CHECKOUT] Error initializing payment intent:', error);
                setPaymentError(`Payment initialization failed: ${error.message}`);
            } finally {
                setIsProcessing(false);
            }
        } else {
            console.warn('[CHECKOUT] Cannot initialize payment: invalid cart or total');
        }
    };

    useEffect(() => {
        const currentEmail = watchedValues.email;
        
        const isWaitingShipping = Boolean(watchedValues.country && shippingPrice === undefined);
        setIsWaitingForShipping(isWaitingShipping);
        
        if (watchedValues.country) {
            setPaymentError(null);
        }
        
        const isValidEmail = currentEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail);
        
        const shouldInitialize = (
            isHydrated &&
            isValidEmail && 
            cartItems.length > 0 &&
            (!watchedValues.country || (watchedValues.country && shippingPrice !== undefined))
        );
        
        if (shouldInitialize && !paymentIntentInitialized) {
            initializePaymentIntent();
        }
    }, [
        watchedValues.email, 
        cartItems.length, 
        paymentIntentInitialized,
        watchedValues.country,
        shippingPrice,
        isHydrated
    ]);

    useEffect(() => {
        if (typeof window !== 'undefined' && isHydrated) {
            try {
                const savedAddress = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (savedAddress) {
                    const parsedAddress = JSON.parse(savedAddress);
                    const validation = addressSchema.safeParse(parsedAddress);
                    if (validation.success) {
                        methods.reset(validation.data);
                    } else {
                        localStorage.removeItem(LOCAL_STORAGE_KEY);
                    }
                }
            } catch {
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
            setIsLoaded(true);
        }
    }, [methods, isHydrated]);

    const debouncedValues = useDebounce(watchedValues, 500);

    useEffect(() => {
        if (isLoaded && isHydrated && typeof window !== 'undefined') {
            try {
                const validation = addressSchema.safeParse(debouncedValues);
                if (validation.success) {
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(debouncedValues));
                }
            } catch (error) {
                console.error("Failed to save address to local storage:", error);
            }
        }
    }, [debouncedValues, isLoaded, isHydrated]);

    useEffect(() => {
        if (onCountryChange && watchedValues.country) {
            onCountryChange(watchedValues.country);
        }
    }, [watchedValues.country, onCountryChange]);

    const handleSubmit = async (addressData: AddressFormValues) => {
        if (!stripe || !elements || !clientSecret) {
            setPaymentError(
                !clientSecret ? "Payment session not initialized. Please wait or refresh." :
                "Stripe.js has not loaded yet. Please wait."
            );
            return;
        }

        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
            setPaymentError("Card details not found. Please ensure card information is entered correctly.");
            return;
        }

        if (cartItems.length === 0) {
            setPaymentError("Your cart is empty.");
            return;
        }

        setIsProcessing(true);
        setPaymentError(null);

        try {
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
                setPaymentError(error.message || "An unexpected payment error occurred.");
            } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                try {
                    const orderItems = cartItems.map(item => ({
                        variantId: item.variantId,
                        productId: item.productId,
                        quantity: item.quantity,
                        priceAtPurchase: item.price || 0,
                        size: item.size,
                        name: item.name
                    }));

                    const saveResponse = await saveOrderAction({
                        shippingAddress: addressData,
                        items: orderItems,
                        totalAmount: getTotalWithShipping(),
                        paymentIntentId: paymentIntent.id,
                        shippingPrice: shippingPrice || 0,
                    });

                    if (saveResponse.orderId) {
                        toast.success("Payment successful!");
                        clearCart();
                        router.push(`/checkout/success?order_id=${saveResponse.orderId}&pi_id=${paymentIntent.id}`);
                    } else {
                        toast.error(saveResponse.error || "Payment succeeded but failed to save order. Please contact support.");
                    }
                } catch (saveError: any) {
                    toast.error("Payment succeeded but there was an issue saving your order: " + saveError.message + ". Please contact support.");
                }
            } else {
                setPaymentError("Payment did not succeed. Status: " + paymentIntent?.status);
            }
        } catch (generalError: any) {
            console.error('Payment processing error:', generalError);
            setPaymentError("An unexpected error occurred while processing payment.");
        } finally {
            setIsProcessing(false);
        }
    };

    const cardElementOptions: StripeCardElementOptions = {
        style: {
            base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                    color: '#aab7c4',
                },
            },
            invalid: {
                color: '#9e2146',
            },
        },
        hidePostalCode: true,
        iconStyle: 'default',
        disabled: false,
    };

    return (
        <FormProvider {...methods}>
            {!isHydrated || !isLoaded ? (
                <div className="space-y-8">
                    <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
                            <p className="mt-2 text-gray-600">Loading form...</p>
                        </div>
                    </div>
                </div>
            ) : (
                <form onSubmit={methods.handleSubmit(handleSubmit)} className="space-y-8">
                    <div className="space-y-6">
                        <div>
                            <AddressForm 
                                cardElementOptions={cardElementOptions}
                                paymentError={paymentError}
                                validationWarning={validationWarning}
                                isProcessingPayment={isProcessing}
                                onProcessPayment={async (data: AddressFormValues) => await handleSubmit(data)}
                                isPlaceOrderDisabled={isProcessing || cartItems.length === 0 || !stripe || !elements || !clientSecret || isWaitingForShipping}
                                isWaitingForShipping={isWaitingForShipping}
                            />
                        </div>
                    </div>
                </form>
            )}
        </FormProvider>
    );
}

export default function CheckoutFormClient({ onCountryChange, shippingPrice }: { onCountryChange?: (country: string) => void, shippingPrice?: number }) {
    return (
        <Elements stripe={stripePromise}>
            <CheckoutFormContents onCountryChange={onCountryChange} shippingPrice={shippingPrice} />
        </Elements>
    );
} 