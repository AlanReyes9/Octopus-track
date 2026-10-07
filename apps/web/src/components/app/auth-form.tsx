"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo completar la operación");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  const isLogin = mode === "login";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{isLogin ? "Iniciar sesión" : "Crear cuenta de empresa"}</CardTitle>
        <CardDescription>
          {isLogin ? "Accede al panel de tu flota" : "Registra tu empresa y empieza a rastrear vehículos"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          {!isLogin && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="company">Empresa</Label>
                <Input id="company" name="company" required minLength={2} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Tu nombre</Label>
                <Input id="name" name="name" required minLength={2} />
              </div>
            </>
          )}
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={isLogin ? 1 : 8}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Procesando…" : isLogin ? "Entrar" : "Crear cuenta"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? (
              <>
                ¿No tienes cuenta?{" "}
                <Link href="/register" className="text-primary underline-offset-4 hover:underline">
                  Regístrate
                </Link>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{" "}
                <Link href="/login" className="text-primary underline-offset-4 hover:underline">
                  Inicia sesión
                </Link>
              </>
            )}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
