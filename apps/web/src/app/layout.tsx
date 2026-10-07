import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Octopus Track — Rastreo GPS en tiempo real", template: "%s · Octopus Track" },
  description:
    "Plataforma de monitoreo de flotas y teléfonos en tiempo real: mapa en vivo, historial de rutas, geocercas y comandos remotos.",
  applicationName: "Octopus Track",
  appleWebApp: { capable: true, title: "Octopus Track", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#6d28d9" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
