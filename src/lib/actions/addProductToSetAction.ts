'use server';

import { createServerActionClient } from "@/lib/supabase/server";
import { revalidateTag } from "next/cache";
import type { ActionResponse } from "@/types/actions";
import { requireAdmin } from '@/lib/auth/serverAuth';

export async function addProductToSetAction(
  setId: string,
  productId: string
): Promise<ActionResponse> {
    if (!(await requireAdmin())) {
        return { success: false, error: 'Unauthorized.' };
    }
    const supabase = createServerActionClient();

    if (!setId || !productId) {
    return { success: false, error: "Set ID and Product ID are required" };
    }

    try {
    const { error } = await supabase
      .from("set_products")
      .insert({ set_id: setId, product_id: productId });

        if (error) {
      if (error.code === "23505") {
        return { success: false, error: "Product is already in this set." };
      }
      return { success: false, error: `Database Error: ${error.message}` };
        }

    revalidateTag(`set-products-${setId}`, {});
    revalidateTag(`products`, {});

    return { success: true, message: "Product added to set." };

  } catch (e) {
    const error = e instanceof Error ? e : new Error("An unknown error occurred.");
    return { success: false, error: error.message };
    }
} 