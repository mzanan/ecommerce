'use server';

import Stripe from 'stripe';
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ActionResponse } from '@/types/actions';
import type { 
  StripeProductSyncResult, 
  StripeVariantSyncResult, 
  StripeAllProductsSyncResult,
  StripeProductSyncStatus,
  StripeProductsListResult,
  StripeCleanupResult
} from '@/types/stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil' as any,
});

export async function syncProductToStripe(productId: string): Promise<ActionResponse<StripeProductSyncResult>> {
  const supabase = createServiceRoleClient();
  
  try {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select(`
        *,
        product_images (image_url, position),
        product_variants (id, size_name)
      `)
      .eq('id', productId)
      .single();

    if (productError || !product) {
      console.error(`[STRIPE SYNC] Product ${productId} not found in database:`, productError);
      return { success: false, error: 'Product not found in database' };
    }

    const sortedImages = (product.product_images || [])
      .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))
      .map(img => img.image_url)
      .slice(0, 8);

    let stripeProduct: Stripe.Product;
    
    try {
      const existingProducts = await stripe.products.search({
        query: `metadata["supabase_product_id"]:"${productId}"`,
        limit: 1,
      });

      if (existingProducts.data.length > 0) {
        stripeProduct = await stripe.products.update(existingProducts.data[0].id, {
          name: product.name,
          description: product.description || undefined,
          images: sortedImages,
          metadata: {
            supabase_product_id: productId,
            last_synced: new Date().toISOString(),
          },
        });
      } else {
        stripeProduct = await stripe.products.create({
          name: product.name,
          description: product.description || undefined,
          images: sortedImages,
          metadata: {
            supabase_product_id: productId,
            last_synced: new Date().toISOString(),
          },
        });
      }
    } catch (stripeError: any) {
      console.error(`[STRIPE SYNC] Error syncing product to Stripe:`, stripeError);
      return { success: false, error: `Stripe error: ${stripeError.message}` };
    }

    try {
      await supabase
        .from('products')
        .update({ 
          updated_at: new Date().toISOString(),
        })
        .eq('id', productId);
    } catch (updateError) {
      console.warn('Could not update product with Stripe ID:', updateError);
    }

    return { 
      success: true, 
      data: { stripeProductId: stripeProduct.id },
      message: `Product "${product.name}" synced successfully to Stripe`
    };

  } catch (error: any) {
    console.error(`[STRIPE SYNC] Error in syncProductToStripe for product ${productId}:`, error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function syncVariantPricesToStripe(
  productId: string,
  stripeProductIdFromSync?: string
): Promise<ActionResponse<StripeVariantSyncResult>> {
  const supabase = createServiceRoleClient();
  
  try {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select(`
        *,
        product_variants (id, size_name)
      `)
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return { success: false, error: 'Product not found in database' };
    }

    let stripeProduct: Stripe.Product | { id: string } | null = null;
    
    if (stripeProductIdFromSync) {
      stripeProduct = { id: stripeProductIdFromSync };
    } else {
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          const existingProducts = await stripe.products.search({
            query: `metadata["supabase_product_id"]:"${productId}"`,
            limit: 1,
          });

          if (existingProducts.data.length > 0) {
            stripeProduct = existingProducts.data[0];
            break;
          } else if (retryCount < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            retryCount++;
          } else {
            return { success: false, error: 'Product not found in Stripe. Please sync the product first.' };
          }
        } catch (searchError: any) {
          console.error(`Stripe search error (attempt ${retryCount + 1}):`, searchError);
          if (retryCount < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            retryCount++;
          } else {
            return { success: false, error: `Stripe search failed: ${searchError.message}` };
          }
        }
      }
    }

    if (!stripeProduct) {
      return { success: false, error: 'Product not found in Stripe after retries. Please sync the product first.' };
    }

    let syncedCount = 0;

    for (const variant of product.product_variants || []) {
      try {
        const existingPrices = await stripe.prices.search({
          query: `metadata["supabase_variant_id"]:"${variant.id}"`,
          limit: 1,
        });

        if (existingPrices.data.length === 0) {
          await stripe.prices.create({
            product: stripeProduct.id,
            unit_amount: Math.round(product.price * 100),
            currency: 'usd',
            metadata: {
              supabase_variant_id: variant.id,
              supabase_product_id: productId,
              size_name: variant.size_name,
              last_synced: new Date().toISOString(),
            },
          });
          syncedCount++;
        } else {
          const existingPrice = existingPrices.data[0];
          const currentPriceInCents = Math.round(product.price * 100);
          
          if (existingPrice.unit_amount !== currentPriceInCents) {
            await stripe.prices.create({
              product: stripeProduct.id,
              unit_amount: currentPriceInCents,
              currency: 'usd',
              metadata: {
                supabase_variant_id: variant.id,
                supabase_product_id: productId,
                size_name: variant.size_name,
                last_synced: new Date().toISOString(),
              },
            });
            
            await stripe.prices.update(existingPrice.id, {
              active: false,
            });
            
            syncedCount++;
          }
        }
      } catch (variantError: any) {
        console.error(`Error syncing variant ${variant.id}:`, variantError);
      }
    }

    return { 
      success: true, 
      data: { syncedPrices: syncedCount },
      message: `Synced ${syncedCount} variant prices for product "${product.name}"`
    };

  } catch (error: any) {
    console.error('Error in syncVariantPricesToStripe:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}



export async function syncAllProductsToStripe(): Promise<ActionResponse<StripeAllProductsSyncResult>> {
  const supabase = createServiceRoleClient();
  
  try {
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, is_active')
      .eq('is_active', true);

    if (productsError) {
      return { success: false, error: `Database error: ${productsError.message}` };
    }

    if (!products || products.length === 0) {
      return { success: true, data: { syncedProducts: 0, totalVariants: 0 }, message: 'No active products found to sync' };
    }

    let syncedProducts = 0;
    let totalVariants = 0;
    const errors: string[] = [];

    for (const product of products) {
      try {
        const productResult = await syncProductToStripe(product.id);
        if (!productResult.success) {
          errors.push(`${product.name}: ${productResult.error}`);
          continue;
        }

        const pricesResult = await syncVariantPricesToStripe(product.id, productResult.data?.stripeProductId);
        if (pricesResult.success) {
          syncedProducts++;
          totalVariants += pricesResult.data?.syncedPrices || 0;
        } else {
          errors.push(`${product.name}: ${pricesResult.error}`);
        }
      } catch (error: any) {
        errors.push(`${product.name}: ${error.message}`);
      }
    }

    const message = `Synced ${syncedProducts}/${products.length} products with ${totalVariants} total variants`;
    const finalMessage = errors.length > 0 
      ? `${message}. Errors: ${errors.join('; ')}`
      : message;

    return {
      success: errors.length === 0,
      data: { syncedProducts, totalVariants },
      message: finalMessage
    };

  } catch (error: any) {
    console.error('Error in syncAllProductsToStripe:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function getBulkProductSyncStatus(productIds: string[]): Promise<ActionResponse<Record<string, StripeProductSyncStatus>>> {
  const supabase = createServiceRoleClient();
  
  try {
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select('id, product_id')
      .in('product_id', productIds);

    if (variantsError) {
      return { success: false, error: `Database error: ${variantsError.message}` };
    }

    const variantsByProduct = variants?.reduce((acc, variant) => {
      if (!acc[variant.product_id]) acc[variant.product_id] = [];
      acc[variant.product_id].push(variant);
      return acc;
    }, {} as Record<string, any[]>) || {};

    let allStripeProducts: Stripe.Product[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const productsResponse = await stripe.products.list({
        limit: 100,
        starting_after: startingAfter,
      });

      allStripeProducts = allStripeProducts.concat(productsResponse.data);
      hasMore = productsResponse.has_more;
      
      if (hasMore && productsResponse.data.length > 0) {
        startingAfter = productsResponse.data[productsResponse.data.length - 1].id;
      }
    }

    const stripeProductsBySupabaseId = allStripeProducts
      .filter(product => product.metadata?.supabase_product_id && productIds.includes(product.metadata.supabase_product_id))
      .reduce((acc, product) => {
        acc[product.metadata.supabase_product_id] = product;
        return acc;
      }, {} as Record<string, Stripe.Product>);

    let allStripePrices: Stripe.Price[] = [];
    hasMore = true;
    startingAfter = undefined;

    while (hasMore) {
      const pricesResponse: Stripe.ApiList<Stripe.Price> = await stripe.prices.list({
        limit: 100,
        starting_after: startingAfter,
      });

      allStripePrices = allStripePrices.concat(pricesResponse.data);
      hasMore = pricesResponse.has_more;
      
      if (hasMore && pricesResponse.data.length > 0) {
        startingAfter = pricesResponse.data[pricesResponse.data.length - 1].id;
      }
    }

    const syncedVariantIds = new Set(
      allStripePrices
        .filter(price => price.metadata?.supabase_variant_id)
        .map(price => price.metadata.supabase_variant_id)
    );

    const result: Record<string, StripeProductSyncStatus> = {};

    for (const productId of productIds) {
      const productVariants = variantsByProduct[productId] || [];
      const variantCount = productVariants.length;
      const stripeProduct = stripeProductsBySupabaseId[productId];
      
      if (!stripeProduct) {
        result[productId] = {
          isInStripe: false,
          variantCount,
          syncedVariants: 0,
        };
      } else {
        const syncedVariants = productVariants.filter(variant => 
          syncedVariantIds.has(variant.id)
        ).length;

        result[productId] = {
          isInStripe: true,
          stripeProductId: stripeProduct.id,
          variantCount,
          syncedVariants,
          lastSynced: stripeProduct.metadata.last_synced,
        };
      }
    }

    return {
      success: true,
      data: result
    };

  } catch (error: any) {
    console.error('Error in getBulkProductSyncStatus:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function getProductSyncStatus(productId: string): Promise<ActionResponse<StripeProductSyncStatus>> {
  const supabase = createServiceRoleClient();
  
  try {
    const { data: variants, error: variantsError } = await supabase
      .from('product_variants')
      .select('id')
      .eq('product_id', productId);

    if (variantsError) {
      return { success: false, error: `Database error: ${variantsError.message}` };
    }

    const variantCount = variants?.length || 0;

    const existingProducts = await stripe.products.search({
      query: `metadata["supabase_product_id"]:"${productId}"`,
      limit: 1,
    });

    if (existingProducts.data.length === 0) {
      return {
        success: true,
        data: {
          isInStripe: false,
          variantCount,
          syncedVariants: 0,
        }
      };
    }

    const stripeProduct = existingProducts.data[0];
    
    let syncedVariants = 0;
    if (variants) {
      for (const variant of variants) {
        const prices = await stripe.prices.search({
          query: `metadata["supabase_variant_id"]:"${variant.id}"`,
          limit: 1,
        });
        if (prices.data.length > 0) {
          syncedVariants++;
        }
      }
    }

    return {
      success: true,
      data: {
        isInStripe: true,
        stripeProductId: stripeProduct.id,
        variantCount,
        syncedVariants,
        lastSynced: stripeProduct.metadata.last_synced,
      }
    };

  } catch (error: any) {
    console.error('Error in getProductSyncStatus:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function getStripeProductsList(params?: { 
  limit?: number; 
  offset?: number; 
}): Promise<ActionResponse<StripeProductsListResult>> {
  try {
    let allProducts: Stripe.Product[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const productsResponse = await stripe.products.list({
        limit: 100,
        starting_after: startingAfter,
      });

      allProducts = allProducts.concat(productsResponse.data);
      hasMore = productsResponse.has_more;
      
      if (hasMore && productsResponse.data.length > 0) {
        startingAfter = productsResponse.data[productsResponse.data.length - 1].id;
      }
    }

    const stripeProducts = allProducts.filter(
      product => product.metadata && product.metadata.supabase_product_id
    );

    const { limit = stripeProducts.length, offset = 0 } = params || {};
    const paginatedProducts = stripeProducts.slice(offset, offset + limit);

    const productList = await Promise.all(
      paginatedProducts.map(async (product) => {
        const prices = await stripe.prices.list({
          product: product.id,
          limit: 100,
        });

        return {
          stripeId: product.id,
          name: product.name,
          supabaseId: product.metadata.supabase_product_id,
          priceCount: prices.data.length,
          lastSynced: product.metadata.last_synced,
        };
      })
    );

    return {
      success: true,
      data: { 
        products: productList,
        count: stripeProducts.length
      }
    };

  } catch (error: any) {
    console.error('Error in getStripeProductsList:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
}

export async function cleanupInactiveStripeProducts(): Promise<ActionResponse<StripeCleanupResult>> {
  const supabase = createServiceRoleClient();
  
  try {
    const { data: activeProducts, error: dbError } = await supabase
      .from('products')
      .select('id')
      .eq('is_active', true);

    if (dbError) {
      return { success: false, error: `Database error: ${dbError.message}` };
    }

    const activeProductIds = new Set(activeProducts?.map(p => p.id) || []);

    let allProducts: Stripe.Product[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const productsResponse = await stripe.products.list({
        limit: 100,
        starting_after: startingAfter,
      });

      allProducts = allProducts.concat(productsResponse.data);
      hasMore = productsResponse.has_more;
      
      if (hasMore && productsResponse.data.length > 0) {
        startingAfter = productsResponse.data[productsResponse.data.length - 1].id;
      }
    }

    const stripeProducts = allProducts.filter(
      product => product.metadata && product.metadata.supabase_product_id
    );

    let archivedProducts = 0;
    let deletedPrices = 0;
    const errors: string[] = [];

    for (const stripeProduct of stripeProducts) {
      const supabaseProductId = stripeProduct.metadata.supabase_product_id;
      
      if (!activeProductIds.has(supabaseProductId)) {
        try {
          const prices = await stripe.prices.list({
            product: stripeProduct.id,
            limit: 100,
          });

          for (const price of prices.data) {
            if (price.active) {
              await stripe.prices.update(price.id, { active: false });
              deletedPrices++;
            }
          }

          await stripe.products.update(stripeProduct.id, { 
            active: false,
            metadata: {
              ...stripeProduct.metadata,
              archived_at: new Date().toISOString(),
              reason: 'Product no longer active in database'
            }
          });
          
          archivedProducts++;
        } catch (error: any) {
          errors.push(`${stripeProduct.name}: ${error.message}`);
        }
      }
    }

    const message = `Archived ${archivedProducts} products and ${deletedPrices} prices from Stripe`;
    const finalMessage = errors.length > 0 
      ? `${message}. Errors: ${errors.join('; ')}`
      : message;

    return {
      success: errors.length === 0,
      data: { archivedProducts, deletedPrices },
      message: finalMessage
    };

  } catch (error: any) {
    console.error('Error in cleanupInactiveStripeProducts:', error);
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
} 