import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prismaSuperuser } from "@/lib/prisma";
import { RegisterSchema } from "@/lib/validators/auth";
import { BCRYPT_SALT_ROUNDS, SYSTEM_ROLES } from "@/lib/constants";
import { DEFAULT_UNITS, PERMISSION_CATALOG, ROLE_PERMISSIONS } from "@/lib/permission-catalog";

export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json();
  const parsed = RegisterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Les données fournies sont invalides.",
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 422 },
    );
  }

  const { businessName, nif, nis, rc, ownerFirstName, ownerLastName, email, password } =
    parsed.data;

  const existingUser = await prismaSuperuser.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "Cette adresse e-mail est déjà utilisée." } },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const slug = businessName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  // No tenant context exists yet — this runs on the superuser client and
  // creates the tenant, its first store, all system roles (with their
  // permissions), default units, and the owner user in one transaction.
  const result = await prismaSuperuser.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: businessName, slug, nif, nis, rc },
    });

    const store = await tx.store.create({
      data: { tenantId: tenant.id, name: `${businessName} — Magasin principal`, isMain: true },
    });

    // The global permission catalog is normally seeded, but a fresh
    // database that has only ever run migrations (the desktop edition's
    // bundled Postgres, or any unseeded deployment) has an empty
    // `permissions` table — found live when the first desktop-registered
    // owner landed on "Vous n'avez pas la permission" for every page.
    // Upsert-by-name so an already-seeded database is untouched.
    const permissionIdByName = new Map<string, string>();
    for (const [module, names] of Object.entries(PERMISSION_CATALOG)) {
      for (const name of names) {
        const permission = await tx.permission.upsert({
          where: { name },
          update: {},
          create: { name, module },
        });
        permissionIdByName.set(name, permission.id);
      }
    }

    const roles = await Promise.all(
      SYSTEM_ROLES.map((roleName) =>
        tx.role.create({
          data: { tenantId: tenant.id, name: roleName, isSystem: true },
        }),
      ),
    );
    const ownerRole = roles.find((r) => r.name === "BUSINESS_OWNER")!;

    // Same role -> permission wiring as prisma/seed.ts — without this the
    // roles exist but grant nothing, and even the owner is locked out of
    // every permission-gated page.
    await tx.rolePermission.createMany({
      data: roles.flatMap((role) =>
        ROLE_PERMISSIONS[role.name as (typeof SYSTEM_ROLES)[number]].map((permName) => ({
          roleId: role.id,
          permissionId: permissionIdByName.get(permName)!,
        })),
      ),
    });

    await tx.unit.createMany({
      data: DEFAULT_UNITS.map((unit) => ({ tenantId: tenant.id, ...unit })),
    });

    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email,
        passwordHash,
        firstName: ownerFirstName,
        lastName: ownerLastName,
      },
    });

    await tx.userRole.create({ data: { userId: user.id, roleId: ownerRole.id } });
    await tx.userStore.create({ data: { userId: user.id, storeId: store.id } });

    return { tenant, user };
  });

  return NextResponse.json(
    { data: { tenantId: result.tenant.id, userId: result.user.id } },
    { status: 201 },
  );
}
