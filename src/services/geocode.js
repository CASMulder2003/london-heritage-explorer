const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";

async function runGeocode(query) {
  const params = new URLSearchParams({
    q: query.trim(),
    format: "jsonv2",
    limit: "1",
    addressdetails: "1",
    countrycodes: "gb",
  });

  const url = `${NOMINATIM_BASE_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Geocoding failed: ${response.status} ${text}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`Fetch failed for geocoding query "${query}": ${error.message}`);
  }
}

function buildCandidateQueries(query) {
  const q = query.trim();

  const candidates = [
    q,
    `${q}, London`,
    `${q}, London, UK`,
  ];

  if (/^ucl\b/i.test(q) || /gower street/i.test(q)) {
    candidates.push(
      "University College London, Gower Street, London",
      "UCL Main Campus, Gower Street, London",
      "Gower Street, London WC1E"
    );
  }

  if (/camden/i.test(q)) {
    candidates.push(
      `${q}, Camden Town, London`,
      `${q}, Camden, London NW1`,
      "Camden Town, London"
    );
  }

  return [...new Set(candidates)];
}

export async function geocodePlace(query) {
  if (!query || !query.trim()) {
    throw new Error("Missing geocoding query");
  }

  const candidates = buildCandidateQueries(query);
  let lastError = null;

  for (const candidate of candidates) {
    try {
      const results = await runGeocode(candidate);

      if (Array.isArray(results) && results.length > 0) {
        const best = results[0];

        return {
          lat: Number(best.lat),
          lng: Number(best.lon),
          displayName: best.display_name,
          raw: best,
          matchedQuery: candidate,
        };
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(`No geocoding result for: ${query}`);
}