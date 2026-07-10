import { z } from "zod";

export const CalculateCommissionsSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});
export type CalculateCommissionsInput = z.infer<typeof CalculateCommissionsSchema>;

export const CommissionsListQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type CommissionsListQuery = z.infer<typeof CommissionsListQuerySchema>;
