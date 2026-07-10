import { z } from "zod";

export const SetCustomerPriceSchema = z.object({
  productId: z.string().uuid(),
  price: z.number().int().min(0),
});
export type SetCustomerPriceInput = z.infer<typeof SetCustomerPriceSchema>;
