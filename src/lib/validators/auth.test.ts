import { describe, it, expect } from "vitest";
import { LoginSchema, RegisterSchema } from "./auth";

describe("LoginSchema", () => {
  it("accepts a well-formed email and non-empty password", () => {
    expect(LoginSchema.safeParse({ email: "owner@example.com", password: "x" }).success).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(LoginSchema.safeParse({ email: "not-an-email", password: "x" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(LoginSchema.safeParse({ email: "owner@example.com", password: "" }).success).toBe(false);
  });
});

describe("RegisterSchema.nif", () => {
  const validBase = {
    businessName: "Acme SARL",
    nis: "123456789",
    rc: "16/00-1111111A26",
    ownerFirstName: "Amine",
    ownerLastName: "Bensalem",
    email: "owner@example.com",
    password: "Password1",
  };

  it("accepts exactly 15 alphanumeric characters", () => {
    const result = RegisterSchema.safeParse({ ...validBase, nif: "A".repeat(15) });
    expect(result.success).toBe(true);
  });

  it("rejects 14 characters (one short)", () => {
    const result = RegisterSchema.safeParse({ ...validBase, nif: "A".repeat(14) });
    expect(result.success).toBe(false);
  });

  it("rejects 16 characters (one too many)", () => {
    const result = RegisterSchema.safeParse({ ...validBase, nif: "A".repeat(16) });
    expect(result.success).toBe(false);
  });

  it("rejects a NIF containing a non-alphanumeric character", () => {
    const result = RegisterSchema.safeParse({ ...validBase, nif: `${"A".repeat(14)}-` });
    expect(result.success).toBe(false);
  });
});

describe("RegisterSchema.password", () => {
  const validBase = {
    businessName: "Acme SARL",
    nif: "A".repeat(15),
    nis: "123456789",
    rc: "16/00-1111111A26",
    ownerFirstName: "Amine",
    ownerLastName: "Bensalem",
    email: "owner@example.com",
  };

  it("requires at least 8 characters", () => {
    expect(RegisterSchema.safeParse({ ...validBase, password: "Ab1" }).success).toBe(false);
  });

  it("requires an uppercase letter", () => {
    expect(RegisterSchema.safeParse({ ...validBase, password: "password1" }).success).toBe(false);
  });

  it("requires a digit", () => {
    expect(RegisterSchema.safeParse({ ...validBase, password: "Passwordonly" }).success).toBe(false);
  });

  it("accepts a password meeting every rule", () => {
    expect(RegisterSchema.safeParse({ ...validBase, password: "Password1" }).success).toBe(true);
  });
});
