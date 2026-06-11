"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Coins, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CURRENCIES } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Rótulo } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

/**
 * Deals settings — account-wide default currency.
 *
 * One currency per account (issue #218): the chosen code seeds new
 * deals and formats every aggregated total. Existing deals keep their
 * own saved currency. Writes go straight to `accounts.default_currency`;
 * the `accounts_update` RLS policy (017) already restricts that to
 * admins+, so non-admins see a disabled, read-only control.
 */
export function DealsSettings() {
  const supabase = createClient();
  const {
    accountId,
    defaultCurrency,
    canEditarSettings,
    profileLoading,
    refreshProfile,
  } = useAuth();

  const [selected, setSelecionared] = useState(defaultCurrency);
  const [saving, setSaving] = useState(false);

  // Keep the select in sync once the profile (and its account default)
  // resolves, and after a save round-trips through refreshProfile.
  useEffect(() => {
    setSelecionared(defaultCurrency);
  }, [defaultCurrency]);

  const dirty = selected !== defaultCurrency;

  async function handleSalvar() {
    if (!accountId || !dirty) return;
    setSaving(true);
    const { error } = await supabase
      .from("accounts")
      .update({ default_currency: selected })
      .eq("id", accountId);
    if (error) {
      toast.error("Falhou to save default currency");
      setSaving(false);
      return;
    }
    // Pull the new value back into the auth context so the deal form
    // and every total pick it up without a full reload.
    await refreshProfile();
    setSaving(false);
    toast.success("Default currency updated");
  }

  return (
    <section classNome="mt-4 space-y-4">
      <Card classNome="bg-slate-900 border-slate-700 ring-0 ring-transparent">
        <CardHeader>
          <CardTitle classNome="flex items-center gap-2 text-white">
            <Coins classNome="size-4 text-primary" />
            Default currency
          </CardTitle>
          <CardDescription classNome="text-slate-400">
            Novo deals default to this currency, and pipeline and
            dashboard totals are shown in it. Existing deals keep the
            currency they were saved with.
          </CardDescription>
        </CardHeader>
        <CardContent classNome="space-y-4">
          <div classNome="grid gap-2 sm:max-w-xs">
            <Rótulo classNome="text-slate-300">Currency</Rótulo>
            <select
              value={selected}
              onChange={(e) => setSelecionared(e.target.value)}
              disabled={!canEditarSettings || profileLoading}
              classNome="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </option>
              ))}
            </select>
            {!canEditarSettings && (
              <p classNome="text-xs text-slate-500">
                Only account admins can change the default currency.
              </p>
            )}
          </div>

          {canEditarSettings && (
            <Button
              onClick={handleSalvar}
              disabled={saving || !dirty}
              classNome="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? (
                <>
                  <Loader2 classNome="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
