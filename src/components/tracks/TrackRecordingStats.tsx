import { StatItem } from "@/components/ui/StatItem";
import { toDistance, toSpeed } from "@/hooks/usePreferredUnits";
import { useTrackRecording } from "@/hooks/useTrackRecording";
import { formatElapsedTime } from "@/lib/format";
import { HStack } from "@expo/ui/swift-ui";
import { useEffect, useState } from "react";

export default function TrackRecordingStats() {
  const { track, distance, averageSpeed } = useTrackRecording();
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const dist = toDistance(distance);
  const avgSpd = toSpeed(averageSpeed);

  return (
    <HStack spacing={16}>
      <StatItem
        label="Average"
        value={avgSpd.value}
        suffix={avgSpd.abbr}
      />
      <StatItem
        label="Elapsed"
        value={formatElapsedTime(track?.started_at ?? null)}
      />
      <StatItem
        label="Distance"
        value={dist.value}
        suffix={dist.abbr}
      />
    </HStack>
  );
}
