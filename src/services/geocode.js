// Mapbox Geocoding API — much better UK address support than Nominatim.
// Uses the existing VITE_MAPBOX_TOKEN, no extra setup needed.

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export async function searchAddress(query) {
  if (!query || query.trim().length < 2) return [];
  if (!MAPBOX_TOKEN) return [];

  try {
    const encoded = encodeURIComponent(query.trim());
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json` +
      `?access_token=${MAPBOX_TOKEN}` +
      `&country=GB` +
      `&proximity=-0.131,51.52` +
      `&bbox=-0.21,51.48,-0.08,51.57` +
      `&limit=5` +
      `&types=address,poi,neighborhood,locality,place`;

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);

    const data = await res.json();

    return (data.features || []).map((f) => {
      const shortName = f.address ? `${f.address} ${f.text}` : f.text;
      return {
        shortName,
        displayName: f.place_name,
        lat: f.center[1],
        lng: f.center[0],
      };
    });
  } catch (err) {
    console.error("Geocoding error:", err);
    return [];
  }
}

export async function geocodePlace(query) {
  const results = await searchAddress(query);
  if (!results.length) throw new Error(`No result for: ${query}`);
  return {
    name: results[0].shortName,
    lat: results[0].lat,
    lng: results[0].lng,
    displayName: results[0].displayName,
  };
}
