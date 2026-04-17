import log from "@/logger";
import type { ImportFile, ImportRecord, ImportRecordStatus } from "@/import";

const logger = log.extend("import");
import {
  cancelImport,
  clearImportStatus,
  isImportRunning,
  startDirectoryImport,
  startFileImport,
  useImport,
} from "@/import/state";
import SheetView from "@/ui/SheetView";
import {
  Button,
  DisclosureGroup,
  Host,
  HStack,
  Image,
  ImageProps,
  List,
  ProgressView,
  Section,
  Spacer,
  Text,
  VStack
} from "@expo/ui/swift-ui";
import {
  animation,
  Animation,
  font,
  foregroundStyle,
  lineLimit,
  onTapGesture,
  padding,
  progressViewStyle,
  tint,
  truncationMode,
} from "@expo/ui/swift-ui/modifiers";
import { Directory, File } from "expo-file-system";
import { router, Stack } from "expo-router";
import { Alert } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

function statusIcon(status: ImportRecordStatus): {
  name: SFSymbol;
  color: string;
} {
  switch (status) {
    case "done":
      return { name: "checkmark", color: "green" };
    case "skipped":
      return { name: "arrow.uturn.right", color: "secondary" };
    case "importing":
      return { name: "arrow.triangle.2.circlepath", color: "primary" };
    case "failed":
      return { name: "exclamationmark.triangle.fill", color: "red" };
    case "pending":
    default:
      return { name: "circle", color: "secondary" };
  }
}

function navigateToRecord(record: ImportRecord) {
  if (record.status !== "done" || record.id == null) return;
  switch (record.type) {
    case "marker":
      router.replace(`/feature/marker/${record.id}`);
      break;
    case "track":
      router.replace(`/feature/track/${record.id}`);
      break;
    case "route":
      router.replace(`/route/${record.id}`);
      break;
  }
}

function RecordRow(record: ImportRecord) {
  const icon = statusIcon(record.status);
  const tappable = record.status === "done" && record.id != null;
  const subtext =
    record.status === "skipped"
      ? "Duplicate — skipped"
      : record.status === "failed" && record.error
        ? record.error
        : record.file;
  const inProgress =
    record.status === "pending" || record.status === "importing";

  const icons: Record<ImportRecord["type"], ImageProps["systemName"]> = {
    track: "point.bottomleft.forward.to.arrow.triangle.scurvepath",
    marker: "mappin.and.ellipse",
    route: "point.topright.arrow.triangle.backward.to.point.bottomleft.scurvepath.fill",
  }

  return (
    <HStack
      spacing={12}
      modifiers={[
        padding({ vertical: 4 }),
        ...(tappable ? [onTapGesture(() => navigateToRecord(record))] : []),
      ]}
    >
      <Image
        systemName={icons[record.type]}
      />
      <VStack alignment="leading" spacing={2}>
        <Text
          modifiers={[font({ size: 15, weight: "semibold" }), lineLimit(1)]}
        >
          {record.name}
        </Text>
        <Text
          modifiers={[
            lineLimit(1),
            truncationMode("middle"),
            font({ size: 12 }),
            foregroundStyle(
              record.status === "failed" ? "red" : "secondary",
            ),
          ]}
        >
          {subtext}
        </Text>
      </VStack>
      <Spacer />
      {inProgress ? (
        <ProgressView modifiers={[progressViewStyle("circular")]} />
      ) : (
        <Image
          systemName={icon.name}
          color={icon.color}
          size={14}
        />
      )}
    </HStack>
  );
}

function FilesSummary({ files }: { files: readonly ImportFile[] }) {
  const total = files.length;
  const done = files.filter((f) => f.status === "done").length;
  const failed = files.filter((f) => f.status === "failed").length;
  const current =
    files.find((f) => f.status === "importing") ??
    files.find((f) => f.status === "pending");
  const running = current != null;
  const label = running
    ? `Importing ${done.toLocaleString()} of ${total.toLocaleString()}…`
    : `Imported ${(total - failed).toLocaleString()} of ${total.toLocaleString()} ${total === 1 ? "file" : "files"}`;
  const subtext = current
    ? current.name
    : failed > 0
      ? `${failed.toLocaleString()} failed`
      : null;
  return (
    <HStack spacing={12} modifiers={[padding({ vertical: 4 })]}>
      <Image systemName="doc.on.doc" />
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 15, weight: "semibold" })]}>
          {label}
        </Text>
        {subtext && (
          <Text
            modifiers={[
              font({ size: 12 }),
              foregroundStyle(
                !running && failed > 0 ? "red" : "secondary",
              ),
              lineLimit(1),
              truncationMode("middle"),
            ]}
          >
            {subtext}
          </Text>
        )}
      </VStack>
      <Spacer />
      {running ? (
        <ProgressView modifiers={[progressViewStyle("circular")]} />
      ) : failed > 0 ? (
        <Image
          systemName="exclamationmark.triangle.fill"
          color="red"
          size={14}
        />
      ) : (
        <Image systemName="checkmark" color="green" size={14} />
      )}
    </HStack>
  );
}

