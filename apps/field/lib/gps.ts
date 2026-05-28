import * as Location from 'expo-location';

// GPS capture wrapper. Three states for the caller:
//   - 'granted' + coords → use them
//   - 'denied' → user refused the permission prompt
//   - 'timeout' → permission OK but no fix in time (5s) — fall back gracefully
//
// SRS AC-050.2: GPS is auto-captured and the nearest village is auto-suggested.
// We do nearest-village lookup server-side; the Field App just supplies coords.

export interface GpsFix {
  lng: number;
  lat: number;
  accuracy: number;
  capturedAt: string; // ISO 8601
}

export type GpsOutcome =
  | { status: 'granted'; fix: GpsFix }
  | { status: 'denied' }
  | { status: 'timeout' }
  | { status: 'error'; message: string };

const TIMEOUT_MS = 5000;

export async function captureGps(): Promise<GpsOutcome> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { status: 'denied' };

    // Race a 5s timeout vs the GPS fix — field coordinators can't wait longer
    // than that without losing the rhythm of the conversation they're in.
    const fixPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
    const result = await Promise.race([fixPromise, timeout]);

    if (!result) return { status: 'timeout' };

    return {
      status: 'granted',
      fix: {
        lng: result.coords.longitude,
        lat: result.coords.latitude,
        accuracy: result.coords.accuracy ?? 0,
        capturedAt: new Date(result.timestamp).toISOString(),
      },
    };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
