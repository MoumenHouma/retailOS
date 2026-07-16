"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2, Wallet, Gift, Receipt, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDa } from "@/lib/currency";
import { CustomerFormDialog, type CustomerEditData } from "@/components/customers/customer-form-dialog";
import { LoyaltyRedeemDialog } from "@/components/customers/loyalty-redeem-dialog";
import { CreateDebtDialog } from "@/components/customers/create-debt-dialog";
import { RecordDebtPaymentDialog } from "@/components/customers/record-debt-payment-dialog";
import { SetCustomerPriceDialog } from "@/components/customers/set-customer-price-dialog";
import { fetchJsonData } from "@/lib/fetch-json";
import { DetailPageSkeleton } from "@/components/ui/page-skeleton";
import { TableRowsSkeleton } from "@/components/ui/table-skeleton";

interface CustomerDetail extends CustomerEditData {
  loyaltyPoints: number;
  currentDebt: number;
  totalPurchases: number;
  totalSpent: number;
  visitCount: number;
  isActive: boolean;
}

interface SaleRow {
  id: string;
  saleNumber: string;
  createdAt: string;
  total: number;
  items: { id: string }[];
}

interface LoyaltyTransaction {
  id: string;
  points: number;
  balanceAfter: number;
  reason: string;
  createdAt: string;
}

interface DebtRow {
  id: string;
  amount: number;
  remaining: number;
  status: string;
  dueDate: string | null;
  createdAt: string;
}

interface CustomerPriceRow {
  id: string;
  price: number;
  product: { id: string; name: string };
}

async function fetchCustomer(id: string): Promise<CustomerDetail> {
  const response = await fetch(`/api/customers/${id}`);
  if (!response.ok) throw new Error("Failed to load customer");
  const body: { data: CustomerDetail } = await response.json();
  return body.data;
}

