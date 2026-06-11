"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { CheckCircle, UsersRound } from "lucide-react";
import { O2Logo } from "@/components/ui/o2-logo";

// `useSearchParams` opts the component out of static prerendering
// unless wrapped in Suspense — same pattern as /login.
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const searchParams = useSearchParams();
  // When the user lands here from `/join/<token>` we carry the
  // invite token in the query so it survives the signup → email
  // verification → redirect round-trip. `emailRedirectTo` below
  // points back at /join/<token> so the user lands on the redeem
  // step after verifying instead of being dropped on /dashboard.
  const inviteToken = searchParams.get("invite");

  const [fullNome, setFullNome] = useState("");
  const [email, setE-mail] = useState("");
  const [password, setSenha] = useState("");
  const [confirmSenha, setConfirmarSenha] = useState("");
  const [error, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSucesso] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (password !== confirmSenha) {
      setErro("As senhas não coincidem");
      return;
    }

    if (password.length < 6) {
      setErro("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);

    // If we have an invite token, point Supabase's verification
    // email back at the join page so the user can accept after
    // verifying. Without a token, Supabase uses its default
    // redirect (the app root).
    const emailRedirectTo = inviteToken
      ? `${window.location.origin}/join/${encodeURIComponent(inviteToken)}`
      : undefined;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullNome,
        },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
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
              We&apos;ve sent a confirmation link to{" "}
              <span classNome="text-white">{email}</span>. Please check your
              inbox and click the link to verify your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={
                inviteToken
                  ? `/login?invite=${encodeURIComponent(inviteToken)}`
                  : "/login"
              }
            >
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
            {inviteToken ? (
              <UsersRound classNome="h-6 w-6 text-primary" />
            ) : (
              <MessageSquare classNome="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle classNome="text-xl text-white">
            {inviteToken ? "Criar conta e entrar" : "Criar conta"}
          </CardTitle>
          <CardDescription classNome="text-slate-400">
            {inviteToken
              ? "Verifique seu e-mail e aceite o convite para entrar no time."
              : "Comece com o Disparador Pro by O2Nexus"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} classNome="flex flex-col gap-4">
            {error && (
              <div classNome="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div classNome="flex flex-col gap-2">
              <Rótulo htmlFor="fullNome" classNome="text-slate-300">
                Nome completo
              </Rótulo>
              <Input
                id="fullNome"
                type="text"
                placeholder="João Silva"
                value={fullNome}
                onChange={(e) => setFullNome(e.target.value)}
                required
                classNome="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

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

            <div classNome="flex flex-col gap-2">
              <Rótulo htmlFor="password" classNome="text-slate-300">
                Senha
              </Rótulo>
              <Input
                id="password"
                type="password"
                placeholder="Pelo menos 6 caracteres"
                value={password}
                onChange={(e) => setSenha(e.target.value)}
                required
                classNome="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <div classNome="flex flex-col gap-2">
              <Rótulo htmlFor="confirmSenha" classNome="text-slate-300">
                Confirmarar senha
              </Rótulo>
              <Input
                id="confirmSenha"
                type="password"
                placeholder="Repita sua senha"
                value={confirmSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
                classNome="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              classNome="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Criando conta..." : "Criar conta"}
            </Button>
          </form>

          <p classNome="mt-6 text-center text-sm text-slate-400">
            Já tem uma conta?{" "}
            <Link
              href={
                inviteToken
                  ? `/login?invite=${encodeURIComponent(inviteToken)}`
                  : "/login"
              }
              classNome="text-primary hover:text-primary/80"
            >
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
