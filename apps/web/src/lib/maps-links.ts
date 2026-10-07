/**
 * Enlaces a aplicaciones de mapas mediante sus URL públicas documentadas
 * (no requieren API key ni incrustan contenido de terceros).
 * Google Maps URLs: https://developers.google.com/maps/documentation/urls/get-started
 */
export const googleMapsPlace = (lat: number, lng: number) =>
  `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(7)},${lng.toFixed(7)}`;

export const googleMapsDirections = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(7)},${lng.toFixed(7)}&travelmode=driving`;
