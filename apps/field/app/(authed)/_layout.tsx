import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getSession } from '@/lib/auth-storage';
import { theme } from '@/lib/theme';

// Authed route group — every screen below this is behind a session check.
// Layered defence: index.tsx already routes here only when a session exists,
// but this layout double-checks so a deep link can't bypass auth.

export default function AuthedLayout() {
  const [status, setStatus] = useState<'checking' | 'authed' | 'unauthed'>('checking');

  useEffect(() => {
    getSession().then((s) => setStatus(s ? 'authed' : 'unauthed'));
  }, []);

  if (status === 'checking') {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.darkBg,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color={theme.colors.violet} />
      </View>
    );
  }

  if (status === 'unauthed') {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.cardBg },
        headerTintColor: theme.colors.textActive,
        contentStyle: { backgroundColor: theme.colors.darkBg },
      }}
    />
  );
}
