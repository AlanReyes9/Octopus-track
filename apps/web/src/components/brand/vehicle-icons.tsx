import {
  Ambulance,
  Bike,
  Bus,
  Car,
  CarFront,
  CarTaxiFront,
  Caravan,
  Forklift,
  Package,
  PersonStanding,
  Ship,
  Smartphone,
  Tractor,
  Truck,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";

/** Moto: icono propio del proyecto (estilo de trazo compatible con Lucide). */
function Motorcycle(props: LucideProps) {
  const { size = 24, strokeWidth = 2, className, ...rest } = props;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...(rest as object)}
    >
      <circle cx="5" cy="16.5" r="3" />
      <circle cx="19" cy="16.5" r="3" />
      <path d="M5 16.5 9 11h5.5l4.5 5.5" />
      <path d="M14.5 11 13 7h3.5" />
      <path d="M9 11 7.5 8.5H5" />
    </svg>
  );
}

export const VEHICLE_ICONS: { id: string; label: string; Icon: ComponentType<LucideProps> }[] = [
  { id: "car", label: "Auto", Icon: Car },
  { id: "pickup", label: "Camioneta", Icon: CarFront },
  { id: "taxi", label: "Taxi", Icon: CarTaxiFront },
  { id: "truck", label: "Camión", Icon: Truck },
  { id: "bus", label: "Autobús", Icon: Bus },
  { id: "moto", label: "Moto", Icon: Motorcycle },
  { id: "bike", label: "Bicicleta", Icon: Bike },
  { id: "ambulance", label: "Ambulancia", Icon: Ambulance },
  { id: "tractor", label: "Tractor", Icon: Tractor },
  { id: "forklift", label: "Montacargas", Icon: Forklift },
  { id: "trailer", label: "Remolque", Icon: Caravan },
  { id: "boat", label: "Embarcación", Icon: Ship },
  { id: "asset", label: "Carga / activo", Icon: Package },
  { id: "person", label: "Persona", Icon: PersonStanding },
  { id: "phone", label: "Teléfono", Icon: Smartphone },
];


export function VehicleIcon({ icon, ...props }: { icon: string | null | undefined } & LucideProps) {
  const Icon = VEHICLE_ICONS.find((i) => i.id === icon)?.Icon ?? Car;
  return <Icon {...props} />;
}
