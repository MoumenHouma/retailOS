"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDa } from "@/lib/currency";
import { EmployeeFormDialog, type EmployeeEditData } from "@/components/employees/employee-form-dialog";
import { CreateShiftDialog } from "@/components/employees/create-shift-dialog";
import { fetchJsonData } from "@/lib/fetch-json";
import { DetailPageSkeleton } from "@/components/ui/page-skeleton";
import { TableRowsSkeleton } from "@/components/ui/table-skeleton";

interface EmployeeDetail extends EmployeeEditData {
  isActive: boolean;
}

interface ShiftRow {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  store: { id: string; name: string } | null;
}

interface AttendanceRow {
  id: string;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
}

interface CommissionRow {
  id: string;
  amount: number;
  baseAmount: number;
  calculatedAt: string;
  rule: { name: string };
  sale: { saleNumber: string };
}

async function fetchEmployee(id: string): Promise<EmployeeDetail> {
  const response = await fetch(`/api/employees/${id}`);
  if (!response.ok) throw new Error("Failed to load employee");
  const body: { data: EmployeeDetail } = await response.json();
  return body.data;
}

export function EmployeeDetailView({ id }: { id: string }) {
  const t = useTranslations("employees");
  const tSchedules = useTranslations("workSchedules");
  const tAttendance = useTranslations("attendance");
  const tCommissions = useTranslations("commissionRules");
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canEditPayroll = session?.user.permissions.includes("employees:payroll") ?? false;
  const canSchedule = session?.user.permissions.includes("employees:schedule") ?? false;

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: () => fetchEmployee(id),
  });

  const shiftsQuery = useQuery({
    queryKey: ["employee-shifts", id],
    queryFn: () => fetchJsonData<ShiftRow[]>(`/api/work-shifts?employeeId=${id}`),
  });
  const attendanceQuery = useQuery({
    queryKey: ["employee-attendance", id],
    queryFn: () => fetchJsonData<AttendanceRow[]>(`/api/attendance?employeeId=${id}`),
  });
  const commissionsQuery = useQuery({
    queryKey: ["employee-commissions", id],
    queryFn: () => fetchJsonData<CommissionRow[]>(`/api/commissions?employeeId=${id}`),
  });

  async function handleCancelShift(shiftId: string) {
    const response = await fetch(`/api/work-shifts/${shiftId}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(tSchedules("cancelError"));
      return;
    }
    toast.success(tSchedules("cancelSuccess"));
    queryClient.invalidateQueries({ queryKey: ["employee-shifts", id] });
  }

  if (isLoading || !employee) {
    return <DetailPageSkeleton statTiles={0} />;
  }

  const shifts = shiftsQuery.data?.data ?? [];
  const attendance = attendanceQuery.data?.data ?? [];
  const commissions = commissionsQuery.data?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${employee.firstName} ${employee.lastName}`}
        action={
          <EmployeeFormDialog
            employee={employee}
            canEditPayroll={canEditPayroll}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["employee", id] })}
          />
        }
      />

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t("tabs.profile")}</TabsTrigger>
          <TabsTrigger value="schedule">{t("tabs.schedule")}</TabsTrigger>
          <TabsTrigger value="attendance">{t("tabs.attendance")}</TabsTrigger>
          <TabsTrigger value="commissions">{t("tabs.commissions")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid grid-cols-2 gap-4 rounded-md border border-border p-4 text-sm">
            <div>
              <div className="text-muted-foreground">{t("form.phone")}</div>
              <div>{employee.phone ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t("form.email")}</div>
              <div>{employee.email ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t("form.position")}</div>
              <div>{employee.position ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t("form.department")}</div>
              <div>{employee.department ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t("form.hireDate")}</div>
              <div>{employee.hireDate ? new Date(employee.hireDate).toLocaleDateString() : "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t("form.contractType")}</div>
              <div>{t(`form.contractTypes.${employee.contractType}`)}</div>
            </div>
            {canEditPayroll && (
              <div>
                <div className="text-muted-foreground">{t("form.salary")}</div>
                <div>{employee.salary != null ? formatDa(employee.salary) : "—"}</div>
              </div>
            )}
            <div className="col-span-2">
              <div className="text-muted-foreground">{t("form.address")}</div>
              <div>{employee.address ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t("table.status")}</div>
              <Badge variant={employee.isActive ? "default" : "secondary"}>
                {employee.isActive ? t("status.active") : t("status.inactive")}
              </Badge>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="schedule">
          <div className="flex flex-col gap-4">
            {canSchedule && (
              <div className="flex justify-end">
                <CreateShiftDialog
                  employeeId={id}
                  onCreated={() => queryClient.invalidateQueries({ queryKey: ["employee-shifts", id] })}
                />
              </div>
            )}
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tSchedules("table.store")}</TableHead>
                    <TableHead>{tSchedules("table.starts")}</TableHead>
                    <TableHead>{tSchedules("table.ends")}</TableHead>
                    <TableHead>{tSchedules("table.status")}</TableHead>
                    {canSchedule && <TableHead className="text-right">{tSchedules("table.actions")}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shiftsQuery.isLoading && (
                    <TableRowsSkeleton columns={canSchedule ? 5 : 4} rows={4} />
                  )}
                  {!shiftsQuery.isLoading && shifts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={canSchedule ? 5 : 4} className="text-center text-muted-foreground">
                        {tSchedules("empty")}
                      </TableCell>
                    </TableRow>
                  )}
                  {shifts.map((shift) => (
                    <TableRow key={shift.id}>
                      <TableCell>{shift.store?.name ?? "—"}</TableCell>
                      <TableCell>{new Date(shift.startsAt).toLocaleString()}</TableCell>
                      <TableCell>{new Date(shift.endsAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <StatusBadge domain="shift" status={shift.status}>
                          {tSchedules(`status.${shift.status}`)}
                        </StatusBadge>
                      </TableCell>
                      {canSchedule && (
                        <TableCell className="text-right">
                          {shift.status === "scheduled" && (
                            <Button variant="ghost" size="sm" onClick={() => handleCancelShift(shift.id)}>
                              {tSchedules("cancel")}
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="attendance">
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tAttendance("table.date")}</TableHead>
                  <TableHead>{tAttendance("table.clockIn")}</TableHead>
                  <TableHead>{tAttendance("table.clockOut")}</TableHead>
                  <TableHead>{tAttendance("table.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceQuery.isLoading && <TableRowsSkeleton columns={4} rows={4} />}
                {!attendanceQuery.isLoading && attendance.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {tAttendance("empty")}
                    </TableCell>
                  </TableRow>
                )}
                {attendance.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{new Date(record.workDate).toLocaleDateString()}</TableCell>
                    <TableCell>{record.clockIn ? new Date(record.clockIn).toLocaleTimeString() : "—"}</TableCell>
                    <TableCell>{record.clockOut ? new Date(record.clockOut).toLocaleTimeString() : "—"}</TableCell>
                    <TableCell>
                      <StatusBadge domain="attendance" status={record.status}>
                        {tAttendance(`statuses.${record.status}`)}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="commissions">
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tCommissions("table.date")}</TableHead>
                  <TableHead>{tCommissions("table.rule")}</TableHead>
                  <TableHead>{tCommissions("table.sale")}</TableHead>
                  <TableHead className="text-right">{tCommissions("table.base")}</TableHead>
                  <TableHead className="text-right">{tCommissions("table.amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionsQuery.isLoading && <TableRowsSkeleton columns={5} rows={4} />}
                {!commissionsQuery.isLoading && commissions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {tCommissions("empty")}
                    </TableCell>
                  </TableRow>
                )}
                {commissions.map((commission) => (
                  <TableRow key={commission.id}>
                    <TableCell>{new Date(commission.calculatedAt).toLocaleDateString()}</TableCell>
                    <TableCell>{commission.rule.name}</TableCell>
                    <TableCell>{commission.sale.saleNumber}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDa(commission.baseAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDa(commission.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
