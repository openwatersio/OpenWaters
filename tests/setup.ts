// react-native-reanimated uses native worklets; mock for tests
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const View = require("react-native").View;
  return {
    __esModule: true,
    default: {
      View: React.forwardRef((props: any, ref: any) =>
        React.createElement(View, { ...props, ref }),
      ),
    },
    SlideInUp: { duration: () => ({ duration: () => ({}) }) },
    SlideOutUp: { duration: () => ({ duration: () => ({}) }) },
  };
});

// expo-symbols ships a native iOS-only component; mock it for tests
jest.mock("expo-symbols", () => {
  const React = require("react");
  return {
    SymbolView: ({ name, children }: { name: string; children?: any }) =>
      React.createElement("View", { testID: `symbol-${name}` }, children),
  };
});

// expo-router's Link needs a NavigationContainer; mock it as a pressable wrapper
jest.mock("expo-router", () => {
  const React = require("react");
  return {
    Link: ({ href, children, ...props }: { href: string; children?: any }) =>
      React.createElement(
        "Pressable",
        { testID: `link-${href}`, ...props },
        children,
      ),
  };
});

// @maplibre/maplibre-react-native uses native modules; mock LocationManager
jest.mock("@maplibre/maplibre-react-native", () => ({
  LocationManager: { addListener: jest.fn(), removeListener: jest.fn() },
}));

// expo-location uses native modules
jest.mock("expo-location", () => ({
  getForegroundPermissionsAsync: jest.fn(async () => ({
    status: "granted",
  })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({
    status: "granted",
  })),
  requestBackgroundPermissionsAsync: jest.fn(async () => ({
    status: "granted",
  })),
  getLastKnownPositionAsync: jest.fn(async () => null),
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(async () => false),
  Accuracy: { BestForNavigation: 6 },
}));

// expo-task-manager uses native modules
jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn(),
}));

// @expo/ui/swift-ui uses native SwiftUI components; mock for tests
jest.mock("@expo/ui/swift-ui", () => {
  const React = require("react");
  const { View, Text, Pressable } = require("react-native");
  return {
    Button: ({ onPress, label, children, ...props }: any) =>
      React.createElement(
        Pressable,
        { onPress, testID: `button-${label || "unknown"}`, ...props },
        children,
      ),
    Image: ({ systemName, ...props }: any) =>
      React.createElement(View, { testID: `image-${systemName}`, ...props }),
    VStack: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
    Divider: (props: any) => React.createElement(View, props),
    Menu: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
    Text: ({ children, ...props }: any) =>
      React.createElement(Text, props, children),
    ZStack: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
    HStack: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
    Host: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
    Namespace: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
    GlassEffectContainer: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock("@expo/ui/swift-ui/modifiers", () => ({
  environment: () => ({}),
  frame: () => ({}),
  glassEffect: () => ({}),
  glassEffectId: () => ({}),
  labelStyle: () => ({}),
  contentTransition: () => ({}),
  animation: () => ({}),
  Animation: { default: "default" },
  tint: () => ({}),
}));

// react-native-safe-area-context uses native modules; mock insets
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: require("react-native").View,
  SafeAreaProvider: require("react-native").View,
}));
