"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateShiftDialog } from "@/components/employees/create-shift-dialog";
import { fetchJsonData } from "@/lib/fetch-json";

interface Store {
  id: string;
  name: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
}

interface ShiftRow {
  id: string;
  employeeId: string;
  startsAt: string;
  endsAt: string;
  status: string;
  employee: { id: string; firstName: string; lastName: string };
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  // Monday-start week — matches how the rest of this app's fr-FR date
  // formatting reads, rather than the JS default Sunday-start.
  const diff = (day === 0 ? -6 : 1) - day;
  const result = new Date(date);
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function WorkSchedulesView() {
  const t = useTranslations("workSchedules");
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canSchedule = session?.user.permissions.includes("employees:schedule") ?? false;

  const [storeId, setStoreId] = useState<string>("");
  const [weekStartInput, setWeekStartInput] = useState(toDateInputValue(startOfWeek(new Date())));

  // Store lists rarely change — a non-zero staleTime avoids an
  // immediate background refetch racing the store-picker's async default
  // (effectiveStoreId) on every mount, which otherwise briefly shows an
  // empty grid/select before the second fetch resolves.
  const storesQuery = useQuery({
    queryKey: ["stores"],
    queryFn: () => fetchJsonData<Store[]>("/api/stores"),
    staleTime: 60_000,
  });
  const stores = storesQuery.data?.data ?? [];
  const effectiveStoreId = storeId || stores[0]?.id || "";

  const weekStart = useMemo(() => startOfWeek(new Date(weekStartInput)), [weekStartInput]);
  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    return end;
  }, [weekStart]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + index);
      return day;
    }),
    [weekStart],
  );

  const shiftsParams = new URLSearchParams({
    storeId: effectiveStoreId,
    from: weekStart.toISOString(),
    to: weekEnd.toISOString(),
  });
  const shiftsQuery = useQuery({
    queryKey: ["work-shifts", effectiveStoreId, weekStartInput],
    queryFn: () => fetchJsonData<ShiftRow[]>(`/api/work-shifts?${shiftsParams.toString()}`),
    enabled: !!effectiveStoreId,
  });
  const shifts = shiftsQuery.data?.data ?? [];

  const employees = useMemo(() => {
    const byId = new Map<string, Employee>();
    for (const shift of shiftsQuery.data?.data ?? []) {
      byId.set(shift.employeeId, shift.employee);
    }
    return [...byId.values()].sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [shiftsQuery.data]);

  function shiftsFor(employeeId: string, day: Date): ShiftRow[] {
    return shifts.filter(
      (shift) => shift.employeeId === employeeId && new Date(shift.startsAt).toDateString() === day.toDateString(),
    );
  }

  async function handleCancelShift(shiftId: string) {
    const response = await fetch(`/api/work-shifts/${shiftId}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(t("cancelError"));
      return;
    }
    toast.success(t("cancelSuccess"));
    queryClient.invalidateQueries({ queryKey: ["work-shifts"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        action={
          canSchedule && effectiveStoreId ? (
            <CreateShiftDialog
              employeeId=""
              defaultStoreId={effectiveStoreId}
              onCreated={() => queryClient.invalidateQueries({ queryKey: ["work-shifts"] })}
            />
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>{t("store")}</Label>
          {/* Radix's Select only registers a SelectItem's label once that
              item has existed in SelectContent since mount — when the
              controlled `value` starts empty and later flips to an
              async-loaded default (the store list fetch), the trigger can
              be left showing no label at all even though the value and
              every downstream query are correct. Keying on the resolved
              value forces a clean remount once it's known, matching the
              (synchronous, always-populated) defaultValues every other
              Select in this app is driven by. */}
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
          <Label htmlFor="week-start">{t("weekOf")}</Label>
          <Input
            id="week-start"
            type="date"
            value={weekStartInput}
            onChange={(event) => setWeekStartInput(event.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.employee")}</TableHead>
              {days.map((day) => (
                <TableHead key={day.toISOString()}>
                  {day.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!shiftsQuery.isLoading && employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
            {employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="font-medium">
                  {employee.firstName} {employee.lastName}
                </TableCell>
                {days.map((day) => (
                  <TableCell key={day.toISOString()} className="align-top">
                    <div className="flex flex-col gap-1">
                      {shiftsFor(employee.id, day).map((shift) => (
                        <div
                          key={shift.id}
                          className="rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
                          title={shift.status}
                        >
                          {new Date(shift.startsAt).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {"–"}
                          {new Date(shift.endsAt).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {canSchedule && shift.status === "scheduled" && (
                            <button
                              type="button"
                              className="ms-1.5 text-primary/70 hover:text-destructive"
                              onClick={() => handleCancelShift(shift.id)}
                              aria-label={t("cancel")}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
