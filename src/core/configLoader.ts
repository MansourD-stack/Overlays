import defaults from "@config/streamer.json";
import type { DeepPartial, StreamerConfig } from "@/types";

const STORAGE_KEY = "overlay:config-overrides";

function deepMerge<T>(base: T, patch: unknown): T {
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) {
    return (patch === undefined ? base : (patch as T));
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    out[key] = deepMerge((base as Record<string, unknown>)?.[key], value);
  }
  return out as T;
}

function readOverrides(): DeepPartial<StreamerConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

let current: StreamerConfig = deepMerge(defaults as unknown as StreamerConfig, readOverrides());
const listeners = new Set<(config: StreamerConfig) => void>();

/** Live, in-memory config: defaults from streamer.json, patched at runtime by the control panel
 *  (persisted to localStorage so a reload keeps the streamer's edits) and by incoming bridge events. */
export const configStore = {
  get(): StreamerConfig {
    return current;
  },
  patch(patch: DeepPartial<StreamerConfig>, persist = true) {
    current = deepMerge(current, patch);
    if (persist) {
      try {
        const overrides = deepMerge(readOverrides(), patch);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
      } catch {
        /* storage unavailable (e.g. some embedded Browser Sources) — in-memory state still applies */
      }
    }
    for (const listener of listeners) listener(current);
  },
  subscribe(listener: (config: StreamerConfig) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    current = defaults as unknown as StreamerConfig;
    for (const listener of listeners) listener(current);
  },
};
