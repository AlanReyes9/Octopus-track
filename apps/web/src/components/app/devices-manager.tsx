"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/fetcher";
import { isOnline, timeAgo } from "@/lib/utils";

interface DeviceRow {
  id: string;
  imei: string;
  name: string;
  protocol: string;
  phone: string | null;
  lastSeenAt: string | null;
  vehicleName: string | null;
}

const PROTOCOLS = [
  { value: "traccar", label: "Traccar (forwarder)" },
  { value: "osmand", label: "OsmAnd / Traccar Client" },
  { value: "tcp-text", label: "TCP texto ($POS)" },
];

export function DevicesManager({ initial, canManage }: { initial: DeviceRow[]; canManage: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setPending(true);
    setError(null);
    try {
      await api("/api/devices", { method: "POST", json: Object.fromEntries(new FormData(form)) });
      form.reset();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("¿Eliminar el dispositivo y todo su historial de posiciones?")) return;
    try {
      await api(`/api/devices/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[1fr_340px]">
      <Card className="py-2">
        <CardContent className="px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>IMEI</TableHead>
                <TableHead>Protocolo</TableHead>
                <TableHead>Vehículo</TableHead>
                <TableHead>Última señal</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {initial.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No hay dispositivos registrados.
                  </TableCell>
                </TableRow>
              )}
              {initial.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="font-mono text-xs">{d.imei}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{d.protocol}</Badge>
                  </TableCell>
                  <TableCell>{d.vehicleName ?? <span className="text-muted-foreground">Sin asignar</span>}</TableCell>
                  <TableCell>
                    <Badge variant={isOnline(d.lastSeenAt) ? "success" : "secondary"}>{timeAgo(d.lastSeenAt)}</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => onDelete(d.id)} title="Eliminar">
                        <Trash2 className="text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canManage && (
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Nuevo dispositivo</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="imei">IMEI / Identificador</Label>
                <Input id="imei" name="imei" required pattern="[A-Za-z0-9_\-]{1,32}" placeholder="356938035643809" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" name="name" required placeholder="GPS Camión 04" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="protocol">Protocolo de ingesta</Label>
                <NativeSelect id="protocol" name="protocol" defaultValue="traccar">
                  {PROTOCOLS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">SIM / Teléfono (opcional)</Label>
                <Input id="phone" name="phone" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Registrar dispositivo"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
