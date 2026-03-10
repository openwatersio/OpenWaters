import { StyleSheet, Text, View } from "react-native";
import { NavigationState, useNavigationState } from "../hooks/useNavigationState";
import { usePreferredUnits } from "../hooks/usePreferredUnits";

export default function SpeedOverGround() {
  const units = usePreferredUnits();
  const nav = useNavigationState();
  const { value, plural } = units.toSpeed(nav.coords?.speed ?? undefined)

  return (
    <View style={[style.container, { opacity: nav.state === NavigationState.Underway ? 1 : 0 }]}>
      <Text style={style.label}>SOG</Text>
      <Text style={style.value}>{value ?? "--"}</Text>
      <Text style={style.units}>{plural}</Text>
    </View>
  )
}

const style = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255,255,255,1)",
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    padding: 10,
    borderRadius: 10,
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
