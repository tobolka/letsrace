export type Point = { x: number; y: number };
export type LatLng = { lat: number; lng: number };
export interface Bounds {
  getWest(): number; getSouth(): number; getEast(): number; getNorth(): number;
  contains(point: [number, number]): boolean;
}
export interface Layer {
  addTo(target: LeafletMap | LayerGroup): this;
  remove(): this;
}
export interface LayerGroup extends Layer { clearLayers(): this }
export interface LeafletMap {
  on(event: string, callback: () => void): this;
  off(event: string, callback: () => void): this;
  setView(point: [number, number], zoom: number, options?: object): this;
  fitBounds(bounds: [[number, number], [number, number]], options?: object): this;
  panInside(point: [number, number], options?: object): this;
  getBounds(): Bounds;
  getZoom(): number;
  getSize(): Point;
  latLngToContainerPoint(point: [number, number]): Point;
  containerPointToLatLng(point: [number, number]): LatLng;
  invalidateSize(options?: object): this;
  zoomIn(): this; zoomOut(): this;
  createPane(name: string): HTMLElement;
  remove(): void;
  attributionControl: { setPrefix(value: string | false): void };
}
export interface Marker extends Layer {
  on(event: string, callback: () => void): this;
  bindTooltip(content: HTMLElement, options?: object): this;
  getElement(): HTMLElement | undefined;
}
export interface LeafletApi {
  map(container: HTMLElement, options: object): LeafletMap;
  tileLayer(url: string, options: object): Layer & { on(event: string, callback: () => void): void };
  layerGroup(): LayerGroup;
  marker(point: [number, number], options: object): Marker;
  divIcon(options: object): object;
}

let pending: Promise<LeafletApi> | undefined;
export function loadLeaflet(): Promise<LeafletApi> {
  const existing = (window as Window & { L?: LeafletApi }).L;
  if (existing) return Promise.resolve(existing);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/prototypes/fast-map/leaflet/leaflet.css";
    document.head.append(css);
    const script = document.createElement("script");
    script.src = "/prototypes/fast-map/leaflet/leaflet.js";
    script.onload = () => {
      const api = (window as Window & { L?: LeafletApi }).L;
      if (api) resolve(api);
      else reject(new Error("Leaflet did not initialize"));
    };
    script.onerror = () => { pending = undefined; reject(new Error("Map library could not load")); };
    document.head.append(script);
  });
  return pending;
}
