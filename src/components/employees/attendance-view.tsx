"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, Clock, LogIn } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BackfillAttendanceDialog } from "@/components/employees/backfill-attendance-dialog";

interface Store {
  id: string;
  name: string;
}

interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface AttendanceRow {
  id: string;
  employeeId: string;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
  employee: { id: string; firstName: string; lastName: string };
}

async function fetchJson<T>(url: string): Promise<{ data: T }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return response.json();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AttendanceView() {
  const t = useTranslations("attendance");
  const queryClient = useQueryClient();

  const [storeId, setStoreId] = useState("");
  const [clockInEmployeeId, setClockInEmployeeId] = useState("");
  const [date, setDate] = useState(today());

  // See the identical comment in work-schedules-view.tsx — store lists
  // rarely change, so a non-zero staleTime avoids an immediate background
  // refetch racing the store-picker's async default on mount.
  const storesQuery = useQuery({
    queryKey: ["stores"],
    queryFn: () => fetchJson<Store[]>("/api/stores"),
    staleTime: 60_000,
  });
  const stores = storesQuery.data?.data ?? [];
  const effectiveStoreId = storeId || stores[0]?.id || "";

  const employeesQuery = useQuery({
    queryKey: ["employees-all"],
    queryFn: () => fetchJson<EmployeeOption[]>("/api/employees?pageSize=100"),
  });
  const employees = employeesQuery.data?.data ?? [];

  const params = new URLSearchParams({ storeId: effectiveStoreId, from: date, to: date });
  const attendanceQuery = useQuery({
    queryKey: ["attendance", effectiveStoreId, date],
    queryFn: () => fetchJson<AttendanceRow[]>(`/api/attendance?${params.toString()}`),
    enabled: !!effectiveStoreId,
  });
  const records = attendanceQuery.data?.data ?? [];

  const presentCount = records.filter((r) => r.status === "present" || r.status === "late").length;
  const openCount = records.filter((r) => r.clockIn && !r.clockOut).length;

  async function handleClockIn() {
    if (!clockInEmployeeId || !effectiveStoreId) return;
    const response = await fetch("/api/attendance/clock-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: clockInEmployeeId, storeId: effectiveStoreId }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error?.message ?? t("clockInError"));
      return;
    }
    toast.success(t("clockInSuccess"));
    setClockInEmployeeId("");
    queryClient.invalidateQueries({ queryKey: ["attendance"] });
  }

  async function handleClockOut(recordId: string) {
    const response = await fetch("/api/attendance/clock-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId }),
    });
    if (!response.ok) {
      toast.error(t("clockOutError"));
      return;
    }
    toast.success(t("clockOutSuccess"));
    queryClient.invalidateQueries({ queryKey: ["attendance"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        action={
          effectiveStoreId ? (
            <BackfillAttendanceDialog
              storeId={effectiveStoreId}
              onCreated={() => queryClient.invalidateQueries({ queryKey: ["attendance"] })}
            />
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatTile label={t("summary.present")} value={presentCount} icon={CheckCircle2} />
        <StatTile label={t("summary.stillClockedIn")} value={openCount} icon={Clock} />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>{t("store")}</Label>
          {/* See the identical comment in work-schedules-view.tsx — keying
              on the resolved value forces a clean remount once the
              async-loaded store default is known, since Radix's Select
              otherwise never registers a label for a value that wasn't
              present in SelectContent's children at mount time. */}
          <Select key={effectiveStoreId || "loading"} value={effectiveStoreId} onValueChange={setStoreId}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="attendance-date">{t("date")}</Label>
          <Input id="attendance-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-4">
        <div className="flex flex-col gap-1.5">
          <Label>{t("clockInAction")}</Label>
          <Select value={clockInEmployeeId} onValueChange={setClockInEmployeeId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder={t("selectEmployee")} />
            </SelectTrigger>
            <SelectContent>
              {employees.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.firstName} {employee.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleClockIn} disabled={!clockInEmployeeId}>
          <LogIn className="h-4 w-4" />
          {t("clockIn")}
        </Button>
      </div>

      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.employee")}</TableHead>
              <TableHead>{t("table.clockIn")}</TableHead>
              <TableHead>{t("table.clockOut")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!attendanceQuery.isLoading && records.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {records.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="font-medium">
                  {record.employee.firstName} {record.employee.lastName}
                </TableCell>
                <TableCell>{record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : "—"}</TableCell>
                <TableCell>{record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : "—"}</TableCell>
                <TableCell>
                  <StatusBadge domain="attendance" status={record.status}>
                    {t(`statuses.${record.status}`)}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  {record.clockIn && !record.clockOut && (
                    <Button variant="ghost" size="sm" onClick={() => handleClockOut(record.id)}>
                      {t("clockOut")}
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
