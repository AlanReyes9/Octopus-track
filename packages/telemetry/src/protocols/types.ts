import type { RawTelemetry } from "../normalize";

/** Resultado de decodificar una trama completa. */
export interface DecodeResult {
  /** Identificador del equipo si la trama lo trae (login/IMEI). */
  identify?: string;
  /** Posiciones extraídas (sin `imei`: lo completa la sesión). */
  positions: Omit<RawTelemetry, "imei">[];
  /** Respuesta que el servidor debe enviar al equipo (ACK). */
  reply?: Buffer;
  /** Respuesta del equipo a un comando previo. */
  commandResponse?: { ok: boolean; text: string | null; ref?: number; commandId?: string };
}

export interface CommandContext {
  imei: string;
  /** UUID del comando en la cola. */
  commandId: string;
  /** Referencia numérica para correlacionar la respuesta (si el protocolo lo permite). */
  ref: number;
}

/**
 * Decodificador de un protocolo binario o de texto sobre TCP. Código puro:
 * no abre sockets ni toca la base de datos.
 */
export interface ProtocolHandler {
  id: string;
  /** ¿Los primeros bytes de la conexión pertenecen a este protocolo? */
  detect(first: Buffer): boolean;
  /** Separa el flujo en tramas completas; devuelve el resto sin procesar. */
  frame(buffer: Buffer): { frames: Buffer[]; rest: Buffer };
  decode(frame: Buffer, session: { imei?: string }): DecodeResult;
  /** Codifica un comando remoto, o null si no está soportado. */
  encodeCommand?(type: string, params: Record<string, unknown>, ctx: CommandContext): Buffer | null;
}
