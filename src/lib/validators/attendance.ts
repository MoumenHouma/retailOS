import { z } from "zod";

export const ClockInSchema = z.object({
  employeeId: z.string().uuid(),
  storeId: z.string().uuid(),
  shiftId: z.string().uuid().nullable().optional(),
});
export type ClockInInput = z.infer<typeof ClockInSchema>;

export const ClockOutSchema = z.object({
  recordId: z.string().uuid(),
});
export type ClockOutInput = z.infer<typeof ClockOutSchema>;

// Manual backfill entry — lets a manager record a full attendance row after
// the fact (e.g. a forgotten clock-in) rather than only supporting the
// live clock-in/clock-out flow.
export const CreateAttendanceSchema = z.object({
  employeeId: z.string().uuid(),
  storeId: z.string().uuid(),
  workDate: z.coerce.date(),
  clockIn: z.coerce.date().nullable().optional(),
  clockOut: z.coerce.date().nullable().optional(),
  status: z.enum(["present", "late", "absent", "on_leave"]).default("present"),
  notes: z.string().nullable().optional(),
});
export type CreateAttendanceInput = z.infer<typeof CreateAttendanceSchema>;

export const AttendanceListQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  storeId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type AttendanceListQuery = z.infer<typeof AttendanceListQuerySchema>;
