import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme } from '@/lib/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.darkBg }}>
      <StatusBar style="light" backgroundColor={theme.colors.darkBg} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.cardBg },
          headerTintColor: theme.colors.textActive,
          contentStyle: { backgroundColor: theme.colors.darkBg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(authed)" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
