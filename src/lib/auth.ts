import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { prismaSuperuser } from "./prisma";
import { LoginSchema } from "./validators/auth";
import { MAX_FAILED_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MINUTES } from "./constants";

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(rawCredentials) {
        const parsed = LoginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Looked up unscoped (no tenant context yet — tenant is unknown
        // until we know which user this is). users.email is globally unique.
        const user = await prismaSuperuser.user.findUnique({
          where: { email, deletedAt: null },
          include: {
            userRoles: {
              include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
            },
            userStores: true,
          },
        });
        if (!user || !user.isActive) return null;

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);

        if (!isValid) {
          const attempts = user.failedLoginAttempts + 1;
          const shouldLock = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;
          await prismaSuperuser.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: attempts,
              lockedUntil: shouldLock
                ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)
                : user.lockedUntil,
            },
          });
          return null;
        }

        await prismaSuperuser.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
        });

        const permissions = Array.from(
          new Set(
            user.userRoles.flatMap((ur) =>
              ur.role.rolePermissions.map((rp) => rp.permission.name),
            ),
          ),
        );

        // Phase 6 Chunk C: every UserStore row, not just the first — a
        // multi-store user was previously silently limited to one store for
        // the entire session (confirmed live: `userStores[0]?.storeId`).
        // `storeIds` is now the source of truth for access checks
        // (requireStoreAccess in permissions.ts); `primaryStoreId` prefers
        // the tenant's main store when the user is assigned to it, else the
        // first assignment, purely as a default for the handful of
        // call sites that still assume a single store (POS session start,
        // new-PO store picker) — never for access control.
        const storeIds = user.userStores.map((us) => us.storeId);
        const mainStore = await prismaSuperuser.store.findFirst({
          where: { id: { in: storeIds }, isMain: true },
          select: { id: true },
        });
        const primaryStoreId = mainStore?.id ?? storeIds[0] ?? null;

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          tenantId: user.tenantId,
          roles: user.userRoles.map((ur) => ur.role.name),
          permissions,
          storeIds,
          primaryStoreId,
        };
      },
    }),
  ],
});
