/**
 * Datos del responsable del servicio. Configúralos con variables de entorno
 * en Vercel; mientras falten se muestran marcadores visibles.
 */
export const LEGAL = {
  company: process.env.NEXT_PUBLIC_LEGAL_NAME || "[Razón social del responsable]",
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS || "[Domicilio fiscal]",
  email: process.env.NEXT_PUBLIC_LEGAL_EMAIL || "[correo de privacidad]",
  country: process.env.NEXT_PUBLIC_LEGAL_COUNTRY || "México",
  jurisdiction: process.env.NEXT_PUBLIC_LEGAL_JURISDICTION || "[ciudad y país de los tribunales competentes]",
  retentionDays: Number(process.env.NEXT_PUBLIC_RETENTION_DAYS || 180),
  updatedAt: "7 de octubre de 2026",
};

export const isLegalConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_LEGAL_NAME && process.env.NEXT_PUBLIC_LEGAL_EMAIL && process.env.NEXT_PUBLIC_LEGAL_ADDRESS);
