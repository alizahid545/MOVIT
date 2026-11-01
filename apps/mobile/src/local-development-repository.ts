import AsyncStorage from "@react-native-async-storage/async-storage";

export interface DevelopmentStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

type StorageStatus = { error: string | null };

const storagePrefix = "moveit:development:v1:";
const memoryValues = new Map<string, string>();
const testStorage: DevelopmentStorage = {
  async getItem(key) {
    return memoryValues.get(key) ?? null;
  },
  async setItem(key, value) {
    memoryValues.set(key, value);
  },
  async removeItem(key) {
    memoryValues.delete(key);
  },
};

const isTestRuntime = typeof process !== "undefined" && process.env.NODE_ENV === "test";
const storage: DevelopmentStorage = isTestRuntime ? testStorage : AsyncStorage;
const listeners = new Set<() => void>();
const pendingWrites = new Map<string, Promise<void>>();
let status: StorageStatus = { error: null };
const storageErrors = new Map<string, string>();

export async function readDevelopmentData<T>(key: string, fallback: T): Promise<T> {
  const serialized = await storage.getItem(storagePrefix + key);
  if (serialized === null) return fallback;
  try {
    return JSON.parse(serialized) as T;
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : "invalid JSON";
    throw new Error(`Saved local development data for "${key}" could not be read: ${reason}`);
  }
}

export async function writeDevelopmentData<T>(key: string, value: T): Promise<void> {
  try {
    await storage.setItem(storagePrefix + key, JSON.stringify(value));
    updateStorageError(key, null);
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : "unknown storage error";
    updateStorageError(key, reason);
    throw new Error(`Local development data for "${key}" could not be saved: ${reason}`);
  }
}

export function persistDevelopmentData<T>(key: string, value: T): void {
  const previous = pendingWrites.get(key) ?? Promise.resolve();
  const write = previous.catch(() => undefined).then(() => writeDevelopmentData(key, value));
  pendingWrites.set(key, write);
  void write.catch((caught: unknown) => {
    updateStatus(caught instanceof Error ? caught.message : "Local development data could not be saved.");
  }).finally(() => {
    if (pendingWrites.get(key) === write) pendingWrites.delete(key);
  });
}

export async function removeDevelopmentData(key: string): Promise<void> {
  try {
    await storage.removeItem(storagePrefix + key);
    updateStorageError(key, null);
  } catch (caught) {
    const reason = caught instanceof Error ? caught.message : "unknown storage error";
    updateStorageError(key, reason);
    throw new Error(`Local development data for "${key}" could not be removed: ${reason}`);
  }
}

export async function flushDevelopmentWrites(): Promise<void> {
  await Promise.all([...pendingWrites.values()]);
}

export function getDevelopmentStorageStatus(): StorageStatus {
  return status;
}

export function subscribeDevelopmentStorageStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function updateStorageError(key: string, error: string | null): void {
  if (error) storageErrors.set(key, error);
  else storageErrors.delete(key);
  const combined = storageErrors.size
    ? [...storageErrors.entries()].map(([dataKey, message]) => `${dataKey}: ${message}`).join("; ")
    : null;
  updateStatus(combined);
}

function updateStatus(error: string | null): void {
  if (status.error === error) return;
  status = { error };
  listeners.forEach((listener) => listener());
}
