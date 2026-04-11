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
} from "@expo/ui/swift-ui";
import { pickerStyle, tag } from "@expo/ui/swift-ui/modifiers";
import { router, Stack } from "expo-router";
import { useCallback, useState } from "react";

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

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    if (!trimmedName || !options) return;
    onSave(trimmedName, type, options);
  }, [name, options, type, onSave]);

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
              <Text modifiers={[tag("custom")]}>Custom Style</Text>
            </Picker>
          </Section>

          <TypeForm options={options} onOptionsChange={setOptions} />
        </Form>
      </Host>
    </>
  );
}
