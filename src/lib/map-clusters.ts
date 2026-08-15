import Supercluster from "supercluster";
import type { EventListItem } from "@/lib/events";

export type MapPointProps = {
  eventId: string;
};

export type ClusterIndex = Supercluster<MapPointProps, Supercluster.AnyProps>;

export function buildClusterIndex(events: EventListItem[]): ClusterIndex {
  const index = new Supercluster<MapPointProps>({
    radius: 56,
    maxZoom: 14,
    minPoints: 3,
  });
  const features: Supercluster.PointFeature<MapPointProps>[] = [];
  for (const event of events) {
    const lat = event.location?.lat;
    const lng = event.location?.lng;
    if (lat == null || lng == null) continue;
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) continue;
    features.push({
      type: "Feature",
      properties: { eventId: event.id },
      geometry: {
        type: "Point",
        coordinates: [Number(lng), Number(lat)],
      },
    });
  }
  index.load(features);
  return index;
}
