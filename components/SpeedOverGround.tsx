import { StyleSheet, Text } from "react-native";
import { NavigationState, useNavigationState } from "../hooks/useNavigationState";
import { usePreferredUnits } from "../hooks/usePreferredUnits";
import OverlayView from "./ui/OverlayView";

export default function SpeedOverGround() {
  const units = usePreferredUnits();
  const nav = useNavigationState();
  const { value, plural } = units.toSpeed(nav.coords?.speed ?? undefined)

  return (
    <OverlayView style={[style.container, { opacity: nav.state === NavigationState.Underway ? 1 : 0 }]}>
      <Text style={style.label}>SOG</Text>
      <Text style={style.value}>{value ?? "--"}</Text>
      <Text style={style.units}>{plural}</Text>
    </OverlayView>
  )
}

const style = StyleSheet.create({
  container: {
    padding: 10,
    borderRadius: 20,
    width: 100,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  value: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    fontVariant: ['tabular-nums']
  },
  units: {
    fontSize: 10,
    textAlign: "center",
    textTransform: "uppercase",
  }
})
