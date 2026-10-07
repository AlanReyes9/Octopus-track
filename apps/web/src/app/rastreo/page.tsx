import type { Metadata } from "next";
import { PhoneTracker } from "@/components/phone/phone-tracker";

export const metadata: Metadata = {
  title: "Compartir ubicación",
  robots: { index: false, follow: false },
};

export default function TrackerPage() {
  return <PhoneTracker />;
}
