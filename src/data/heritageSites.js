import { siteDescriptions } from "./siteDescriptions";

let _cache = null;

export async function loadHeritageSites() {
  if (_cache) return _cache;

  const files = [
    "/parks.geojson",
    "/memorials.geojson",
    "/churches.geojson",
    "/listed.geojson",
  ];

  const results = await Promise.all(
    files.map((f) =>
      fetch(f).then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch ${f}: ${r.status}`);
        return r.json();
      })
    )
  );

  let id = 1;
  const sites = [];

  results.forEach((geojson) => {
    geojson.features.forEach((feature) => {
      const props = feature.properties || {};
      const [lng, lat] = feature.geometry.coordinates;
      const name = props.name || "Unnamed site";

      // Look up static description by name
      const staticData = siteDescriptions[name] || {};

      sites.push({
        id: id++,
        name,
        category: props.category || "heritage",
        lat,
        lng,
        wikipedia: props.wikipedia || null,
        wikidata: props.wikidata || null,
        // Static description — written to match walker tone
        enrichedDescription: staticData.description || null,
        // Image: prefer hardcoded override, then wikipedia_image from GeoJSON
        image: staticData.image || props.image || props.wikipedia_image || null,
        // Wikipedia URL — populated by enrichment script or manually
        wikipediaUrl: props.wikipedia_url || null,
        // Period label
        period:
          props.category === "park" ? "Green space"
          : props.category === "memorial" ? "Memorial"
          : props.category === "church" ? "Place of worship"
          : props.category === "listed" ? "Grade I listed"
          : "Heritage site",
        // Route building
        cueWeight: props.category === "park" ? 3 : 2,
        adventure: props.category === "memorial" || props.category === "church",
      });
    });
  });

  _cache = sites;
  return sites;
}

export const heritageSites = [];
