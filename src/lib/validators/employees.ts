import { z } from "zod";

export const CreateEmployeeSchema = z.object({
  userId: z.string().uuid().nullable().optional(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.coerce.date().nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  address: z.string().nullable().optional(),
  position: z.string().max(100).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  hireDate: z.coerce.date().nullable().optional(),
  salary: z.number().int().min(0).nullable().optional(),
  contractType: z.enum(["cdi", "cdd", "interim", "freelance"]).default("cdi"),
});
export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial();
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;

export const EmployeeSearchQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type EmployeeSearchQuery = z.infer<typeof EmployeeSearchQuerySchema>;
