"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { Link } from "@/i18n/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmployeeFormDialog, type EmployeeEditData } from "@/components/employees/employee-form-dialog";

interface Employee extends EmployeeEditData {
  isActive: boolean;
}

interface EmployeesResponse {
  data: Employee[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

const PAGE_SIZE = 20;

async function fetchEmployees(params: { q: string; page: number }): Promise<EmployeesResponse> {
  const searchParams = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) });
  if (params.q) searchParams.set("q", params.q);

  const response = await fetch(`/api/employees?${searchParams.toString()}`);
  if (!response.ok) throw new Error("Failed to load employees");
  return response.json();
}

export function EmployeesView() {
  const t = useTranslations("employees");
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canEditPayroll = session?.user.permissions.includes("employees:payroll") ?? false;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["employees", { q: debouncedSearch, page }],
    queryFn: () => fetchEmployees({ q: debouncedSearch, page }),
    placeholderData: (previous) => previous,
  });

  async function handleDelete(id: string) {
    if (!window.confirm(t("delete.confirm"))) return;

    const response = await fetch(`/api/employees/${id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(t("delete.error"));
      return;
    }
    toast.success(t("delete.success"));
    queryClient.invalidateQueries({ queryKey: ["employees"] });
  }

  const employees = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("title")}
        action={
          <EmployeeFormDialog
            canEditPayroll={canEditPayroll}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["employees"] })}
          />
        }
      />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder={t("searchPlaceholder")}
          className="pl-8"
        />
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.position")}</TableHead>
              <TableHead>{t("table.department")}</TableHead>
              <TableHead>{t("table.contractType")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
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
            {!isError && !isLoading && employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="font-medium">
                  <Link href={`/employees/${employee.id}`} className="hover:underline">
                    {employee.firstName} {employee.lastName}
                  </Link>
                </TableCell>
                <TableCell>{employee.position ?? "—"}</TableCell>
                <TableCell>{employee.department ?? "—"}</TableCell>
                <TableCell>{t(`form.contractTypes.${employee.contractType}`)}</TableCell>
                <TableCell>
                  <Badge variant={employee.isActive ? "default" : "secondary"}>
                    {employee.isActive ? t("status.active") : t("status.inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <EmployeeFormDialog
                    employee={employee}
                    canEditPayroll={canEditPayroll}
                    onSaved={() => queryClient.invalidateQueries({ queryKey: ["employees"] })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(employee.id)}
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
