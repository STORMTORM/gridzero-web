/**
 * Extract latitude/longitude from a Google Maps URL (full or short-link after redirect).
 */

export function isGoogleMapsUrl(text: string): boolean {
  return (
    /^https?:\/\/\S+/i.test(text) &&
    /(google\.[a-z.]+\/maps|maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl)/i.test(text)
  );
}

export function isShortMapsUrl(text: string): boolean {
  return /(goo\.gl\/maps\/\S+|maps\.app\.goo\.gl\/\S+)/i.test(text);
}

export function coordsFromMapsUrl(
  url: string
): { latitude: number; longitude: number } | null {
  if (!url) return null;
  const ok = (a: string, b: string) => {
    const lat = parseFloat(a);
    const lng = parseFloat(b);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)
      return null;
    return { latitude: lat, longitude: lng };
  };
  const patterns = [
    /!3d(-?\d{1,3}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /@(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /[?&](?:q|query|ll|center|destination|daddr)=(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/i,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) {
      const c = ok(m[1], m[2]);
      if (c) return c;
    }
  }
  return null;
}

export function coordsFromIncomingUrl(
  url: string
): { latitude: number; longitude: number } | null {
  if (!url) return null;
  return coordsFromMapsUrl(url);
}

export async function resolveMapUrl(
  url: string
): Promise<{ latitude: number; longitude: number } | null> {
  let coords = coordsFromIncomingUrl(url);
  if (coords) return coords;

  if (isShortMapsUrl(url)) {
    try {
      const res = await fetch(url, { redirect: "follow" });
      coords = coordsFromMapsUrl(res.url || "");
      if (coords) return coords;
    } catch { /* redirect failed */ }
  }

  return null;
}

export function isMapUrl(url: string): boolean {
  if (!url) return false;
  if (isGoogleMapsUrl(url)) return true;
  if (isShortMapsUrl(url)) return true;
  return false;
}
