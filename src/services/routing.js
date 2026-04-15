const OSRM_BASE_URL = "https://router.project-osrm.org/route/v1";

function mapTravelModeToProfile(travelMode) {
  switch (travelMode) {
    case "walk":
    case "walking":
      return "walking";
    case "bike":
    case "bicycle":
    case "cycling":
      return "cycling";
    case "drive":
    case "driving":
      return "driving";
    default:
      return "walking";
  }
}

function decodeRouteGeometry(route) {
  if (!route?.geometry?.coordinates) return [];

  return route.geometry.coordinates.map(([lng, lat]) => ({
    lat,
    lng,
  }));
}

function normalizeRoute(osrmData, start, end) {
  const route = osrmData?.routes?.[0];

  if (!route) {
    throw new Error("No route returned from OSRM");
  }

  return {
    geometry: decodeRouteGeometry(route),
    stops: [],
    summary: {
      distance: route.distance,
      duration: route.duration,
    },
    start,
    end,
    raw: osrmData,
  };
}

export async function getDirectRoute(start, end, travelMode = "walking") {
  if (
    start?.lat == null ||
    start?.lng == null ||
    end?.lat == null ||
    end?.lng == null
  ) {
    throw new Error("Invalid start/end coordinates");
  }

  const profile = mapTravelModeToProfile(travelMode);
  const coordinates = `${start.lng},${start.lat};${end.lng},${end.lat}`;

  const params = new URLSearchParams({
    overview: "full",
    geometries: "geojson",
    steps: "false",
  });

  const url = `${OSRM_BASE_URL}/${profile}/${coordinates}?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Routing failed: ${response.status} ${text}`);
  }

  const data = await response.json();

  if (data.code !== "Ok") {
    throw new Error(`Routing error: ${data.code || "Unknown error"}`);
  }

  return normalizeRoute(data, start, end);
}