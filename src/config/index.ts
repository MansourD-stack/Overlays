/**
 * Lecture de config/streamer.json (dossier demandé par le cahier des charges).
 * L'implémentation vit dans src/core/configLoader.ts : valeurs par défaut du
 * JSON + surcharges du panneau /control + état Jokko en mode hébergé.
 */
export { configStore } from "@/core/configLoader";
export type { StreamerConfig } from "@/types";
