"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateRoleDialog } from "@/components/employees/create-role-dialog";

interface Permission {
  id: string;
  name: string;
  module: string;
}

interface PermissionModule {
  module: string;
  permissions: Permission[];
}

interface RolePermission {
  permission: Permission;
}

interface UserRoleRow {
  id: string;
  user: { id: string; firstName: string; lastName: string; email: string };
  store: { id: string; name: string } | null;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  rolePermissions: RolePermission[];
  userRoles: UserRoleRow[];
}

interface TenantUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Store {
  id: string;
  name: string;
}

async function fetchJson<T>(url: string): Promise<{ data: T }> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}`);
  return response.json();
}

export function RolesView() {
  const t = useTranslations("roles");
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignStoreId, setAssignStoreId] = useState<string>("__all__");

  const rolesQuery = useQuery({ queryKey: ["roles"], queryFn: () => fetchJson<Role[]>("/api/roles") });
  const catalogQuery = useQuery({
    queryKey: ["permission-catalog"],
    queryFn: () => fetchJson<PermissionModule[]>("/api/permissions"),
  });
  const usersQuery = useQuery({ queryKey: ["roles-users"], queryFn: () => fetchJson<TenantUser[]>("/api/roles/users") });
  const storesQuery = useQuery({ queryKey: ["stores"], queryFn: () => fetchJson<Store[]>("/api/stores") });

  const roles = rolesQuery.data?.data ?? [];
  const catalog = catalogQuery.data?.data ?? [];
  const users = usersQuery.data?.data ?? [];
  const stores = storesQuery.data?.data ?? [];

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0];

  const checkedPermissionNames = useMemo(
    () => new Set(selectedRole?.rolePermissions.map((rp) => rp.permission.name) ?? []),
    [selectedRole],
  );
  const [pendingPermissions, setPendingPermissions] = useState<Set<string> | null>(null);
  const activePermissions = pendingPermissions ?? checkedPermissionNames;

  function togglePermission(name: string) {
    const next = new Set(activePermissions);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setPendingPermissions(next);
  }

  async function handleSavePermissions() {
    if (!selectedRole) return;
    const response = await fetch(`/api/roles/${selectedRole.id}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissionNames: [...activePermissions] }),
    });
    if (!response.ok) {
      toast.error(t("permissions.error"));
      return;
    }
    toast.success(t("permissions.success"));
    setPendingPermissions(null);
    queryClient.invalidateQueries({ queryKey: ["roles"] });
  }

  async function handleAssign() {
    if (!selectedRole || !assignUserId) return;
    const response = await fetch(`/api/roles/${selectedRole.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: assignUserId, storeId: assignStoreId === "__all__" ? undefined : assignStoreId }),
    });
    if (!response.ok) {
      toast.error(t("assign.error"));
      return;
    }
    toast.success(t("assign.success"));
    setAssignUserId("");
    setAssignStoreId("__all__");
    queryClient.invalidateQueries({ queryKey: ["roles"] });
  }

  async function handleRevoke(roleId: string, userRoleId: string) {
    const response = await fetch(`/api/roles/${roleId}/assign/${userRoleId}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(t("assign.revokeError"));
      return;
    }
    toast.success(t("assign.revokeSuccess"));
    queryClient.invalidateQueries({ queryKey: ["roles"] });
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        action={<CreateRoleDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["roles"] })} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <div className="rounded-md border border-border">
          <Table>
            <TableBody>
              {roles.map((role) => (
                <TableRow
                  key={role.id}
                  className={role.id === selectedRole?.id ? "bg-muted/50" : "cursor-pointer"}
                  onClick={() => {
                    setSelectedRoleId(role.id);
                    setPendingPermissions(null);
                  }}
                >
                  <TableCell>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{role.name}</span>
                      {role.isSystem && (
                        <Badge variant="outline" className="text-xs">
                          {t("systemRole")}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {selectedRole && (
          <div className="flex flex-col gap-6">
            <div className="rounded-md border border-border p-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t("permissions.title")}</h2>
                {pendingPermissions && (
                  <Button size="sm" onClick={handleSavePermissions}>
                    {t("permissions.save")}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {catalog.map((moduleGroup) => (
                  <div key={moduleGroup.module} className="flex flex-col gap-2">
                    <div className="text-sm font-medium capitalize">{moduleGroup.module}</div>
                    {moduleGroup.permissions.map((permission) => (
                      <label key={permission.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={activePermissions.has(permission.name)}
                          onCheckedChange={() => togglePermission(permission.name)}
                        />
                        {permission.name}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-border p-4">
              <h2 className="mb-4 text-lg font-semibold">{t("assign.title")}</h2>
              <div className="mb-4 flex flex-wrap items-end gap-2">
                <Select value={assignUserId} onValueChange={setAssignUserId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder={t("assign.selectUser")} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.firstName} {user.lastName} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={assignStoreId} onValueChange={setAssignStoreId}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t("assign.allStores")}</SelectItem>
                    {stores.map((store) => (
                      <SelectItem key={store.id} value={store.id}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAssign} disabled={!assignUserId}>
                  {t("assign.submit")}
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("assign.table.user")}</TableHead>
                    <TableHead>{t("assign.table.store")}</TableHead>
                    <TableHead className="text-right">{t("assign.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRole.userRoles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        {t("assign.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                  {selectedRole.userRoles.map((userRole) => (
                    <TableRow key={userRole.id}>
                      <TableCell>
                        {userRole.user.firstName} {userRole.user.lastName}
                      </TableCell>
                      <TableCell>{userRole.store?.name ?? t("assign.allStores")}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevoke(selectedRole.id, userRole.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
