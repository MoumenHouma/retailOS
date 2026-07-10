import { z } from "zod";

export const CreateShiftSchema = z.object({
  employeeId: z.string().uuid(),
  storeId: z.string().uuid(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  notes: z.string().nullable().optional(),
});
export type CreateShiftInput = z.infer<typeof CreateShiftSchema>;

export const UpdateShiftSchema = z.object({
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
  notes: z.string().nullable().optional(),
});
export type UpdateShiftInput = z.infer<typeof UpdateShiftSchema>;

export const ShiftListQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type ShiftListQuery = z.infer<typeof ShiftListQuerySchema>;
