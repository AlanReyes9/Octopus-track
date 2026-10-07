import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { VehicleIcon } from "@/components/brand/vehicle-icons";

/**
 * Marcador de unidad: círculo del color de la unidad con su icono y una
 * flecha exterior que indica el rumbo.
 */
export function createVehicleMarkerElement(color: string, icon = "car"): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "vehicle-marker";
  el.style.cssText = "width:40px;height:40px;cursor:pointer;position:relative;filter:drop-shadow(0 3px 6px rgba(46,16,101,.35));";
  el.innerHTML = `
    <div data-heading style="position:absolute;inset:-7px;transition:transform .6s ease">
      <svg viewBox="0 0 54 54" width="54" height="54"><path d="M27 0 L33 9 L21 9 Z" fill="${color}" stroke="white" stroke-width="1.5"/></svg>
    </div>
    <div style="position:absolute;inset:0;border-radius:9999px;background:${color};border:3px solid white;display:flex;align-items:center;justify-content:center;color:white"></div>`;
  const holder = el.lastElementChild as HTMLDivElement;
  createRoot(holder).render(createElement(VehicleIcon, { icon, size: 18, strokeWidth: 2.25 }));
  return el;
}

export function setMarkerCourse(el: HTMLElement, course: number | null) {
  const heading = el.querySelector<HTMLElement>("[data-heading]");
  if (!heading) return;
  heading.style.display = course === null ? "none" : "";
  heading.style.transform = `rotate(${course ?? 0}deg)`;
}
