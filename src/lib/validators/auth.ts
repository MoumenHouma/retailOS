import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  businessName: z.string().min(2).max(255),
  nif: z.string().regex(/^[A-Za-z0-9]{15}$/, "NIF must be exactly 15 alphanumeric characters"),
  nis: z.string().min(1).max(20),
  rc: z.string().min(1).max(30),
  ownerFirstName: z.string().min(1).max(100),
  ownerLastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a digit"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
