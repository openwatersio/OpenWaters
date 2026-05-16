import { formatElapsedMs } from "@/format";
import { useElapsedMs } from "@/hooks/useElapsedMs";
import { toDistance, toSpeed } from "@/hooks/usePreferredUnits";
import { useTrackRecording } from "@/tracks/hooks/useTrackRecording";
import { StatItem } from "@/ui/StatItem";
import { HStack, Image } from "@expo/ui/swift-ui";

export default function TrackRecordingStats() {
  const { track, distance, averageSpeed } = useTrackRecording();
  const elapsedMs = useElapsedMs(track?.started_at ?? null);
  const dist = toDistance(distance);
  const avgSpd = toSpeed(averageSpeed);

  return (
    <HStack spacing={16}>
      <Image systemName="point.bottomleft.forward.to.arrow.triangle.scurvepath" color="red" />
      <StatItem label="Average" value={avgSpd.value} suffix={avgSpd.abbr} />
      <StatItem label="Elapsed" value={formatElapsedMs(elapsedMs)} />
      <StatItem label="Distance" value={dist.value} suffix={dist.abbr} />
    </HStack>
  );
}
