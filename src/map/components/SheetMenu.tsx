import { ADD_MARKER_ICON, addMarkerAt } from "@/markers/hooks/useMarkers";
import { ADD_TO_ROUTE_ICON, addToRouteAction } from "@/routes/hooks/useRoutes";
import { Stack } from "expo-router";
import { ReactNode } from "react";
import { showLocation } from "react-native-map-link";

type Coordinate = { latitude: number; longitude: number };

/**
 * The actions menu for a bottom-sheet detail view. Renders a single
 * three-dots button in the header's left slot whose menu holds every action.
 *
 * This replaces the old `placement="bottom"` toolbar, which was unreliable on
 * collapsed sheets — it relied on manually hiding itself on detent changes and
 * frequently failed to hide. A header-anchored menu is always visible and
 * doesn't fight the sheet's geometry.
 *
 * When a `coordinate` is given, the menu leads with the actions common to any
 * point on the map — Open In…, Add Marker, Add to Route — followed by any
 * view-specific `children`. Set `showMarker`/`showRoute` to `false` to omit an
 * action that doesn't apply (e.g. "Add Marker" on a marker's own detail view).
 *
 * NOTE: `Stack.Toolbar.Menu` filters its children by exact element type, so
 * every action must be a literal `Stack.Toolbar.MenuAction` rendered as a
 * direct child. Do not wrap them in a Fragment — `React.Children.toArray` keeps
 * the Fragment as one (disallowed) child and the whole group is dropped.
 */
export default function SheetMenu({
  coordinate,
  title,
  showMarker = true,
  showRoute = true,
  children,
}: {
  coordinate?: Coordinate;
  /** Title used when opening the coordinate in an external maps app. */
  title?: string;
  /** Include the "Add Marker" action (default true). */
  showMarker?: boolean;
  /** Include the "Add to Route" action (default true). */
  showRoute?: boolean;
  children?: ReactNode;
}) {
  const route = coordinate && showRoute ? addToRouteAction(coordinate) : null;

  return (
    <Stack.Toolbar placement="left">
      <Stack.Toolbar.Menu icon="ellipsis">
        {coordinate && (
          <Stack.Toolbar.MenuAction
            icon="square.and.arrow.up"
            onPress={() => showLocation({ ...coordinate, title })}
          >
            Open In…
          </Stack.Toolbar.MenuAction>
        )}
        {coordinate && (showMarker || route) && (
          <Stack.Toolbar.Menu inline>
            {showMarker && (
              <Stack.Toolbar.MenuAction
                icon={ADD_MARKER_ICON}
                onPress={() => addMarkerAt(coordinate)}
              >
                Add Marker
              </Stack.Toolbar.MenuAction>
            )}
            {route && (
              <Stack.Toolbar.MenuAction icon={ADD_TO_ROUTE_ICON} onPress={route.onPress}>
                {route.label}
              </Stack.Toolbar.MenuAction>
            )}
          </Stack.Toolbar.Menu>
        )}
        {children}
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}
