import type { Prisma } from "@prisma/client";
import { DEFAULT_WIDGET_KEYS } from "@/config/kpi-widgets";
import type { DashboardLayoutUpdate } from "@/lib/validators/reports";

type TransactionClient = Prisma.TransactionClient;

export interface WidgetConfig {
  key: string;
  enabled: boolean;
}

/**
 * Per-role (not per-user) layout, matching ROADMAP.md's literal "dashboard
 * customization (per role)" wording. Falls back to a hardcoded default
 * widget set when no DashboardLayout row exists yet for the role — no
 * migration/seed needed to bootstrap defaults.
 */
export async function getDashboardLayout(
  tx: TransactionClient,
  tenantId: string,
  role: string,
): Promise<WidgetConfig[]> {
  const existing = await tx.dashboardLayout.findUnique({
    where: { tenantId_role: { tenantId, role } },
  });

  if (existing) return existing.widgets as unknown as WidgetConfig[];

  return DEFAULT_WIDGET_KEYS.map((key) => ({ key, enabled: true }));
}

export async function upsertDashboardLayout(
  tx: TransactionClient,
  tenantId: string,
  role: string,
  input: DashboardLayoutUpdate,
  updatedBy: string,
) {
  return tx.dashboardLayout.upsert({
    where: { tenantId_role: { tenantId, role } },
    // tenantId omitted from create — filled by the column's dbgenerated
    // default from withTenant's session-local app.current_tenant_id, same
    // convention every other new-since-Phase-1 model uses.
    create: { role, widgets: input.widgets, updatedBy },
    update: { widgets: input.widgets, updatedBy },
  });
}
