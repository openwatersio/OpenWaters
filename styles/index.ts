import googleEarth from "@/styles/google-earth.json";
import openseamap from "@/styles/openseamap.json";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";

export default [
  {
    id: "openseamap",
    name: "OpenSeaMap",
    style: openseamap as unknown as StyleSpecification,
  },
  {
    id: "google-earth",
    name: "Google Earth",
    style: googleEarth as unknown as StyleSpecification,
  },
];
