"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePosCartStore } from "@/stores/pos-cart-store";

interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
}

async function searchCustomers(q: string): Promise<CustomerOption[]> {
  const params = new URLSearchParams({ pageSize: "10" });
  if (q) params.set("q", q);
  const response = await fetch(`/api/customers?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to search customers");
  const body: { data: CustomerOption[] } = await response.json();
  return body.data;
}

// Loads this customer's active price overrides into the cart store so the
// POS cart/payment UI shows what they'll actually pay, not
// Product.sellingPrice — see the doc comment on PosCartState.customerPrices.
async function fetchCustomerPrices(customerId: string): Promise<Record<string, number>> {
  const response = await fetch(`/api/customers/${customerId}/prices`);
  if (!response.ok) return {};
  const body: { data: { product: { id: string }; price: number }[] } = await response.json();
  return Object.fromEntries(body.data.map((row) => [row.product.id, row.price]));
}

export function CustomerPicker() {
  const t = useTranslations("pos.cart");
  const tForm = useTranslations("customers.form");
  const queryClient = useQueryClient();
  const customer = usePosCartStore((state) => state.customer);
  const setCustomer = usePosCartStore((state) => state.setCustomer);
  const setCustomerPrices = usePosCartStore((state) => state.setCustomerPrices);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(handle);
  }, [query]);

  async function selectCustomer(option: CustomerOption) {
    setCustomer({ id: option.id, name: option.name });
    setOpen(false);
    const prices = await fetchCustomerPrices(option.id);
    setCustomerPrices(prices);
  }

  const { data: results = [] } = useQuery({
    queryKey: ["pos-customer-search", debounced],
    queryFn: () => searchCustomers(debounced),
    enabled: open,
  });

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, phone: newPhone || undefined }),
      });
      if (!response.ok) {
        toast.error(tForm("error"));
        return;
      }
      const body: { data: CustomerOption } = await response.json();
      setCustomer({ id: body.data.id, name: body.data.name });
      queryClient.invalidateQueries({ queryKey: ["pos-customer-search"] });
      setNewName("");
      setNewPhone("");
      setOpen(false);
      toast.success(tForm("success"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start gap-2">
          <User className="h-4 w-4" />
          {customer?.name ?? t("walkInCustomer")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("customer")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant={customer === null ? "default" : "outline"}
            onClick={() => {
              setCustomer(null);
              setOpen(false);
            }}
          >
            {t("walkInCustomer")}
          </Button>

          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tForm("name")}
          />

          {results.length > 0 && (
            <ul className="max-h-48 overflow-auto rounded-md border border-border">
              {results.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                    onClick={() => selectCustomer(option)}
                  >
                    <span>{option.name}</span>
                    {option.phone && <span className="text-muted-foreground">{option.phone}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-end gap-2 border-t border-border pt-3">
            <div className="flex-1 space-y-1">
              <Input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder={tForm("name")}
              />
              <Input
                value={newPhone}
                onChange={(event) => setNewPhone(event.target.value)}
                placeholder={tForm("phone")}
              />
            </div>
            <Button type="button" onClick={handleCreate} disabled={creating || !newName.trim()}>
              {creating ? tForm("submitting") : tForm("submit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
