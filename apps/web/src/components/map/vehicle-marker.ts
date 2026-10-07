/** Elemento HTML para el marcador de un vehículo: punto con flecha de rumbo. */
export function createVehicleMarkerElement(color: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "vehicle-marker";
  el.style.cssText = "width:30px;height:30px;cursor:pointer;";
  el.innerHTML = `
    <svg viewBox="0 0 30 30" width="30" height="30" style="transition:transform .6s ease">
      <circle cx="15" cy="15" r="11" fill="${color}" stroke="white" stroke-width="3"/>
      <path d="M15 7 L20 19 L15 16 L10 19 Z" fill="white"/>
    </svg>`;
  return el;
}

export function setMarkerCourse(el: HTMLElement, course: number | null) {
  const svg = el.querySelector("svg");
  if (svg) svg.style.transform = `rotate(${course ?? 0}deg)`;
}
