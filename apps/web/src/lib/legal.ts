/**
 * Datos del responsable del servicio. Configúralos con variables de entorno
 * en Vercel; mientras falten se muestran marcadores visibles.
 */
export const LEGAL = {
  company: process.env.NEXT_PUBLIC_LEGAL_NAME || "[Razón social del responsable]",
  /** Vacío si el responsable no publica domicilio fiscal (ver isLegalConfigured). */
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "",
  email: process.env.NEXT_PUBLIC_LEGAL_EMAIL || "[correo de privacidad]",
  country: process.env.NEXT_PUBLIC_LEGAL_COUNTRY || "México",
  jurisdiction: process.env.NEXT_PUBLIC_LEGAL_JURISDICTION || "[ciudad y país de los tribunales competentes]",
  retentionDays: Number(process.env.NEXT_PUBLIC_RETENTION_DAYS || 180),
  updatedAt: "28 de octubre de 2026",
};

/** El domicilio es opcional: algunos responsables operan sin uno publicado. */
export const isLegalConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_LEGAL_NAME && process.env.NEXT_PUBLIC_LEGAL_EMAIL);
