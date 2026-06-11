"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Rótulo } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MessageSquare, CheckCircle, ArrowLeft } from "lucide-react";

export default function ForgotSenhaPage() {
  const [email, setE-mail] = useState("");
  const [error, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSucesso] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setLoading(true);

    const { error } = await supabase.auth.resetSenhaForE-mail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    setSucesso(true);
    setLoading(false);
  };

  if (success) {
    return (
      <div classNome="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <Card classNome="w-full max-w-md border-slate-800 bg-slate-900">
          <CardHeader classNome="items-center text-center">
            <div classNome="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <CheckCircle classNome="h-6 w-6 text-primary" />
            </div>
            <CardTitle classNome="text-xl text-white">
              Verifique seu e-mail
            </CardTitle>
            <CardDescription classNome="text-slate-400">
              We&apos;ve sent a password reset link to{" "}
              <span classNome="text-white">{email}</span>. Please check your
              inbox.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button
                variant="outline"
                classNome="w-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                Voltar ao login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div classNome="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card classNome="w-full max-w-md border-slate-800 bg-slate-900">
        <CardHeader classNome="items-center text-center">
          <div classNome="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <MessageSquare classNome="h-6 w-6 text-primary" />
          </div>
          <CardTitle classNome="text-xl text-white">Reset password</CardTitle>
          <CardDescription classNome="text-slate-400">
            Enter your email and we&apos;ll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} classNome="flex flex-col gap-4">
            {error && (
              <div classNome="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div classNome="flex flex-col gap-2">
              <Rótulo htmlFor="email" classNome="text-slate-300">
                E-mail
              </Rótulo>
              <Input
                id="email"
                type="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setE-mail(e.target.value)}
                required
                classNome="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              classNome="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Enviaring..." : "Enviar reset link"}
            </Button>
          </form>

          <Link
            href="/login"
            classNome="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-300"
          >
            <ArrowLeft classNome="h-4 w-4" />
            Voltar ao login
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
