import { NextResponse } from "next/server";
import { prismaSuperuser } from "@/lib/prisma";

// Desktop first-run check: a fresh install has zero tenants, so the login
// page redirects to /register instead of showing an empty login form.
// Zero effect on an already-provisioned hosted-web-app tenant.
export async function GET() {
  const count = await prismaSuperuser.tenant.count();
  return NextResponse.json({ exists: count > 0 });
}
