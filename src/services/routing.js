const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1";

function mapProfile(travelMode) {
  switch (travelMode) {
    case "cycle": case "cycling": case "bike": case "bicycle": return "cycling";
    case "drive": case "driving": return "driving";
    default: return "walking";
  }
}

export async function getDirectRoute(start, end, travelMode = "walk") {
  if (start?.lat == null || start?.lng == null || end?.lat == null || end?.lng == null) {
    throw new Error("Invalid coordinates");
  }

  const profile = mapProfile(travelMode);
  const coords = `${start.lng},${start.lat};${end.lng},${end.lat}`;
  const url = `${OSRM_BASE_URL}/${profile}/${coords}?overview=full&geometries=geojson&steps=false`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Routing failed: ${res.status}`);

  const data = await res.json();
  if (data.code !== "Ok") throw new Error(`Routing error: ${data.code}`);

  const route = data.routes[0];
  return {
    geometry: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    summary: { distance: route.distance, duration: route.duration },
    start,
    end,
  };
}
