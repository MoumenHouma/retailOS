"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Calculator, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CommissionRuleFormDialog } from "@/components/employees/commission-rule-form-dialog";
import { fetchJsonData } from "@/lib/fetch-json";

interface CommissionRule {
  id: string;
  name: string;
  scope: string;
  rateType: string;
  rateValue: number;
  isActive: boolean;
  targetEmployee: { id: string; firstName: string; lastName: string } | null;
}

function startOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CommissionRulesView() {
  const t = useTranslations("commissionRules");
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [calculating, setCalculating] = useState(false);

  const rulesQuery = useQuery({
    queryKey: ["commission-rules"],
    queryFn: () => fetchJsonData<CommissionRule[]>("/api/commission-rules"),
  });
  const rules = rulesQuery.data?.data ?? [];

  async function handleDeactivate(id: string) {
    if (!window.confirm(t("deactivate.confirm"))) return;
    const response = await fetch(`/api/commission-rules/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(t("deactivate.error"));
      return;
    }
    toast.success(t("deactivate.success"));
    queryClient.invalidateQueries({ queryKey: ["commission-rules"] });
  }

  async function handleCalculate() {
    setCalculating(true);
    try {
      const response = await fetch("/api/commissions/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      if (!response.ok) {
        toast.error(t("calculate.error"));
        return;
      }
      const body: { data: { created: number; updated: number; salesScanned: number } } = await response.json();
      toast.success(t("calculate.success", body.data));
      queryClient.invalidateQueries({ queryKey: ["employee-commissions"] });
    } finally {
      setCalculating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        action={
          <CommissionRuleFormDialog
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["commission-rules"] })}
          />
        }
      />

      <div className="flex flex-wrap items-end gap-4 rounded-md border border-border p-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="calc-from">{t("calculate.from")}</Label>
          <Input id="calc-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="calc-to">{t("calculate.to")}</Label>
          <Input id="calc-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <Button onClick={handleCalculate} disabled={calculating}>
          <Calculator className="h-4 w-4" />
          {calculating ? t("calculate.running") : t("calculate.submit")}
        </Button>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.scope")}</TableHead>
              <TableHead>{t("table.rate")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rulesQuery.isLoading && rules.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium">{rule.name}</TableCell>
                <TableCell>
                  {rule.scope === "global"
                    ? t("form.scopes.global")
                    : `${t("form.scopes.employee")} — ${rule.targetEmployee?.firstName} ${rule.targetEmployee?.lastName}`}
                </TableCell>
                <TableCell>
                  {rule.rateType === "percentage" ? `${rule.rateValue}%` : `${(rule.rateValue / 100).toFixed(2)} DA`}
                </TableCell>
                <TableCell>
                  <Badge variant={rule.isActive ? "default" : "secondary"}>
                    {rule.isActive ? t("status.active") : t("status.inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {rule.isActive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeactivate(rule.id)}
                      aria-label={t("deactivate.confirm")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
