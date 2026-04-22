const WIKIPEDIA_API = "https://en.wikipedia.org/api/rest_v1";
const cache = new Map();

function extractTitle(tag) {
  if (!tag) return null;
  const parts = tag.split(":");
  return parts.length > 1 ? parts.slice(1).join(":") : tag;
}

export async function getWikipediaContent(wikipediaTag) {
  if (!wikipediaTag) return null;
  if (cache.has(wikipediaTag)) return cache.get(wikipediaTag);

  const title = extractTitle(wikipediaTag);
  if (!title) return null;

  try {
    const encoded = encodeURIComponent(title.replace(/ /g, "_"));
    const res = await fetch(`${WIKIPEDIA_API}/page/summary/${encoded}`, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return null;
    const data = await res.json();

    const result = {
      title: data.title || title,
      extract: data.extract || null,
      thumbnail: data.thumbnail?.source || null,
      url: data.content_urls?.desktop?.page || null,
    };

    cache.set(wikipediaTag, result);
    return result;
  } catch {
    return null;
  }
}
