const OPTIMIZED_HOSTS = new Set(["i.discogs.com", "img.discogs.com", "st.discogs.com"]);

export function canOptimizeImage(url: string): boolean {
  try {
    return OPTIMIZED_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}
