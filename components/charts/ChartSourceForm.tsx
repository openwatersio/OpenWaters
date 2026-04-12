import {
  FORM_COMPONENTS,
  type FormType,
} from "@/components/charts/StyleForms";
import {
  Form,
  Host,
  Picker,
  Section,
  Text,
  TextField,
  type TextFieldRef,
} from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { router, Stack } from "expo-router";
import { useCallback, useRef, useState } from "react";

type ChartSourceFormProps = {
  name?: string;
  type?: FormType;
  options?: string | null;
  onSave: (name: string, type: FormType, options: string) => void;
};

export default function ChartSourceForm({
  name: initialName = "",
  type: initialType = "raster",
  options: initialOptions = null,
  onSave,
}: ChartSourceFormProps) {
  const [type, setType] = useState<FormType>(initialType);
  const [name, setName] = useState(initialName);
  const [options, setOptions] = useState<string | null>(initialOptions);
  const nameFieldRef = useRef<TextFieldRef>(null);

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName || !options) return;
    onSave(trimmedName, type, options);
  }, [name, options, type, onSave]);

  // Pre-fill the name from a sub-form suggestion (e.g. MBTiles metadata)
  // only when the user hasn't already typed something.
  const handleNameSuggestion = useCallback(
    (suggested: string) => {
      if (name.trim().length > 0) return;
      setName(suggested);
      nameFieldRef.current?.setText(suggested);
    },
    [name],
  );

  const canSave = name.trim().length > 0 && options != null;
  const TypeForm = FORM_COMPONENTS[type];

  return (
    <>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button icon="xmark" onPress={() => router.back()}>
          Close
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="checkmark"
          onPress={handleSave}
          variant={canSave ? "prominent" : undefined}
          disabled={!canSave}
        >
          Save
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Host style={{ flex: 1 }}>
        <Form>
          <Section>
            <TextField
              ref={nameFieldRef}
              placeholder="Name"
              defaultValue={name}
              onChangeText={setName}
              autocorrection={false}
            />

            <Picker
              selection={type}
              onSelectionChange={(v) => {
                setType(v as FormType);
                setOptions(null);
              }}
              modifiers={[pickerStyle("segmented")]}
            >
              <Text modifiers={[tag("raster")]}>Raster</Text>
              <Text modifiers={[tag("style")]}>Style URL</Text>
              <Text modifiers={[tag("mbtiles")]}>MBTiles</Text>
            </Picker>
          </Section>

          <TypeForm
            options={options}
            onOptionsChange={setOptions}
            onNameSuggestion={handleNameSuggestion}
          />
        </Form>
      </Host>
    </>
  );
}
