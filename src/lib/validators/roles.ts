import { z } from "zod";

export const CreateRoleSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().nullable().optional(),
});
export type CreateRoleInput = z.infer<typeof CreateRoleSchema>;

export const UpdateRolePermissionsSchema = z.object({
  permissionNames: z.array(z.string()),
});
export type UpdateRolePermissionsInput = z.infer<typeof UpdateRolePermissionsSchema>;

export const AssignUserRoleSchema = z.object({
  userId: z.string().uuid(),
  storeId: z.string().uuid().nullable().optional(),
});
export type AssignUserRoleInput = z.infer<typeof AssignUserRoleSchema>;
