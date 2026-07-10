"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExpenseCategoryFormDialog } from "@/components/finance/expense-category-form-dialog";

interface ExpenseCategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
  children: ExpenseCategoryNode[];
}

async function fetchExpenseCategoryTree(): Promise<{ data: ExpenseCategoryNode[] }> {
  const response = await fetch("/api/expense-categories");
  if (!response.ok) throw new Error("Failed to load expense categories");
  return response.json();
}

function flatten(nodes: ExpenseCategoryNode[], depth = 0): { node: ExpenseCategoryNode; depth: number }[] {
  return nodes.flatMap((node) => [{ node, depth }, ...flatten(node.children, depth + 1)]);
}

export function ExpenseCategoriesTab() {
  const t = useTranslations("expenseCategories");
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: fetchExpenseCategoryTree,
  });

  const tree = data?.data ?? [];
  const rows = flatten(tree);

  async function handleDeactivate(id: string) {
    if (!window.confirm(t("deactivate.confirm"))) return;
    const response = await fetch(`/api/expense-categories/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(t("deactivate.error"));
      return;
    }
    toast.success(t("deactivate.success"));
    queryClient.invalidateQueries({ queryKey: ["expense-categories"] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <ExpenseCategoryFormDialog
          categories={rows.map(({ node }) => ({ id: node.id, name: node.name }))}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["expense-categories"] })}
        />
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isError && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-destructive">
                  {t("loadError")}
                </TableCell>
              </TableRow>
            )}
            {!isError && !isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {rows.map(({ node, depth }) => (
              <TableRow key={node.id}>
                <TableCell className="font-medium" style={{ paddingInlineStart: `${1 + depth * 1.5}rem` }}>
                  {node.name}
                </TableCell>
                <TableCell>
                  <Badge variant={node.isActive ? "default" : "secondary"}>
                    {node.isActive ? t("status.active") : t("status.inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {node.isActive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeactivate(node.id)}
                      aria-label={t("deactivate.confirm")}
                    >
                      <Ban className="h-4 w-4" />
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
