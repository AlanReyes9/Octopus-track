import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Octopus Track — Rastreo GPS de flotas",
  description: "Plataforma SaaS multi-empresa de monitoreo GPS en tiempo real",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
