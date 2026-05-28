import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ApiError, apiGet, apiPost } from '@/lib/api-client';
import { clearSession } from '@/lib/auth-storage';
import {
  getFailedCount,
  getPendingCount,
  syncOutbox,
} from '@/lib/outbox';
import { theme } from '@/lib/theme';

// Role-aware home screen (SRS FR-101).

interface MeResponse {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  role: string;
  wardId: string | null;
  wardName: string | null;
  lastActiveAt: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  candidate: 'Aspirant',
  campaign_manager: 'Campaign Manager',
  chief_strategist: 'Chief Strategist',
  constituency_coordinator: 'Constituency Coordinator',
  ward_coordinator: 'Ward Coordinator',
  assistant_ward_coordinator: 'Asst. Ward Coordinator',
  polling_station_lead: 'Polling Station Lead',
  polling_agent: 'Polling Agent',
  canvasser: 'Canvasser',
  influence_liaison: 'Influence Liaison',
  media_head: 'Media Head',
  comms_head: 'Comms Head',
  patron_ceo: 'Patron / CEO',
  tech_lead: 'Tech Lead',
  finance_lead: 'Finance Lead',
};

export default function HomeScreen() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);

  const refreshCounts = useCallback(() => {
    setPending(getPendingCount());
    setFailed(getFailedCount());
  }, []);

  async function loadMe() {
    try {
      const data = await apiGet<MeResponse>('/api/auth/me');
      setMe(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await clearSession();
        router.replace('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not load profile');
    }
  }

  useEffect(() => {
    loadMe();
    refreshCounts();
  }, [refreshCounts]);

  // Re-check the outbox each time this screen gains focus (after returning from /visits/log).
  useFocusEffect(
    useCallback(() => {
      refreshCounts();
    }, [refreshCounts]),
  );

  async function onSignOut() {
    try {
      await apiPost('/api/auth/logout', {});
    } catch {
      // best-effort
    }
    await clearSession();
    router.replace('/login');
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([
      loadMe(),
      syncOutbox().catch(() => undefined),
    ]);
    refreshCounts();
    setRefreshing(false);
  }

  if (!me && !error) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.violet} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.violet} />
      }
    >
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {me && (
        <>
          <View style={styles.header}>
            <Text style={styles.tagline}>AN CENTRAL COMMAND</Text>
            <Text style={styles.hello}>Hi, {me.fullName.split(' ')[0]}</Text>
            <Text style={styles.subtitle}>
              {ROLE_LABEL[me.role] ?? me.role}
              {me.wardName ? ` · ${me.wardName}` : ''}
            </Text>
          </View>

          {(pending > 0 || failed > 0) && (
            <View style={styles.syncCard}>
              <View style={styles.syncIndicator}>
                {pending > 0 && <View style={styles.syncDotPending} />}
                {failed > 0 && <View style={styles.syncDotFailed} />}
              </View>
              <View style={{ flex: 1 }}>
                {pending > 0 && (
                  <Text style={styles.syncTextPending}>
                    {pending} visit{pending === 1 ? '' : 's'} pending sync
                  </Text>
                )}
                {failed > 0 && (
                  <Text style={styles.syncTextFailed}>
                    {failed} visit{failed === 1 ? '' : 's'} failed — pull to retry
                  </Text>
                )}
              </View>
            </View>
          )}

          <View style={styles.actionGrid}>
            <ActionButton
              title="Log visit"
              hint="GPS + 2 taps"
              onPress={() => router.push('/(authed)/visits/log')}
            />
            <ActionButton title="Add leader" hint="Next commit" disabled />
            <ActionButton title="Log issue" hint="Next commit" disabled />
            <ActionButton title="Site check-in" hint="Next commit" disabled />
          </View>

          <TouchableOpacity style={styles.signOut} onPress={onSignOut}>
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

function ActionButton({
  title,
  hint,
  onPress,
  disabled,
}: {
  title: string;
  hint?: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <View style={[styles.actionButton, styles.actionButtonDisabled]}>
        <Text style={styles.actionButtonTitle}>{title}</Text>
        {hint && <Text style={styles.actionButtonHint}>{hint}</Text>}
      </View>
    );
  }
  return (
    <TouchableOpacity style={styles.actionButton} onPress={onPress}>
      <Text style={styles.actionButtonTitle}>{title}</Text>
      {hint && <Text style={styles.actionButtonHint}>{hint}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.colors.darkBg },
  content: { padding: theme.spacing.lg, paddingTop: theme.spacing.xxl + theme.spacing.lg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.darkBg },
  header: { marginBottom: theme.spacing.xl },
  tagline: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    letterSpacing: 3,
    marginBottom: theme.spacing.sm,
  },
  hello: { color: theme.colors.textActive, fontSize: theme.fontSize.xxl, fontWeight: '700' },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
  syncCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.cardBg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  syncIndicator: { flexDirection: 'row', gap: theme.spacing.xs },
  syncDotPending: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.cyan,
  },
  syncDotFailed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.danger,
  },
  syncTextPending: { color: theme.colors.textActive, fontSize: theme.fontSize.sm },
  syncTextFailed: { color: theme.colors.danger, fontSize: theme.fontSize.sm },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  actionButton: {
    flexBasis: '48%',
    backgroundColor: theme.colors.cardBg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
  },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonTitle: { color: theme.colors.textActive, fontSize: theme.fontSize.md, fontWeight: '600' },
  actionButtonHint: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: theme.spacing.xs },
  errorBox: {
    backgroundColor: 'rgba(255, 62, 62, 0.1)',
    borderColor: 'rgba(255, 62, 62, 0.3)',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  errorText: { color: theme.colors.danger, fontSize: theme.fontSize.sm },
  signOut: {
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.full,
  },
  signOutText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
