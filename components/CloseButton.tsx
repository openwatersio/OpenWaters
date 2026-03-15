import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable } from 'react-native';

export function CloseButton() {
  return (
    <Pressable onPress={() => router.dismiss()} hitSlop={4}>
      <SymbolView
        name="xmark"
        tintColor="rgba(255,255,255,0.5)"
        size={20}
        weight="semibold"
        style={{ padding: 6 }}
      />
    </Pressable>
  );
}
