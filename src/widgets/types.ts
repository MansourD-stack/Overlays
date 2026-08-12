import type { StreamerConfig, TerangaEvent } from "@/types";

/** Every widget is activable/movable/resizable/recolorable independently —
 *  this is the minimal contract the scene shell needs to mount and drive one. */
export interface Widget {
  id: string;
  node: HTMLElement;
  onConfig?(config: StreamerConfig): void;
  onEvent?(event: TerangaEvent): void;
  destroy?(): void;
}

export type WidgetFactory = () => Widget;
