"use client";

import { Check, Copy, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Muestra el enlace de vinculación (solo se puede ver al crearlo o regenerarlo). */
export function PairingDialog({ url, name, onClose }: { url: string | null; name: string; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 240, margin: 1, color: { dark: "#2e1065", light: "#ffffff" } }).then(setQr);
    setCopied(false);
  }, [url]);

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  async function share() {
    if (!url || !navigator.share) return copy();
    await navigator.share({ title: "Octopus Track", text: `Enlace para compartir la ubicación de ${name}`, url }).catch(() => {});
  }

  return (
    <Dialog open={!!url} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular teléfono · {name}</DialogTitle>
          <DialogDescription>
            Envía este enlace a la persona que porta el teléfono. Al abrirlo verá qué empresa verá su ubicación y podrá
            aceptar o rechazar. Por seguridad, el enlace solo se muestra ahora.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          {qr && <img src={qr} alt="Código QR del enlace de vinculación" className="size-52 rounded-xl border p-2" />}
          <div className="w-full rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all">{url}</div>
          <div className="grid w-full grid-cols-2 gap-2">
            <Button variant="outline" onClick={copy}>
              {copied ? <Check /> : <Copy />} {copied ? "Copiado" : "Copiar enlace"}
            </Button>
            <Button onClick={share}>
              <Share2 /> Compartir
            </Button>
          </div>
          <ul className="w-full space-y-1 text-xs text-muted-foreground">
            <li>• Funciona en Android (Chrome) e iPhone (Safari) sin instalar aplicaciones.</li>
            <li>• La ubicación se envía mientras la página de seguimiento esté abierta; puede añadirse a la pantalla de inicio.</li>
            <li>• Si generas un enlace nuevo, el anterior y su consentimiento dejan de ser válidos.</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
