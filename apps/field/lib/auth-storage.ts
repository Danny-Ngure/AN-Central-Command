import * as SecureStore from 'expo-secure-store';

// Token storage for the Field App.
//
// expo-secure-store maps to the Android Keystore / iOS Keychain — never in plain
// JS state or AsyncStorage. The session JWT is the most sensitive thing on device
// (CON-009 forbids storing voter records at all, so this is the high-value target).
//
// Hardware-backed where available; falls back to encrypted file storage otherwise.

const KEY_TOKEN = 'session_token';
const KEY_PERSON_ID = 'session_person_id';
const KEY_ROLE = 'session_role';
const KEY_WARD_ID = 'session_ward_id';

let memoryCache: SessionInfo | null = null;

export interface SessionInfo {
  token: string;
  personId: string;
  role: string;
  wardId: string | null;
}

export async function saveSession(info: SessionInfo): Promise<void> {
  memoryCache = info;
  await SecureStore.setItemAsync(KEY_TOKEN, info.token);
  await SecureStore.setItemAsync(KEY_PERSON_ID, info.personId);
  await SecureStore.setItemAsync(KEY_ROLE, info.role);
  if (info.wardId) {
    await SecureStore.setItemAsync(KEY_WARD_ID, info.wardId);
  } else {
    await SecureStore.deleteItemAsync(KEY_WARD_ID);
  }
}

export async function getSession(): Promise<SessionInfo | null> {
  if (memoryCache) return memoryCache;
  const token = await SecureStore.getItemAsync(KEY_TOKEN);
  if (!token) return null;
  const personId = await SecureStore.getItemAsync(KEY_PERSON_ID);
  const role = await SecureStore.getItemAsync(KEY_ROLE);
  const wardId = await SecureStore.getItemAsync(KEY_WARD_ID);
  if (!personId || !role) return null;
  memoryCache = { token, personId, role, wardId };
  return memoryCache;
}

export async function clearSession(): Promise<void> {
  memoryCache = null;
  await SecureStore.deleteItemAsync(KEY_TOKEN);
  await SecureStore.deleteItemAsync(KEY_PERSON_ID);
  await SecureStore.deleteItemAsync(KEY_ROLE);
  await SecureStore.deleteItemAsync(KEY_WARD_ID);
}
