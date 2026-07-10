import { z } from "zod";

export const CreatePeriodSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});
export type CreatePeriodInput = z.infer<typeof CreatePeriodSchema>;
