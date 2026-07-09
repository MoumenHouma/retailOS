import type { ReactNode } from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";

type StatusDomain = "po" | "transfer" | "count" | "invoice" | "sale";

type Tone = NonNullable<BadgeProps["variant"]>;

const STATUS_TONE_MAP: Record<StatusDomain, Record<string, Tone>> = {
  po: {
    draft: "outline",
    pending_approval: "warning",
    approved: "secondary",
    ordered: "default",
    partially_received: "warning",
    received: "success",
    cancelled: "destructive",
  },
  transfer: {
    draft: "outline",
    pending: "warning",
    in_transit: "default",
    received: "success",
    cancelled: "destructive",
  },
  count: {
    in_progress: "default",
    pending_review: "warning",
    approved: "success",
    cancelled: "destructive",
  },
  invoice: {
    draft: "outline",
    issued: "default",
    paid: "success",
    partially_paid: "warning",
    overdue: "destructive",
    cancelled: "outline",
  },
  sale: {
    completed: "success",
    held: "warning",
    voided: "destructive",
  },
};

export function StatusBadge({
  domain,
  status,
  children,
  className,
}: {
  domain: StatusDomain;
  status: string;
  children: ReactNode;
  className?: string;
}) {
  const tone = STATUS_TONE_MAP[domain][status] ?? "outline";
  return (
    <Badge variant={tone} className={className}>
      {children}
    </Badge>
  );
}
