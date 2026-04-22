import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

// Renders the user's position as a navigation chevron/arrow on the map.
// Much more distinctive than the default Mapbox dot, clearly the most prominent
// element on the map during navigation.
// heading: compass degrees (0 = north, 90 = east etc.)
export default function UserLocationMarker({ map, mapReady, userCoords, heading = null }) {
  const markerRef = useRef(null);

  useEffect(() => {
    if (!map || !mapReady) return;
    return () => {
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null; }
    };
  }, [map, mapReady]);

  useEffect(() => {
    if (!map || !mapReady || !userCoords) return;

    if (markerRef.current) {
      markerRef.current.setLngLat([userCoords.lng, userCoords.lat]);
      // Update chevron rotation if heading changes
      const el = markerRef.current.getElement();
      const chevron = el.querySelector(".nav-chevron");
      if (chevron && heading != null) {
        chevron.style.transform = `rotate(${heading}deg)`;
      }
      return;
    }

    // Build marker element
    const el = document.createElement("div");
    el.style.cssText = `
      width: 44px;
      height: 44px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Outer pulse ring
    const pulse = document.createElement("div");
    pulse.style.cssText = `
      position: absolute;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      animation: locationPulse 2s ease-out infinite;
    `;

    // Chevron SVG — white with dark outline, clearly visible on any map background
    const chevron = document.createElement("div");
    chevron.className = "nav-chevron";
    chevron.style.cssText = `
      width: 32px;
      height: 32px;
      position: relative;
      z-index: 2;
      transition: transform 0.3s ease;
      ${heading != null ? `transform: rotate(${heading}deg)` : ""}
    `;

    chevron.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="15" fill="#2a1f14" stroke="white" stroke-width="2"/>
        <path d="M16 7 L22 23 L16 19 L10 23 Z" fill="white"/>
      </svg>
    `;

    el.appendChild(pulse);
    el.appendChild(chevron);

    markerRef.current = new mapboxgl.Marker({
      element: el,
      anchor: "center",
      rotationAlignment: "map",
    })
      .setLngLat([userCoords.lng, userCoords.lat])
      .addTo(map);
  }, [map, mapReady, userCoords]);

  // Update position smoothly
  useEffect(() => {
    if (!markerRef.current || !userCoords) return;
    markerRef.current.setLngLat([userCoords.lng, userCoords.lat]);
  }, [userCoords]);

  // Update heading
  useEffect(() => {
    if (!markerRef.current || heading == null) return;
    const el = markerRef.current.getElement();
    const chevron = el.querySelector(".nav-chevron");
    if (chevron) chevron.style.transform = `rotate(${heading}deg)`;
  }, [heading]);

  return null;
}
