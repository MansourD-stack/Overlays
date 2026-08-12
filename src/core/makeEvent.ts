import type { TerangaEvent, TerangaEventType } from "@/types";

export function makeEvent(type: TerangaEventType, payload: Record<string, unknown> = {}): TerangaEvent {
  return { id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, payload, ts: Date.now() };
}
