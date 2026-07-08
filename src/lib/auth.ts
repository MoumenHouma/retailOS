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

        return {
          id: user.id,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          tenantId: user.tenantId,
          roles: user.userRoles.map((ur) => ur.role.name),
          permissions,
          storeId: user.userStores[0]?.storeId ?? null,
        };
      },
    }),
  ],
});
