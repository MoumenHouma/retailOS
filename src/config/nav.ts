import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Boxes,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileSearch,
  FileText,
  LayoutDashboard,
  Package,
  Percent,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Truck,
  UserSquare2,
  Users,
  Warehouse,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  // Hidden in the desktop edition (RETAILOS_EDITION=desktop) — reserved for
  // items whose underlying feature depends on Redis/BullMQ/python-ai/MinIO,
  // none of which are bundled there. Per-item, not per-group: e.g.
  // supplier-ranking lives in the "AI" nav group for UX grouping but is pure
  // synchronous MCDA scoring with no queue/Redis dependency, so it stays.
  desktopHidden?: boolean;
};

export type NavGroup = {
  labelKey?: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    items: [{ href: "/", labelKey: "dashboard", icon: LayoutDashboard }],
  },
  {
    labelKey: "groups.sales",
    items: [
      { href: "/pos", labelKey: "pos", icon: ShoppingCart },
      { href: "/sales", labelKey: "sales", icon: Receipt },
      { href: "/invoices", labelKey: "invoices", icon: FileText },
      { href: "/customers", labelKey: "customers", icon: Users },
    ],
  },
  {
    labelKey: "groups.purchasing",
    items: [
      { href: "/purchase-orders", labelKey: "purchaseOrders", icon: ClipboardList },
      { href: "/supplier-quotes", labelKey: "supplierQuotes", icon: FileSearch },
      { href: "/supplier-catalog", labelKey: "supplierCatalog", icon: BookOpen },
      { href: "/suppliers", labelKey: "suppliers", icon: Truck },
    ],
  },
  {
    labelKey: "groups.inventory",
    items: [
      { href: "/products", labelKey: "products", icon: Package },
      { href: "/inventory", labelKey: "inventory", icon: Boxes },
      { href: "/warehouses", labelKey: "warehouses", icon: Warehouse },
      { href: "/stock-transfers", labelKey: "stockTransfers", icon: ArrowLeftRight },
      { href: "/stock-counts", labelKey: "stockCounts", icon: ClipboardCheck },
    ],
  },
  {
    labelKey: "groups.finance",
    items: [
      { href: "/expenses", labelKey: "expenses", icon: Wallet },
      { href: "/finance", labelKey: "financialDashboard", icon: BarChart3 },
      { href: "/financial-periods", labelKey: "financialPeriods", icon: CalendarClock },
      { href: "/multi-store", labelKey: "multiStore", icon: Warehouse },
      { href: "/subscription", labelKey: "subscription", icon: Wallet },
    ],
  },
  {
    labelKey: "groups.hr",
    items: [
      { href: "/employees", labelKey: "employees", icon: UserSquare2 },
      { href: "/work-schedules", labelKey: "workSchedules", icon: CalendarDays },
      { href: "/attendance", labelKey: "attendance", icon: Clock },
      { href: "/commission-rules", labelKey: "commissionRules", icon: Percent },
      { href: "/roles", labelKey: "roles", icon: ShieldCheck },
    ],
  },
  {
    labelKey: "groups.ai",
    items: [
      { href: "/ai-dashboard", labelKey: "aiDashboard", icon: LayoutDashboard, desktopHidden: true },
      { href: "/ai-forecasts", labelKey: "aiForecasts", icon: TrendingUp, desktopHidden: true },
      // Pure synchronous MCDA scoring (src/server/services/supplier-mcda.ts)
      // — no Redis/BullMQ/python-ai dependency despite the "AI" grouping,
      // so this one stays available in the desktop edition.
      { href: "/supplier-ranking", labelKey: "supplierRanking", icon: Truck },
    ],
  },
  {
    labelKey: "groups.reports",
    items: [
      { href: "/sales-report", labelKey: "salesReport", icon: BarChart3 },
      { href: "/inventory-report", labelKey: "inventoryReport", icon: BarChart3 },
      { href: "/procurement-reports", labelKey: "procurementReports", icon: BarChart3 },
      { href: "/financial-reports", labelKey: "financialReports", icon: BarChart3 },
      { href: "/employee-performance", labelKey: "employeePerformance", icon: BarChart3 },
      // BullMQ cron + email — not bundled in the desktop edition.
      { href: "/report-schedules", labelKey: "reportSchedules", icon: CalendarClock, desktopHidden: true },
    ],
  },
];
