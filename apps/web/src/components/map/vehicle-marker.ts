/** Elemento HTML para el marcador de un vehículo: punto con flecha de rumbo. */
export function createVehicleMarkerElement(color: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "vehicle-marker";
  el.style.cssText = "width:34px;height:34px;cursor:pointer;filter:drop-shadow(0 3px 6px rgba(46,16,101,.35));";
  el.innerHTML = `
    <svg viewBox="0 0 34 34" width="34" height="34" style="transition:transform .6s ease">
      <circle cx="17" cy="17" r="13" fill="${color}" stroke="white" stroke-width="3"/>
      <path d="M17 8.5 L22.5 22 L17 18.6 L11.5 22 Z" fill="white"/>
    </svg>`;
  return el;
}

export function setMarkerCourse(el: HTMLElement, course: number | null) {
  const svg = el.querySelector("svg");
  if (svg) svg.style.transform = `rotate(${course ?? 0}deg)`;
}
