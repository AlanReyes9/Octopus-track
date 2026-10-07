import type { CommandType } from "../commands";

export type ProtocolTransport = "tcp" | "http" | "browser" | "gateway";

export interface ProtocolInfo {
  id: string;
  name: string;
  /** Marcas / modelos típicos. */
  devices: string;
  transport: ProtocolTransport;
  /** true = decodificado directamente por Octopus Track. */
  native: boolean;
  /** Comandos remotos que Octopus Track sabe enviar con este protocolo. */
  commands: CommandType[];
}

const ALL_TCP: CommandType[] = ["requestPosition", "setInterval", "engineStop", "engineResume", "reboot", "custom"];

/** Protocolos con decodificador propio (conexión directa al servicio de ingesta). */
export const NATIVE_PROTOCOLS: ProtocolInfo[] = [
  { id: "gt06", name: "GT06 / Concox", devices: "Concox GT06N, Jimi JM01/JM-VL, WeTrack, TK100 y clones", transport: "tcp", native: true, commands: ALL_TCP },
  { id: "teltonika", name: "Teltonika (Codec 8 / 8E)", devices: "Teltonika FMB, FMC, FMM, FMT", transport: "tcp", native: true, commands: ["requestPosition", "engineStop", "engineResume", "reboot", "custom"] },
  { id: "tk103", name: "TK103", devices: "Xexun TK103, Tkstar, clones TK103 (formato con paréntesis)", transport: "tcp", native: true, commands: ["custom"] },
  { id: "gps103", name: "GPS103 / Coban", devices: "Coban TK103A/B, TK102B, TK104, GPS303, GPS306", transport: "tcp", native: true, commands: ["requestPosition", "setInterval", "engineStop", "engineResume", "custom"] },
  { id: "h02", name: "H02", devices: "Sinotrack ST-901/ST-906, Huabao y clones H02 (modo texto)", transport: "tcp", native: true, commands: ["custom"] },
  { id: "meitrack", name: "Meitrack", devices: "Meitrack MVT100/340/380/600, T1, T333, T366", transport: "tcp", native: true, commands: ["custom"] },
  { id: "tcp-text", name: "Octopus $POS", devices: "Firmware propio / integraciones", transport: "tcp", native: true, commands: [...ALL_TCP, "message"] },
  { id: "osmand", name: "HTTP OsmAnd", devices: "Apps móviles de rastreo con protocolo OsmAnd", transport: "http", native: true, commands: [] },
  { id: "phone", name: "Teléfono (navegador)", devices: "Android e iPhone con consentimiento", transport: "browser", native: true, commands: ["requestPosition", "message"] },
  { id: "gateway", name: "Gateway HTTP JSON", devices: "Cualquier equipo decodificado por un servidor de protocolos externo", transport: "gateway", native: true, commands: [...ALL_TCP, "message"] },
];

/**
 * Familias habituales que se integran mediante un servidor de protocolos de
 * código abierto que reenvía las posiciones a /api/ingest/gateway
 * (ver deploy/protocol-gateway). Lista orientativa, no exhaustiva.
 */
export const GATEWAY_PROTOCOLS: ProtocolInfo[] = [
  ["queclink", "Queclink", "GV55, GV300, GL300, GL320"],
  ["suntech", "Suntech", "ST300, ST310U, ST340, ST4300"],
  ["calamp", "CalAmp", "LMU-1200, LMU-2630, LMU-3030"],
  ["ruptela", "Ruptela", "FM-Eco4, FM-Pro4, Trace5"],
  ["galileosky", "Galileosky", "Base Block, 7.0"],
  ["wialon", "Wialon IPS", "Equipos con protocolo Wialon IPS"],
  ["jt808", "JT/T 808", "Rastreadores y dashcams con estándar JT808"],
  ["atrack", "ATrack", "AK11, AX7, AY5"],
  ["cellocator", "Pointer Cellocator", "CelloTrack, Cello-IQ"],
  ["topflytech", "Topflytech", "T8806, TLW1, TLD1"],
  ["navtelecom", "Navtelecom", "Signal S-2551, S-2651"],
  ["eelink", "Eelink", "TK116, TK419, GPT26"],
  ["castel", "Castel / Sinocastel", "IDD-213, CC830"],
  ["meiligao", "Meiligao", "VT300, VT310, VT400"],
  ["xirgo", "Xirgo", "XT-2000, XT-4700"],
  ["gosafe", "GoSafe", "G6S, G737"],
  ["skypatrol", "Skypatrol", "TT8750"],
  ["enfora", "Enfora", "MT4000, Spider MT4100"],
  ["aplicom", "Aplicom", "A9, A11"],
  ["dmt", "Digital Matter", "Oyster, Yabby, Dart"],
  ["globalsat", "GlobalSat", "TR-151, TR-206, GTR-128"],
  ["totem", "Totem", "AT03, AT07, AT09"],
  ["bce", "BCE", "FM-Light, FM-Blue"],
  ["autofon", "Autofon", "Alfa, Delta"],
  ["tramigo", "Tramigo", "T22, T23"],
].map(([id, name, devices]) => ({
  id: id!,
  name: name!,
  devices: devices!,
  transport: "gateway" as const,
  native: false,
  // Se reenvían al servidor de protocolos (COMMANDS_WEBHOOK_URL), que los traduce.
  commands: ALL_TCP,
}));

export const ALL_PROTOCOLS: ProtocolInfo[] = [...NATIVE_PROTOCOLS, ...GATEWAY_PROTOCOLS];

export function getProtocol(id: string | null | undefined): ProtocolInfo | undefined {
  return ALL_PROTOCOLS.find((p) => p.id === id);
}

/** Protocolos cuyos comandos entrega el servicio de ingesta TCP. */
export const isTcpNative = (id: string) => NATIVE_PROTOCOLS.some((p) => p.id === id && p.transport === "tcp");
