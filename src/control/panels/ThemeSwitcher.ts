import { el } from "@/core/dom";
import { eventBus } from "@/core/eventBus";
import { THEMES, THEME_LABELS, applyTheme, type ThemeName } from "@/themes";
import { configStore } from "@/core/configLoader";
import { pushConfig } from "../bridge";

export function themeSwitcherPanel(): HTMLElement {
  const buttons = THEMES.map((theme) => {
    const btn = el("button", { class: "tg-theme-swatch", attrs: { "data-theme-btn": theme }, text: THEME_LABELS[theme] });
    btn.addEventListener("click", () => {
      applyTheme(theme); // preview instantly inside the control panel too
      pushConfig({ theme });
      eventBus.send({ kind: "theme-change", theme });
      highlight(theme);
    });
    return btn;
  });

  const host = el("div", { class: "tg-theme-grid", children: buttons });

  function highlight(active: ThemeName) {
    for (const b of buttons) b.classList.toggle("tg-theme-swatch--active", b.getAttribute("data-theme-btn") === active);
  }
  highlight(configStore.get().theme);

  return el("section", {
    class: "tg-ctrl-panel",
    children: [el("h2", { class: "tg-ctrl-panel__title", text: "Thème" }), host],
  });
}
