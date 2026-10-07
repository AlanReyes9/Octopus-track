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

interface VehicleRow {
  id: string;
  name: string;
  plate: string | null;
  color: string;
  deviceId: string | null;
  deviceImei: string | null;
  lastSeenAt: string | null;
}
interface DeviceOption {
  id: string;
  name: string;
  imei: string;
  vehicleId: string | null;
}

export function VehiclesManager(props: { initial: VehicleRow[]; devices: DeviceOption[]; canManage: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const free = props.devices.filter((d) => !d.vehicleId);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setPending(true);
    setError(null);
    try {
      await api("/api/vehicles", {
        method: "POST",
        json: { name: data.name, plate: data.plate || null, color: data.color, deviceId: data.deviceId || null },
      });
      form.reset();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function assign(vehicleId: string, deviceId: string) {
    try {
      await api(`/api/vehicles/${vehicleId}`, { method: "PATCH", json: { deviceId: deviceId || null } });
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("¿Eliminar el vehículo? El dispositivo y su historial se conservan.")) return;
    await api(`/api/vehicles/${id}`, { method: "DELETE" }).catch((err) => alert(err.message));
    router.refresh();
  }

  return (
    <div className="grid gap-6 p-6 xl:grid-cols-[1fr_340px]">
      <Card className="py-2">
        <CardContent className="px-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehículo</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Estado</TableHead>
                {props.canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.initial.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No hay vehículos registrados.
                  </TableCell>
                </TableRow>
              )}
              {props.initial.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">
                    <span className="mr-2 inline-block size-3 rounded-full align-middle" style={{ background: v.color }} />
                    {v.name}
                  </TableCell>
                  <TableCell>{v.plate ?? "—"}</TableCell>
                  <TableCell>
                    {props.canManage ? (
                      <NativeSelect
                        className="h-8 w-56"
                        value={v.deviceId ?? ""}
                        onChange={(e) => assign(v.id, e.target.value)}
                      >
                        <option value="">Sin dispositivo</option>
                        {props.devices
                          .filter((d) => !d.vehicleId || d.vehicleId === v.id)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.imei})
                            </option>
                          ))}
                      </NativeSelect>
                    ) : (
                      <span className="font-mono text-xs">{v.deviceImei ?? "—"}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {v.deviceId ? (
                      <Badge variant={isOnline(v.lastSeenAt) ? "success" : "secondary"}>{timeAgo(v.lastSeenAt)}</Badge>
                    ) : (
                      <Badge variant="outline">Sin GPS</Badge>
                    )}
                  </TableCell>
                  {props.canManage && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => onDelete(v.id)} title="Eliminar">
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

      {props.canManage && (
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Nuevo vehículo</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" name="name" required placeholder="Camión 04" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="plate">Placa</Label>
                <Input id="plate" name="plate" placeholder="ABC-123" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="color">Color en el mapa</Label>
                <Input id="color" name="color" type="color" defaultValue="#2563eb" className="h-9 w-20 p-1" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="deviceId">Dispositivo GPS</Label>
                <NativeSelect id="deviceId" name="deviceId" defaultValue="">
                  <option value="">Sin dispositivo</option>
                  {free.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.imei})
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Crear vehículo"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
