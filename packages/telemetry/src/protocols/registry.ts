import { gps103 } from "./gps103";
import { gt06 } from "./gt06";
import { h02 } from "./h02";
import { meitrack } from "./meitrack";
import { posText } from "./pos-text";
import { teltonika } from "./teltonika";
import { tk103 } from "./tk103";
import type { ProtocolHandler } from "./types";

/** Decodificadores TCP nativos, en orden de detección. */
export const TCP_HANDLERS: ProtocolHandler[] = [gt06, teltonika, tk103, gps103, h02, meitrack, posText];

export function handlerById(id: string): ProtocolHandler | undefined {
  return TCP_HANDLERS.find((h) => h.id === id);
}

/** Identifica el protocolo por los primeros bytes que envía el equipo. */
export function detectProtocol(first: Buffer): ProtocolHandler | null {
  return TCP_HANDLERS.find((h) => h.detect(first)) ?? null;
}
