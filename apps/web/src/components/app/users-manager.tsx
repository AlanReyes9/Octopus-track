"use client";

import { Check, Copy, KeyRound, Pencil, Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/fetcher";
import { cn } from "@/lib/utils";

type Role = "owner" | "admin" | "viewer";
interface UserRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  vehicleIds: string[];
}
interface VehicleOption {
  id: string;
  name: string;
  plate: string | null;
}

const ROLE: Record<Role, { label: string; variant: "default" | "secondary" | "outline" }> = {
  owner: { label: "Propietario", variant: "default" },
  admin: { label: "Administrador", variant: "secondary" },
  viewer: { label: "Cliente", variant: "outline" },
};

export function UsersManager(props: { users: UserRow[]; vehicles: VehicleOption[]; currentUserId: string; isOwner: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  async function resetPassword(u: UserRow) {
    if (!confirm(`¿Generar una contraseña temporal nueva para ${u.name}?`)) return;
    try {
      const { temporaryPassword } = await api<{ temporaryPassword: string }>(`/api/users/${u.id}/password`, { method: "POST" });
      setCredentials({ email: u.email, password: temporaryPassword });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function remove(u: UserRow) {
    if (!confirm(`¿Quitar el acceso de ${u.name}?`)) return;
    await api(`/api/users/${u.id}`, { method: "DELETE" }).catch((err) => alert(err.message));
    router.refresh();
  }

  const canEdit = (u: UserRow) =>
    u.id !== props.currentUserId && u.role !== "owner" && (u.role === "viewer" || props.isOwner);

  return (
    <div className="space-y-4 p-6">
      <div className="flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <UserPlus /> Nuevo usuario
        </Button>
      </div>
      <Card className="py-2">
        <CardContent className="px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Unidades visibles</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ROLE[u.role].variant}>{ROLE[u.role].label}</Badge>
                  </TableCell>
                  <TableCell className="max-w-64 truncate text-sm">
                    {u.role !== "viewer"
                      ? "Todas"
                      : u.vehicleIds.length === 0
                        ? <span className="text-muted-foreground">Ninguna asignada</span>
                        : props.vehicles.filter((v) => u.vehicleIds.includes(v.id)).map((v) => v.name).join(", ")}
                  </TableCell>
                  <TableCell>
                    {u.mustChangePassword ? <Badge variant="warning">Contraseña temporal</Badge> : <Badge variant="success">Activo</Badge>}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {canEdit(u) && (
                      <>
                        <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditing(u)}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon" title="Restablecer contraseña" onClick={() => resetPassword(u)}>
                          <KeyRound />
                        </Button>
                        <Button variant="ghost" size="icon" title="Quitar acceso" onClick={() => remove(u)}>
                          <Trash2 className="text-destructive" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing && (
        <UserDialog
          user={editing === "new" ? null : editing}
          vehicles={props.vehicles}
          isOwner={props.isOwner}
          onClose={() => setEditing(null)}
          onCreated={(c) => setCredentials(c)}
        />
      )}
      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}

function UserDialog(props: {
  user: UserRow | null;
  vehicles: VehicleOption[];
  isOwner: boolean;
  onClose: () => void;
  onCreated: (c: { email: string; password: string }) => void;
}) {
  const router = useRouter();
  const u = props.user;
  const [role, setRole] = useState<"viewer" | "admin">(u?.role === "admin" ? "admin" : "viewer");
  const [selected, setSelected] = useState<string[]>(u?.vehicleIds ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setPending(true);
    setError(null);
    try {
      if (u) {
        await api(`/api/users/${u.id}`, { method: "PATCH", json: { name: data.name, role, vehicleIds: selected } });
      } else {
        const res = await api<{ temporaryPassword: string }>("/api/users", {
          method: "POST",
          json: { name: data.name, email: data.email, role, vehicleIds: selected },
        });
        props.onCreated({ email: data.email!, password: res.temporaryPassword });
      }
      props.onClose();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{u ? "Editar usuario" : "Nuevo usuario"}</DialogTitle>
          <DialogDescription>
            {u ? u.email : "Se generará una contraseña temporal que deberá cambiar al iniciar sesión."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="u-name">Nombre</Label>
            <Input id="u-name" name="name" required minLength={2} defaultValue={u?.name} />
          </div>
          {!u && (
            <div className="grid gap-2">
              <Label htmlFor="u-email">Correo electrónico</Label>
              <Input id="u-email" name="email" type="email" required />
            </div>
          )}
          <div className="grid gap-2">
            <Label>Rol</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["viewer", "Cliente", "Solo consulta sus unidades"],
                  ["admin", "Administrador", "Gestiona equipos, usuarios y comandos"],
                ] as const
              ).map(([value, label, hint]) => (
                <button
                  type="button"
                  key={value}
                  disabled={value === "admin" && !props.isOwner}
                  onClick={() => setRole(value)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition disabled:opacity-40",
                    role === value ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500" : "hover:bg-muted",
                  )}
                >
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-xs text-muted-foreground">{hint}</div>
                </button>
              ))}
            </div>
          </div>
          {role === "viewer" && (
            <div className="grid gap-2">
              <Label>Unidades visibles</Label>
              <div className="max-h-48 space-y-1 overflow-auto rounded-xl border p-2">
                {props.vehicles.length === 0 && <p className="p-2 text-sm text-muted-foreground">No hay vehículos creados.</p>}
                {props.vehicles.map((v) => (
                  <label key={v.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                    <input type="checkbox" className="size-4 accent-violet-600" checked={selected.includes(v.id)} onChange={() => toggle(v.id)} />
                    {v.name}
                    {v.plate && <span className="text-xs text-muted-foreground">· {v.plate}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={props.onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : u ? "Guardar cambios" : "Crear usuario"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CredentialsDialog({ credentials, onClose }: { credentials: { email: string; password: string } | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = credentials
    ? `Acceso a Octopus Track\n${typeof window !== "undefined" ? window.location.origin : ""}/login\nUsuario: ${credentials.email}\nContraseña temporal: ${credentials.password}`
    : "";
  return (
    <Dialog open={!!credentials} onOpenChange={(o) => !o && (onClose(), setCopied(false))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Credenciales de acceso</DialogTitle>
          <DialogDescription>
            Compártelas por un canal seguro. La contraseña temporal solo se muestra ahora y deberá cambiarse al entrar.
          </DialogDescription>
        </DialogHeader>
        <pre className="rounded-xl bg-violet-950 p-4 text-sm whitespace-pre-wrap text-violet-50">{text}</pre>
        <Button
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
