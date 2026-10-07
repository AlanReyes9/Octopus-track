"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({ mode, signupEnabled = false }: { mode: "login" | "register"; signupEnabled?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(fd);
    if (mode === "register") body.acceptTerms = fd.get("acceptTerms") === "on";
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.issues?.[0]?.message ?? data.error ?? "No se pudo completar la operación");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  const isLogin = mode === "login";
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-bold tracking-tight">{isLogin ? "Bienvenido de nuevo" : "Crea la cuenta de tu empresa"}</h1>
        <p className="text-sm text-muted-foreground">
          {isLogin ? "Introduce tus credenciales para acceder al panel." : "Empieza a monitorear tu flota en minutos."}
        </p>
      </div>
      <form onSubmit={onSubmit} className="grid gap-4">
        {!isLogin && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="company">Empresa</Label>
              <Input id="company" name="company" required minLength={2} className="h-10" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Tu nombre</Label>
              <Input id="name" name="name" required minLength={2} className="h-10" />
            </div>
          </>
        )}
        <div className="grid gap-2">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" className="h-10" placeholder="tu@empresa.com" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={isLogin ? 1 : 10}
            autoComplete={isLogin ? "current-password" : "new-password"}
            className="h-10"
          />
          {!isLogin && <p className="text-xs text-muted-foreground">Mínimo 10 caracteres, con letras y números.</p>}
        </div>
        {!isLogin && (
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="acceptTerms" required className="mt-0.5 size-4 accent-violet-600" />
            <span>
              Acepto los{" "}
              <Link href="/legal/terminos" target="_blank" className="text-primary underline">términos y condiciones</Link> y he leído el{" "}
              <Link href="/legal/privacidad" target="_blank" className="text-primary underline">aviso de privacidad</Link>.
            </span>
          </label>
        )}
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={pending} className="h-10 w-full">
          {pending ? "Procesando…" : isLogin ? "Entrar" : "Crear cuenta"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        {isLogin ? (
          signupEnabled ? (
            <>¿No tienes cuenta? <Link href="/register" className="font-medium text-primary hover:underline">Regístrate</Link></>
          ) : (
            <>¿Necesitas acceso? Pide una cuenta al administrador de tu empresa.</>
          )
        ) : (
          <>¿Ya tienes cuenta? <Link href="/login" className="font-medium text-primary hover:underline">Inicia sesión</Link></>
        )}
      </p>
    </div>
  );
}
