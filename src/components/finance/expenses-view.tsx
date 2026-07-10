"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpensesTab } from "@/components/finance/expenses-tab";
import { ExpenseCategoriesTab } from "@/components/finance/expense-categories-tab";

export function ExpensesView() {
  const t = useTranslations("expenses");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("title")} />

      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">{t("tabs.expenses")}</TabsTrigger>
          <TabsTrigger value="categories">{t("tabs.categories")}</TabsTrigger>
        </TabsList>
        <TabsContent value="expenses">
          <ExpensesTab />
        </TabsContent>
        <TabsContent value="categories">
          <ExpenseCategoriesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
