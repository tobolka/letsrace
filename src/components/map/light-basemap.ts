import { lightTileUrl } from "./light-tile-url";
import type { LeafletApi, LeafletMap, LayerGroup } from "./leaflet-runtime";

export type City = [name: string, lat: number, lng: number, population: number, capital: boolean];
let cityData: Promise<City[]> | undefined;
export function loadCities() {
  return cityData ??= fetch("/maps/light-v1/cities.json").then((r) => {
    if (!r.ok) throw new Error("City labels unavailable");
    return r.json() as Promise<City[]>;
  }).catch((e) => { cityData = undefined; throw e; });
}

export function addLightBasemap(L: LeafletApi, map: LeafletMap) {
  map.attributionControl.setPrefix(false);
  // Labels and race pins are separate DOM layers and stay sharp on phones.
  // Standard raster tiles avoid spending four pixels per background pixel.
  const tiles = L.tileLayer(lightTileUrl("{z}", "{x}", "{y}", window.matchMedia("(min-width: 768px)").matches && window.devicePixelRatio > 1), {
    tileSize: 256, maxZoom: 20, keepBuffer: 2,
    attribution: '&copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>, &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> · <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a>',
  });
  // Leaflet creates the centre tiles first. Give that visible pair priority
  // over offscreen images; all other tiles retain the browser's default.
  let started = 0;
  tiles.on("tileloadstart", ({ tile }) => {
    if (started++ < 2) tile.fetchPriority = "high";
  });
  tiles.addTo(map);
}

export function drawCityLabels(L: LeafletApi, map: LeafletMap, labels: LayerGroup, cities: City[], occupied: [number, number, number, number][] = []) {
  const bounds = map.getBounds();
  const zoom = map.getZoom();
  const threshold = zoom < 5.5 ? 600000 : zoom < 6.5 ? 180000 : zoom < 7.5 ? 70000 : zoom < 8.5 ? 30000 : 15000;
  let drawn = 0;
  const size = map.getSize();
  for (const [name, lat, lng, population, capital] of cities) {
    if (drawn >= 70 || (population < threshold && !capital) || !bounds.contains([lat, lng])) continue;
    const width = Math.min(name.length * 6.2 + 15, 160), p = map.latLngToContainerPoint([lat, lng]);
    const rect: [number, number, number, number] = [p.x - width / 2 - 10, p.y - 12, p.x + width / 2 + 10, p.y + 12];
    if (rect[0] < 0 || rect[2] > size.x || rect[1] < 0 || rect[3] > size.y) continue;
    if (occupied.some((r) => rect[0] < r[2] && rect[2] > r[0] && rect[1] < r[3] && rect[3] > r[1])) continue;
    occupied.push(rect); drawn++;
    const text = document.createElement("span"); text.className = `fast-city-label${capital || population >= 200000 ? " fast-city-major" : ""}`; text.textContent = name;
    L.marker([lat, lng], { pane: "city-labels", interactive: false, keyboard: false,
      icon: L.divIcon({ className: "fast-city", html: text, iconSize: [width, 20], iconAnchor: [width / 2, 10] }),
    }).addTo(labels);
  }
}
