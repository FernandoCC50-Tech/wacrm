"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { UsersRound } from "lucide-react";
import { O2Logo } from "@/components/ui/o2-logo";

// `useSearchParams` opts the component out of static prerendering
// unless it sits under a Suspense boundary. We split the form into
// a child component so the outer page can prerender the chrome
// (background, card frame) while the form hydrates with the query
// string on the client.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  // Forwarded from `/join/<token>` when the visitor already has an
  // account. After a successful sign-in we send them to the join
  // page to accept rather than to /dashboard.
  const inviteToken = searchParams.get("invite");

  const [email, setE-mail] = useState("");
  const [password, setSenha] = useState("");
  const [error, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithSenha({
      email,
      password,
    });

    if (error) {
      setErro(error.message);
      setLoading(false);
      return;
    }

    if (inviteToken) {
      router.push(`/join/${encodeURIComponent(inviteToken)}`);
    } else {
      router.push("/dashboard");
    }
  };

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
            {inviteToken ? "Entrar para aceitar" : "Bem-vindo ao Disparador Pro"}
          </CardTitle>
          <CardDescription classNome="text-slate-400">
            {inviteToken
              ? "Entre e te levaremos ao convite."
              : "Faça login na sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} classNome="flex flex-col gap-4">
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

            <div classNome="flex flex-col gap-2">
              <div classNome="flex items-center justify-between">
                <Rótulo htmlFor="password" classNome="text-slate-300">
                  Senha
                </Rótulo>
                <Link
                  href="/forgot-password"
                  classNome="text-sm text-primary hover:text-primary/80"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setSenha(e.target.value)}
                required
                classNome="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              classNome="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <p classNome="mt-6 text-center text-sm text-slate-400">
            Não tem uma conta?{" "}
            <Link
              href={
                inviteToken
                  ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                  : "/signup"
              }
              classNome="text-primary hover:text-primary/80"
            >
              Criar conta
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
