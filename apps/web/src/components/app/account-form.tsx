"use client";

import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/fetcher";

export function AccountForm({ forced }: { forced: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const d = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setError(null);
    if (d.next !== d.confirm) return setError("Las contraseñas nuevas no coinciden");
    setPending(true);
    try {
      await api("/api/account/password", { method: "POST", json: { current: d.current, next: d.next } });
      form.reset();
      setDone(true);
      if (forced) {
        router.replace("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Cambiar contraseña</CardTitle>
        <CardDescription>Mínimo 10 caracteres, con letras y números.</CardDescription>
      </CardHeader>
      <CardContent>
        {forced && (
          <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            Estás usando una contraseña temporal. Cámbiala para continuar.
          </p>
        )}
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="current">Contraseña actual</Label>
            <Input id="current" name="current" type="password" required autoComplete="current-password" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="next">Nueva contraseña</Label>
            <Input id="next" name="next" type="password" required minLength={10} autoComplete="new-password" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm">Repite la nueva contraseña</Label>
            <Input id="confirm" name="confirm" type="password" required minLength={10} autoComplete="new-password" />
          </div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          {done && !forced && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Contraseña actualizada.</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Actualizar contraseña"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
