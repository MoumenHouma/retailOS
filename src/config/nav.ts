import {
  ArrowLeftRight,
  BarChart3,
  BookOpen,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileSearch,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
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
    ],
  },
  {
    labelKey: "groups.reports",
    items: [{ href: "/procurement-reports", labelKey: "procurementReports", icon: BarChart3 }],
  },
];
