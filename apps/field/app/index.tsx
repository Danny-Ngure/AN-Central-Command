import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getSession } from '@/lib/auth-storage';
import { theme } from '@/lib/theme';

// Entry redirect. On app launch:
//   - has a stored session → /(authed)/
//   - no session → /login

export default function Index() {
  const [route, setRoute] = useState<'/(authed)/' | '/login' | null>(null);

  useEffect(() => {
    getSession().then((s) => setRoute(s ? '/(authed)/' : '/login'));
  }, []);

  if (!route) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.colors.darkBg,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color={theme.colors.violet} size="large" />
      </View>
    );
  }

  return <Redirect href={route} />;
}
