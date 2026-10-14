import type { StyleSpecification } from "maplibre-gl";
import voyager from "./voyager-style.json";

/**
 * CARTO Voyager, vendored from its public vector style. Keep labels under our
 * control: raster tiles bake every place name into the image. Both maps share
 * this style so their label hierarchy stays consistent.
 */
export const MAP_STYLE: StyleSpecification = {
  ...(voyager as StyleSpecification),
  version: 8,
  sources: {
    carto: {
      ...voyager.sources.carto,
      type: "vector",
      // Ours to write, so ours to get right: these are the only links on the
      // page that were taking the map away with them.
      attribution:
        '&copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>, ' +
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    },
  },
  layers: (voyager as StyleSpecification).layers.map((layer) => {
    if (layer.type !== "symbol" || !layer.id.startsWith("place_")) return layer;

    const minzoom = {
      place_town: 9,
      place_villages: 11,
      place_hamlet: 13,
    }[layer.id];

    return {
      ...layer,
      ...(minzoom === undefined ? {} : { minzoom }),
      // Voyager's overview layer otherwise includes towns and villages too.
      ...(layer.id === "place_city_dot_z7"
        ? { filter: ["all", ["!has", "capital"], ["==", "class", "city"]] as typeof layer.filter }
        : {}),
      layout: { ...layer.layout, "text-padding": 12 },
    };
  }),
};
