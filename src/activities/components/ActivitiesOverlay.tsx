import ActivityCarousel from "@/activities/components/ActivityCarousel";
import DestinationCard from "@/activities/components/DestinationCard";
import InstrumentsCard, {
  useInstrumentsCardVisible,
} from "@/activities/components/InstrumentsCard";
import NavigationCard, {
  useNavigationCardVisible,
} from "@/activities/components/NavigationCard";
import TrackCard from "@/activities/components/TrackCard";
import WaypointCard, {
  useWaypointCardVisible,
} from "@/activities/components/WaypointCard";
import { useActiveRoute } from "@/routes/hooks/useRoutes";
import { useTrackRecording } from "@/tracks/hooks/useTrackRecording";

export default function ActivitiesOverlay() {
  const showWaypoint = useWaypointCardVisible();
  const showNav = useNavigationCardVisible();
  const showInstruments = useInstrumentsCardVisible();
  const { isNavigating } = useActiveRoute();
  const { isRecording } = useTrackRecording();

  const cards = [
    showWaypoint && <WaypointCard key="waypoint" />,
    isNavigating && <DestinationCard key="destination" />,
    isRecording && <TrackCard key="track" />,
    showNav && <NavigationCard key="nav" />,
    showInstruments && <InstrumentsCard key="instruments" />,
  ].filter(Boolean);

  if (cards.length === 0) return null;

  return <ActivityCarousel>{cards}</ActivityCarousel>;
}
