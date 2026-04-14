import { StatItem } from "@/ui/StatItem";
import { toDistance, toSpeed } from "@/hooks/usePreferredUnits";
import { useTrackRecording } from "@/tracks/hooks/useTrackRecording";
import { formatElapsedTime } from "@/format";
import { HStack } from "@expo/ui/swift-ui";
import { useEffect, useState } from "react";

export default function TrackRecordingStats() {
  const { track, distance } = useTrackRecording();
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsedSeconds = track?.started_at
    ? (Date.now() - new Date(track.started_at).getTime()) / 1000
    : 0;
  const averageSpeed = elapsedSeconds > 0 ? distance / elapsedSeconds : 0;

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
