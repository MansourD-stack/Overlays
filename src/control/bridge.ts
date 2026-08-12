import { eventBus } from "@/core/eventBus";
import { configStore } from "@/core/configLoader";
import type { DeepPartial, StreamerConfig } from "@/types";

/** Every control-panel action goes through here: patch the local config
 *  (persisted, so the panel keeps its own state across reloads) and
 *  broadcast the same patch to every open overlay scene. */
export function pushConfig(patch: DeepPartial<StreamerConfig>) {
  configStore.patch(patch, true);
  eventBus.send({ kind: "config-patch", patch });
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: number | undefined;
  return (...args: A) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}
