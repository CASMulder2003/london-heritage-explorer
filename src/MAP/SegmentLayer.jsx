import { useEffect, useMemo } from "react";

function splitRouteBySteps(routeCoordinates = [], narrativeSteps = []) {
  if (!routeCoordinates.length || !narrativeSteps.length) return [];
  const total = narrativeSteps.length;
  const segs = routeCoordinates.length - 1;
  if (segs <= 0) return [];

  return narrativeSteps.map((step, i) => {
    const start = Math.floor((i / total) * segs);
    const end = i === total - 1 ? routeCoordinates.length : Math.floor(((i + 1) / total) * segs) + 1;
    return { ...step, coordinates: routeCoordinates.slice(start, Math.max(end, start + 2)) };
  }).filter((s) => s.coordinates.length >= 2);
}

export default function SegmentLayer({ map, mapReady, currentRoute, narrativeSteps = [], selectedNarrativeStep }) {
  const steps = useMemo(() => splitRouteBySteps(currentRoute?.geometry?.coordinates || [], narrativeSteps), [currentRoute, narrativeSteps]);

  useEffect(() => {
    if (!map || !mapReady || !map.getSource("route")) return;

    steps.forEach((step) => {
      const lineId = `seg-line-${step.id}`;
      const haloId = `seg-halo-${step.id}`;
      const srcId = `seg-src-${step.id}`;
      const isActive = selectedNarrativeStep?.id === step.id;
      const color = "#5A7A8C";
      const width = isActive ? 12 : 8;
      const feature = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: step.coordinates } };

      if (!map.getSource(srcId)) {
        map.addSource(srcId, { type: "geojson", data: feature });
        map.addLayer({ id: haloId, type: "line", source: srcId, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": color, "line-width": width + 10, "line-opacity": isActive ? 0.18 : 0.08, "line-blur": 1.2 } });
        map.addLayer({ id: lineId, type: "line", source: srcId, layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": color, "line-width": width, "line-opacity": isActive ? 1 : 0.85 } });
      } else {
        map.getSource(srcId).setData(feature);
        if (map.getLayer(haloId)) { map.setPaintProperty(haloId, "line-width", width + 10); map.setPaintProperty(haloId, "line-opacity", isActive ? 0.18 : 0.08); }
        if (map.getLayer(lineId)) { map.setPaintProperty(lineId, "line-width", width); map.setPaintProperty(lineId, "line-opacity", isActive ? 1 : 0.85); }
      }
    });

    return () => {
      steps.forEach((step) => {
        if (map.getLayer(`seg-line-${step.id}`)) map.removeLayer(`seg-line-${step.id}`);
        if (map.getLayer(`seg-halo-${step.id}`)) map.removeLayer(`seg-halo-${step.id}`);
        if (map.getSource(`seg-src-${step.id}`)) map.removeSource(`seg-src-${step.id}`);
      });
    };
  }, [map, mapReady, steps, selectedNarrativeStep]);

  return null;
}
