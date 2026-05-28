import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { captureGps, type GpsOutcome } from '@/lib/gps';
import { enqueueVisit, type VisitPayload } from '@/lib/outbox';
import { theme } from '@/lib/theme';
import { newUuid } from '@/lib/uuid';

// Two-tap visit logging (beats SRS NFR-030's three-tap budget).
//
//   Tap 1 (on home screen):  "Log Visit" → navigates here
//   Tap 2 (on this screen):  pick a purpose → visit is enqueued and we pop back
//
// GPS captures in the background as soon as this screen mounts. By the time the
// user picks a purpose, the fix is usually ready. If not, we wait briefly,
// then submit without coords and let the server resolve "no location".

interface PurposeOption {
  value: VisitPayload['purpose'];
  label: string;
  hint: string;
}

const PURPOSES: PurposeOption[] = [
  { value: 'door_to_door',    label: 'Door-to-door',   hint: 'Walking the estate' },
  { value: 'courtesy_call',   label: 'Courtesy call',  hint: 'Quick stop-by' },
  { value: 'baraza',          label: 'Baraza',         hint: 'Community meeting' },
  { value: 'leader_meeting',  label: 'Leader meeting', hint: 'One-on-one' },
  { value: 'site_assessment', label: 'Site assessment',hint: 'Surveying location' },
  { value: 'follow_up',       label: 'Follow-up',      hint: 'Continuing earlier' },
];

export default function LogVisitScreen() {
  const [gps, setGps] = useState<GpsOutcome | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    captureGps().then(setGps);
  }, []);

  async function submit(purpose: VisitPayload['purpose']) {
    if (busy) return;
    setBusy(true);

    // If GPS isn't ready yet, give it one more half-second.
    let fix: GpsOutcome | null = gps;
    if (!fix) {
      await new Promise((r) => setTimeout(r, 500));
      fix = await captureGps();
      setGps(fix);
    }

    if (!fix || fix.status === 'denied') {
      setBusy(false);
      Alert.alert(
        'Location required',
        'AN Field needs your location to tag the visit with the right village. Enable location in your phone settings.',
      );
      return;
    }
    if (fix.status === 'timeout' || fix.status === 'error') {
      setBusy(false);
      Alert.alert(
        'GPS unavailable',
        'Could not capture your location. Move to a clearer spot and try again, or log this visit later.',
      );
      return;
    }

    const payload: VisitPayload = {
      id: newUuid(),
      location: { lng: fix.fix.lng, lat: fix.fix.lat },
      purpose,
    };
    await enqueueVisit(payload);

    // Pop back. The home screen's pending-count badge updates on focus.
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Log visit', headerShown: true }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.gpsCard}>
          <Text style={styles.gpsLabel}>Your location</Text>
          {!gps ? (
            <View style={styles.gpsRow}>
              <ActivityIndicator color={theme.colors.cyan} />
              <Text style={styles.gpsText}>Capturing GPS…</Text>
            </View>
          ) : gps.status === 'granted' ? (
            <Text style={styles.gpsText}>
              📍 {gps.fix.lat.toFixed(5)}, {gps.fix.lng.toFixed(5)}
              {gps.fix.accuracy ? `  ±${Math.round(gps.fix.accuracy)}m` : ''}
            </Text>
          ) : gps.status === 'denied' ? (
            <Text style={[styles.gpsText, { color: theme.colors.danger }]}>
              Permission denied — enable in settings
            </Text>
          ) : gps.status === 'timeout' ? (
            <Text style={[styles.gpsText, { color: theme.colors.warning }]}>
              GPS timed out — move to a clearer spot
            </Text>
          ) : (
            <Text style={[styles.gpsText, { color: theme.colors.danger }]}>{gps.message}</Text>
          )}
        </View>

        <Text style={styles.heading}>What kind of visit?</Text>
        <Text style={styles.subheading}>Tap to log.</Text>

        <View style={styles.purposeList}>
          {PURPOSES.map((p) => (
            <TouchableOpacity
              key={p.value}
              style={[styles.purposeBtn, busy && styles.purposeBtnDisabled]}
              onPress={() => submit(p.value)}
              disabled={busy}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.purposeLabel}>{p.label}</Text>
                <Text style={styles.purposeHint}>{p.hint}</Text>
              </View>
              <Text style={styles.purposeArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => router.back()}
          disabled={busy}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: theme.colors.darkBg },
  content: { padding: theme.spacing.lg },
  gpsCard: {
    backgroundColor: theme.colors.cardBg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  gpsLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  gpsText: { color: theme.colors.textActive, fontSize: theme.fontSize.sm, fontFamily: 'Menlo' },
  heading: {
    color: theme.colors.textActive,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
  },
  subheading: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  purposeList: { gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
  purposeBtn: {
    backgroundColor: theme.colors.cardBg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  purposeBtnDisabled: { opacity: 0.5 },
  purposeLabel: {
    color: theme.colors.textActive,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  purposeHint: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    marginTop: 2,
  },
  purposeArrow: {
    color: theme.colors.textMuted,
    fontSize: 28,
    fontWeight: '300',
  },
  cancelBtn: {
    alignSelf: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  cancelText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
