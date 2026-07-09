"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { daToCentimes } from "@/lib/currency";

const openSessionFormSchema = z.object({
  terminalName: z.string().min(1),
  openingCash: z.coerce.number().min(0),
});

type OpenSessionFormValues = z.infer<typeof openSessionFormSchema>;

export function OpenSessionForm({ storeId, onOpened }: { storeId: string; onOpened: () => void }) {
  const t = useTranslations("pos.session");

  const form = useForm<OpenSessionFormValues>({
    resolver: zodResolver(openSessionFormSchema),
    defaultValues: { terminalName: "Caisse 1", openingCash: 0 },
  });

  async function onSubmit(values: OpenSessionFormValues) {
    const response = await fetch("/api/pos/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        terminalName: values.terminalName,
        openingCash: daToCentimes(values.openingCash),
      }),
    });

    if (!response.ok) {
      toast.error(t("openError"));
      return;
    }

    toast.success(t("openSuccess"));
    onOpened();
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("openTitle")}</CardTitle>
          <CardDescription>{t("openDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="terminalName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("terminalName")}</FormLabel>
                    <FormControl>
                      <Input {...field} autoFocus />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="openingCash"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("openingCash")}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t("opening") : t("openSubmit")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
