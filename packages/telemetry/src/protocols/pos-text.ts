import { decodeTcpTextLine, encodeTcpTextLine } from "../decoders/tcp-text";
import { encodeTcpCommand, parseTcpCommandAck } from "../commands";
import type { DecodeResult, ProtocolHandler } from "./types";
import { splitByDelimiter } from "./util";

/** Protocolo de texto propio de Octopus Track ($POS / $CMD / $CMDACK). */
export const posText: ProtocolHandler = {
  id: "tcp-text",
  detect: (b) => b.toString("latin1", 0, 4) === "$POS" || b.toString("latin1", 0, 7) === "$CMDACK",
  frame: (buffer) => splitByDelimiter(buffer, "\n"),

  decode(frame): DecodeResult {
    const line = frame.toString("latin1").trim();
    const ack = parseTcpCommandAck(line);
    if (ack) return { positions: [], commandResponse: { ok: ack.ok, text: ack.message, commandId: ack.id } };
    const e = decodeTcpTextLine(line);
    const { imei, source: _s, ...raw } = e;
    return { identify: imei, positions: [raw], reply: Buffer.from(`$ACK,${imei}\r\n`) };
  },

  encodeCommand(type, params, ctx) {
    return Buffer.from(encodeTcpCommand(ctx.commandId, type, params) + "\r\n");
  },
};

export { encodeTcpTextLine };
