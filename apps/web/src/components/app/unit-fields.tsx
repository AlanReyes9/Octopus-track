"use client";

import { Check } from "lucide-react";
import { VEHICLE_ICONS } from "@/components/brand/vehicle-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const UNIT_COLORS = ["#7c3aed", "#db2777", "#0ea5e9", "#16a34a", "#f59e0b", "#dc2626", "#0f172a", "#64748b"];

/** Selector de icono y color de la unidad. */
export function IconColorPicker(props: {
  icon: string;
  color: string;
  onIcon: (icon: string) => void;
  onColor: (color: string) => void;
}) {
  return (
    <>
      <div className="grid gap-2">
        <Label>Icono</Label>
        <div className="grid grid-cols-5 gap-1.5">
          {VEHICLE_ICONS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              title={label}
              onClick={() => props.onIcon(id)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg border text-muted-foreground transition hover:bg-violet-50",
                props.icon === id && "border-transparent text-white shadow-sm",
              )}
              style={props.icon === id ? { background: props.color } : undefined}
            >
              <Icon className="size-5" />
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2">
        <Label>Color en el mapa</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {UNIT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => props.onColor(c)}
              className="flex size-7 items-center justify-center rounded-full ring-offset-2 transition hover:scale-110"
              style={{ background: c, boxShadow: props.color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined }}
              title={c}
            >
              {props.color === c && <Check className="size-3.5 text-white" />}
            </button>
          ))}
          <Input
            type="color"
            value={props.color}
            onChange={(e) => props.onColor(e.target.value)}
            className="h-7 w-10 cursor-pointer rounded-full p-0.5"
            title="Otro color"
          />
        </div>
      </div>
    </>
  );
}
