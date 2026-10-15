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
  getBoundsZoom(bounds: [[number, number], [number, number]], inside?: boolean, padding?: [number, number]): number;
  getSize(): Point;
  project(point: [number, number], zoom: number): Point;
  unproject(point: [number, number], zoom: number): LatLng;
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
  const styles = new Promise<void>((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/maps/light-v1/leaflet.css";
    css.onload = () => resolve();
    css.onerror = () => { css.remove(); reject(new Error("Map styles could not load")); };
    document.head.append(css);
  });
  const library = new Promise<LeafletApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/maps/light-v1/leaflet.js";
    script.onload = () => {
      const api = (window as Window & { L?: LeafletApi }).L;
      if (api) resolve(api);
      else reject(new Error("Leaflet did not initialize"));
    };
    script.onerror = () => { script.remove(); reject(new Error("Map library could not load")); };
    document.head.append(script);
  });
  pending = Promise.all([library, styles]).then(([api]) => api).catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
