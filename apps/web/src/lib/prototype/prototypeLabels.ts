import type { PrototypeKind, PrototypeStatus } from "@/lib/api";

/** How each kind of prototype is named on screen. */
export const prototypeKindLabels: Record<PrototypeKind, string> = {
  mechanic: "ゲーム性",
  level: "レベル",
};

/** How each status of a prototype is named on screen. */
export const prototypeStatusLabels: Record<PrototypeStatus, string> = {
  building: "作っている",
  testing: "確かめている",
  adopted: "採用",
  dropped: "不採用",
};
