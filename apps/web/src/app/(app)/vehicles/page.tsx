import { redirect } from "next/navigation";

/** Las unidades se gestionan junto con su dispositivo. */
export default function VehiclesPage() {
  redirect("/devices");
}