async function onPickFile() {
  try {
    startFileImport(await File.pickFileAsync());
  } catch (e) {
    logger.warn("pick file failed", e);
  }
}

async function onPickDirectory() {
  try {
    const dir = await Directory.pickDirectoryAsync();
    if (!dir) return;
    startDirectoryImport(dir);
  } catch (e) {
    logger.warn("pick directory failed", e);
  }
}

export default function Import() {
  const { status } = useImport();
  const running = isImportRunning(status);
  const hasStatus = status !== null;

  const files: readonly ImportFile[] = status?.files ?? [];
  const records: readonly ImportRecord[] = status?.records ?? [];

  return (
    <SheetView id="import">
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="xmark" onPress={() => router.dismiss()}>
          Close
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Host style={{ flex: 1 }}>
        <List
          modifiers={[animation(Animation.default, records.length)]}
        >
          {!hasStatus && (
            <Section
              footer={
                <Text>
                  Select a .gpx file, a .zip containing GPX files, or a folder.
                </Text>
              }
            >
              <Button
                modifiers={[tint("primary")]}
                systemImage="doc"
                label="Choose File"
                onPress={onPickFile}
              />
              <Button
                modifiers={[tint("primary")]}
                systemImage="folder"
                label="Choose Folder"
                onPress={onPickDirectory}
              />
            </Section>
          )}

          {status && (
            <>
              <Section title="Status">
                {files.length > 0 && <FilesSummary files={files} />}
                {running ? (
                  <Button
                    modifiers={[tint("red")]}
                    label="Cancel Import"
                    onPress={() =>
                      Alert.alert(
                        "Cancel Import?",
                        "Already-imported items will be kept, but remaining files will be discarded.",
                        [
                          { text: "Continue Import", style: "cancel" },
                          {
                            text: "Cancel Import",
                            style: "destructive",
                            onPress: cancelImport,
                          },
                        ],
                      )
                    }
                  />
                ) : (
                  <Button
                    modifiers={[tint("primary")]}
                    label="Start New Import"
                    onPress={clearImportStatus}
                  />
                )}
              </Section>

              <Section title="Imported Records">
                {records
                  .slice(-10)
                  .reverse()
                  .map((record, i) => (
                    <RecordRow key={i} {...record} />
                  ))}
                {records.length > 10 && (
                  <Text>
                    {`${records.length - 10} more…`}
                  </Text>
                )}
              </Section>

              {status.terminalReason === "error" && status.errorMessage && (
                <Section header={<Text>Error</Text>}>
                  <Text modifiers={[foregroundStyle("red")]}>
                    {status.errorMessage}
                  </Text>
                </Section>
              )}

              {status.errors.length > 0 && (
                <Section>
                  <DisclosureGroup
                    label={`Errors (${status.errors.length})`}
                    isExpanded={status.errors.length <= 3}
                  >
                    {status.errors.map(
                      (
                        e: { file: string; message: string },
                        i: number,
                      ) => (
                        <VStack
                          key={i}
                          alignment="leading"
                          spacing={2}
                          modifiers={[padding({ vertical: 4 })]}
                        >
                          <Text
                            modifiers={[
                              font({ size: 13, weight: "semibold" }),
                              foregroundStyle("red"),
                            ]}
                          >
                            {e.file}
                          </Text>
                          <Text modifiers={[font({ size: 12 })]}>
                            {e.message}
                          </Text>
                        </VStack>
                      ),
                    )}
                  </DisclosureGroup>
                </Section>
              )}
            </>
          )}
        </List>
      </Host>
    </SheetView>
  );
}
