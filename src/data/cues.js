// Spatial cue categories
export const cueCategories = [
  { key: "tree",     label: "Trees",                color: "#508e76" },
  { key: "bench",    label: "Benches",              color: "#8f7157" },
  { key: "signal",   label: "Pedestrian crossings", color: "#4d4058" },
  { key: "bus_stop", label: "Bus stops",            color: "#4A5D6A" },
];

let _cueCache = null;

export async function loadCues() {
  if (_cueCache) return _cueCache;

  const base = import.meta.env.BASE_URL;
  const files = [
    { file: `${base}trees.geojson`,     type: "tree",     label: "Tree cover" },
    { file: `${base}benches.geojson`,   type: "bench",    label: "Rest point" },
    { file: `${base}signals.geojson`,   type: "signal",   label: "Crossing" },
    { file: `${base}bus_stops.geojson`, type: "bus_stop", label: "Bus stop" },
  ];

  const results = await Promise.all(
    files.map(({ file }) => fetch(file).then((r) => r.json()))
  );

  let id = 1;
  const allCues = [];

  results.forEach((geojson, i) => {
    const { type, label } = files[i];
    geojson.features.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      allCues.push({
        id: `${type}-${id++}`,
        type,
        label,
        lat,
        lng,
      });
    });
  });

  _cueCache = allCues;
  return allCues;
}

// Empty synchronous export — real data comes from loadCues()
export const cues = [];