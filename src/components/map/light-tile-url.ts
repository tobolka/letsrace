const key = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim();

/** Shared by the HTML preload hints and the live raster layer. */
export function lightTileUrl(z: number | string, x: number | string, y: number | string, retina: boolean) {
  return `https://basemaps.cartocdn.com/rastertiles/voyager_nolabels/${z}/${x}/${y}${retina ? "@2x" : ""}.png${key ? `?key=${encodeURIComponent(key)}` : ""}`;
}
