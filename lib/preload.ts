const ROOM_TEXTURES = [
  "/room/ceiling.jpg",
  "/room/floor.jpg",
  "/room/daffodil-wallpaper.jpg",
] as const;

function loadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.decoding = "async";
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

export async function preloadWallAssets(coverUrls: string[], timeoutMs = 12000): Promise<void> {
  const uniqueCovers = [...new Set(coverUrls.filter(Boolean))];
  const jobs = [...ROOM_TEXTURES, ...uniqueCovers].map((src) => loadImage(src));

  await Promise.race([
    Promise.all(jobs),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, timeoutMs);
    }),
  ]);
}

export { ROOM_TEXTURES };
