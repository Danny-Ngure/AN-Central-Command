import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ApiError, apiPost } from '@/lib/api-client';
import { saveSession } from '@/lib/auth-storage';
import { theme } from '@/lib/theme';

interface LoginSuccess {
  token: string;
  expiresAt: string;
  person: { id: string; role: string; wardId: string | null };
}

export default function LoginScreen() {
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [show2fa, setShow2fa] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<LoginSuccess>('/api/auth/login', {
        phoneOrEmail,
        password,
        totpCode: totpCode || undefined,
        client: 'mobile',
      });
      await saveSession({
        token: result.token,
        personId: result.person.id,
        role: result.person.role,
        wardId: result.person.wardId,
      });
      router.replace('/(authed)/');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'AUTH_2FA_REQUIRED') {
          setShow2fa(true);
          setError('Two-factor authentication code required');
        } else if (err.code === 'AUTH_2FA_NOT_ENROLLED') {
          setError('Two-factor enrollment is required for your role — sign in on web first.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Sign in failed');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.tagline}>AN CENTRAL COMMAND</Text>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Nyali Constituency campaign field app</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Phone or email</Text>
          <TextInput
            style={styles.input}
            value={phoneOrEmail}
            onChangeText={setPhoneOrEmail}
            placeholder="+254700000010"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!busy}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
          />
        </View>

        {show2fa && (
          <View style={styles.field}>
            <Text style={styles.label}>Two-factor code</Text>
            <TextInput
              style={[styles.input, styles.totpInput]}
              value={totpCode}
              onChangeText={(t) => setTotpCode(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              editable={!busy}
            />
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={busy || !phoneOrEmail || !password}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footnote}>
          Authorised personnel only. Unauthorised access is an offence under the
          Computer Misuse and Cybercrimes Act, 2018.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.darkBg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  tagline: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textActive,
    fontSize: theme.fontSize.xxl,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xl,
  },
  field: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.darkBg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    color: theme.colors.textActive,
    fontSize: theme.fontSize.md,
  },
  totpInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: 'rgba(255, 62, 62, 0.1)',
    borderColor: 'rgba(255, 62, 62, 0.3)',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.sm,
  },
  button: {
    backgroundColor: theme.colors.violet,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  footnote: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
});
