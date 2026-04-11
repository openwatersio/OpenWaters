import googleEarth from "@/styles/google-earth.json";
import noaaEcdis from "@/styles/noaa-ecdis.json";
import noaaPaper from "@/styles/noaa-paper.json";
import openseamap from "@/styles/openseamap.json";
import type { ChartSourceType } from "@/lib/chartSources";
import type { StyleSpecification } from "@maplibre/maplibre-react-native";

type MapStyle = {
  name: string;
  type: ChartSourceType;
  style: StyleSpecification | string;
};

const mapStyles: MapStyle[] = [
  {
    name: "VectorCharts",
    type: "style",
    style:
      "https://api.vectorcharts.com/api/v1/styles/base.json?token=7756d6ccad1c4656937e539bd3744dcd",
  },
  {
    name: "NOAA (ECDIS)",
    type: "custom",
    style: noaaEcdis as unknown as StyleSpecification,
  },
  {
    name: "NOAA (Paper Chart)",
    type: "custom",
    style: noaaPaper as unknown as StyleSpecification,
  },
  {
    name: "OpenSeaMap",
    type: "custom",
    style: openseamap as unknown as StyleSpecification,
  },
  {
    name: "Google Earth",
    type: "custom",
    style: googleEarth as unknown as StyleSpecification,
  },
];

export default mapStyles;
