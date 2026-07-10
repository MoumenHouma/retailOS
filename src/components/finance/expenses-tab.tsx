"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExpenseFormDialog, type ExpenseEditData } from "@/components/finance/expense-form-dialog";
import { formatDa } from "@/lib/currency";

interface ExpenseRow {
  id: string;
  storeId: string | null;
  categoryId: string;
  supplierId: string | null;
  category: { name: string };
  supplier: { name: string } | null;
  description: string;
  amount: number;
  tvaRate: number;
  expenseDate: string;
  paymentMethod: string;
  reference: string | null;
  notes: string | null;
}

interface ExpensesResponse {
  data: ExpenseRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const PAGE_SIZE = 20;

async function fetchExpenses(page: number): Promise<ExpensesResponse> {
  const response = await fetch(`/api/expenses?page=${page}&pageSize=${PAGE_SIZE}`);
  if (!response.ok) throw new Error("Failed to load expenses");
  return response.json();
}

export function ExpensesTab() {
  const t = useTranslations("expenses");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["expenses", page],
    queryFn: () => fetchExpenses(page),
    placeholderData: (previous) => previous,
  });

  const expenses = data?.data ?? [];
  const meta = data?.meta;

  async function handleDelete(id: string) {
    if (!window.confirm(t("delete.confirm"))) return;
    const response = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(t("delete.error"));
      return;
    }
    toast.success(t("delete.success"));
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <ExpenseFormDialog onSaved={() => queryClient.invalidateQueries({ queryKey: ["expenses"] })} />
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.date")}</TableHead>
              <TableHead>{t("table.description")}</TableHead>
              <TableHead>{t("table.category")}</TableHead>
              <TableHead className="text-right">{t("table.amount")}</TableHead>
              <TableHead>{t("table.paymentMethod")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isError && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-destructive">
                  {t("loadError")}
                </TableCell>
              </TableRow>
            )}
            {!isError && !isLoading && expenses.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell>{new Date(expense.expenseDate).toLocaleDateString()}</TableCell>
                <TableCell className="font-medium">{expense.description}</TableCell>
                <TableCell>{expense.category.name}</TableCell>
                <TableCell className="text-right tabular-nums">{formatDa(expense.amount)}</TableCell>
                <TableCell>{t(`form.paymentMethods.${expense.paymentMethod}`)}</TableCell>
                <TableCell className="text-right">
                  <ExpenseFormDialog
                    expense={
                      {
                        id: expense.id,
                        storeId: expense.storeId,
                        categoryId: expense.categoryId,
                        description: expense.description,
                        amount: expense.amount,
                        tvaRate: expense.tvaRate,
                        expenseDate: expense.expenseDate,
                        paymentMethod: expense.paymentMethod,
                        reference: expense.reference,
                        supplierId: expense.supplierId,
                        notes: expense.notes,
                      } satisfies ExpenseEditData
                    }
                    onSaved={() => queryClient.invalidateQueries({ queryKey: ["expenses"] })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(expense.id)}
                    aria-label={t("delete.confirm")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {meta && meta.totalPages > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("pagination.total", { count: meta.total })}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              {t("pagination.previous")}
            </Button>
            <span>{t("pagination.pageInfo", { page: meta.page, totalPages: meta.totalPages })}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
            >
              {t("pagination.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
