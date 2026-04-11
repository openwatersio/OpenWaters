import SheetView from "@/components/ui/SheetView";
import {
  setViewOptions,
  useChartSources,
  useViewOptions,
} from "@/hooks/useViewOptions";
import { deleteChartSource } from "@/lib/database";
import {
  Button,
  ContextMenu,
  Host,
  List,
  Section,
  VStack,
} from "@expo/ui/swift-ui";
import { router, Stack } from "expo-router";
import { Alert } from "react-native";

export default function Charts() {
  const mapStyleId = useViewOptions((s) => s.mapStyleId);
  const sources = useChartSources();

  function confirmDelete(id: number, name: string) {
    const selected =
      id === mapStyleId || (mapStyleId == null && id === sources[0]?.id);
    Alert.alert("Delete Chart Source", `Delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteChartSource(id);
          if (selected) {
            setViewOptions({ mapStyleId: undefined });
          }
        },
      },
    ]);
  }

  return (
    <SheetView id="charts">
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="plus"
          onPress={() => router.push("/charts/add")}
        >
          Add
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()}>
          Close
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Host style={{ flex: 1 }}>
        <VStack alignment="leading">
          <List>
            <Section>
              {sources.map(({ id, name, isBuiltin }) => {
                const selected =
                  id === mapStyleId ||
                  (mapStyleId == null && id === sources[0]?.id);
                const image = selected
                  ? "checkmark.circle.fill"
                  : "circle";

                return (
                  <ContextMenu key={id}>
                    <ContextMenu.Trigger>
                      <Button
                        systemImage={image}
                        label={name}
                        onPress={() => setViewOptions({ mapStyleId: id })}
                      />
                    </ContextMenu.Trigger>
                    <ContextMenu.Items>
                      <Button
                        label="Edit"
                        systemImage="pencil"
                        onPress={() =>
                          router.push({
                            pathname: "/charts/[id]",
                            params: { id: String(id) },
                          })
                        }
                      />
                      {!isBuiltin && (
                        <Button
                          label="Delete"
                          systemImage="trash"
                          role="destructive"
                          onPress={() => confirmDelete(id, name)}
                        />
                      )}
                    </ContextMenu.Items>
                  </ContextMenu>
                );
              })}
            </Section>
          </List>
        </VStack>
      </Host>
    </SheetView>
  );
}