export function CustomerDetailView({ id }: { id: string }) {
  const t = useTranslations("customers");
  const tDebts = useTranslations("customerDebts");
  const tPricing = useTranslations("customerPricing");
  const tLoyalty = useTranslations("loyalty");
  const queryClient = useQueryClient();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => fetchCustomer(id),
  });

  const purchaseHistoryQuery = useQuery({
    queryKey: ["customer-purchase-history", id],
    queryFn: () => fetchJsonData<SaleRow[]>(`/api/customers/${id}/purchase-history`),
  });
  const loyaltyQuery = useQuery({
    queryKey: ["customer-loyalty", id],
    queryFn: () => fetchJsonData<LoyaltyTransaction[]>(`/api/customers/${id}/loyalty`),
  });
  const debtsQuery = useQuery({
    queryKey: ["customer-debts", id],
    queryFn: () => fetchJsonData<DebtRow[]>(`/api/customers/${id}/debts`),
  });
  const pricesQuery = useQuery({
    queryKey: ["customer-prices", id],
    queryFn: () => fetchJsonData<CustomerPriceRow[]>(`/api/customers/${id}/prices`),
  });

  async function handleRemovePrice(priceId: string) {
    if (!window.confirm(tPricing("delete.confirm"))) return;
    const response = await fetch(`/api/customers/${id}/prices/${priceId}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error(tPricing("delete.error"));
      return;
    }
    toast.success(tPricing("delete.success"));
    queryClient.invalidateQueries({ queryKey: ["customer-prices", id] });
  }

  if (isLoading || !customer) {
    return <DetailPageSkeleton />;
  }

  const purchaseHistory = purchaseHistoryQuery.data?.data ?? [];
  const loyaltyTransactions = loyaltyQuery.data?.data ?? [];
  const debts = debtsQuery.data?.data ?? [];
  const prices = pricesQuery.data?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={customer.name}
        action={
          <CustomerFormDialog
            customer={customer}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["customer", id] })}
          />
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatTile label={t("detail.loyaltyPoints")} value={customer.loyaltyPoints} icon={Gift} />
        <StatTile
          label={t("detail.currentDebt")}
          value={formatDa(customer.currentDebt)}
          icon={CreditCard}
          tone={customer.currentDebt > 0 ? "warning" : "default"}
        />
        <StatTile label={t("detail.totalSpent")} value={formatDa(customer.totalSpent)} icon={Wallet} />
        <StatTile label={t("detail.totalPurchases")} value={customer.totalPurchases} icon={Receipt} />
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t("tabs.profile")}</TabsTrigger>
          <TabsTrigger value="history">{t("tabs.purchaseHistory")}</TabsTrigger>
          <TabsTrigger value="loyalty">{t("tabs.loyalty")}</TabsTrigger>
          <TabsTrigger value="debts">{t("tabs.debts")}</TabsTrigger>
          <TabsTrigger value="pricing">{t("tabs.pricing")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid grid-cols-2 gap-4 rounded-md border border-border p-4 text-sm">
            <div>
              <div className="text-muted-foreground">{t("form.phone")}</div>
              <div>{customer.phone ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t("form.email")}</div>
              <div>{customer.email ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t("form.city")}</div>
              <div>{customer.city ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t("form.nif")}</div>
              <div>{customer.nif ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t("form.customerType")}</div>
              <div>{t(`form.customerTypes.${customer.customerType}`)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t("form.creditLimit")}</div>
              <div>{formatDa(customer.creditLimit)}</div>
            </div>
            <div className="col-span-2">
              <div className="text-muted-foreground">{t("form.address")}</div>
              <div>{customer.address ?? "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">{t("table.status")}</div>
              <Badge variant={customer.isActive ? "default" : "secondary"}>
                {customer.isActive ? t("status.active") : t("status.inactive")}
              </Badge>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("history.saleNumber")}</TableHead>
                  <TableHead>{t("history.date")}</TableHead>
                  <TableHead className="text-right">{t("history.items")}</TableHead>
                  <TableHead className="text-right">{t("history.total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchaseHistoryQuery.isLoading && <TableRowsSkeleton columns={4} rows={4} />}
                {!purchaseHistoryQuery.isLoading && purchaseHistory.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t("history.empty")}
                    </TableCell>
                  </TableRow>
                )}
                {purchaseHistory.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{sale.saleNumber}</TableCell>
                    <TableCell>{new Date(sale.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">{sale.items.length}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDa(sale.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="loyalty">
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <LoyaltyRedeemDialog
                customerId={id}
                balance={customer.loyaltyPoints}
                onRedeemed={() => {
                  queryClient.invalidateQueries({ queryKey: ["customer", id] });
                  queryClient.invalidateQueries({ queryKey: ["customer-loyalty", id] });
                }}
              />
            </div>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tLoyalty("table.date")}</TableHead>
                    <TableHead>{tLoyalty("table.reason")}</TableHead>
                    <TableHead className="text-right">{tLoyalty("table.points")}</TableHead>
                    <TableHead className="text-right">{tLoyalty("table.balance")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loyaltyQuery.isLoading && <TableRowsSkeleton columns={4} rows={4} />}
                  {!loyaltyQuery.isLoading && loyaltyTransactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        {tLoyalty("table.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                  {loyaltyTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{new Date(transaction.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{transaction.reason}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {transaction.points > 0 ? `+${transaction.points}` : transaction.points}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{transaction.balanceAfter}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="debts">
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <CreateDebtDialog
                customerId={id}
                onCreated={() => {
                  queryClient.invalidateQueries({ queryKey: ["customer-debts", id] });
                  queryClient.invalidateQueries({ queryKey: ["customer", id] });
                }}
              />
            </div>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tDebts("table.date")}</TableHead>
                    <TableHead>{tDebts("table.dueDate")}</TableHead>
                    <TableHead className="text-right">{tDebts("table.amount")}</TableHead>
                    <TableHead className="text-right">{tDebts("table.remaining")}</TableHead>
                    <TableHead>{tDebts("table.status")}</TableHead>
                    <TableHead className="text-right">{tDebts("table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtsQuery.isLoading && <TableRowsSkeleton columns={6} rows={4} />}
                  {!debtsQuery.isLoading && debts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        {tDebts("table.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                  {debts.map((debt) => (
                    <TableRow key={debt.id}>
                      <TableCell>{new Date(debt.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{debt.dueDate ? new Date(debt.dueDate).toLocaleDateString() : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDa(debt.amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDa(debt.remaining)}</TableCell>
                      <TableCell>
                        <Badge variant={debt.status === "outstanding" ? "secondary" : "default"}>
                          {tDebts(`status.${debt.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <RecordDebtPaymentDialog
                          debtId={debt.id}
                          remaining={debt.remaining}
                          onRecorded={() => {
                            queryClient.invalidateQueries({ queryKey: ["customer-debts", id] });
                            queryClient.invalidateQueries({ queryKey: ["customer", id] });
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pricing">
          <div className="flex flex-col gap-4">
            <div className="flex justify-end">
              <SetCustomerPriceDialog
                customerId={id}
                onSaved={() => queryClient.invalidateQueries({ queryKey: ["customer-prices", id] })}
              />
            </div>
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{tPricing("table.product")}</TableHead>
                    <TableHead className="text-right">{tPricing("table.price")}</TableHead>
                    <TableHead className="text-right">{tPricing("table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricesQuery.isLoading && <TableRowsSkeleton columns={3} rows={4} />}
                  {!pricesQuery.isLoading && prices.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        {tPricing("table.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                  {prices.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.product.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatDa(row.price)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemovePrice(row.id)}
                          aria-label={tPricing("delete.confirm")}
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
