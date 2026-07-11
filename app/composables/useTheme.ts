import { THEME_STORAGE_KEY } from "~/utils/constants";

export type ThemeId = "dark" | "light" | "catppuccin-mocha" | "nord" | "tokyo-night" | "dracula" | "gruvbox" | "rose-pine";

export interface ThemeOption {
  id: ThemeId;
  label: string;
  swatch: [string, string, string];
}

export const THEMES: ThemeOption[] = [
  { id: "dark", label: "Dark", swatch: ["#000000", "#26a69a", "#ef5350"] },
  { id: "light", label: "Light", swatch: ["#ffffff", "#0e8a7d", "#d83a36"] },
  { id: "catppuccin-mocha", label: "Catppuccin Mocha", swatch: ["#1e1e2e", "#a6e3a1", "#f38ba8"] },
  { id: "nord", label: "Nord", swatch: ["#2e3440", "#a3be8c", "#bf616a"] },
  { id: "tokyo-night", label: "Tokyo Night", swatch: ["#1a1b26", "#9ece6a", "#f7768e"] },
  { id: "dracula", label: "Dracula", swatch: ["#282a36", "#50fa7b", "#ff5555"] },
  { id: "gruvbox", label: "Gruvbox", swatch: ["#1d2021", "#b8bb26", "#fb4934"] },
  { id: "rose-pine", label: "Rosé Pine", swatch: ["#191724", "#9ccfd8", "#eb6f92"] },
];

const isThemeId = (v: unknown): v is ThemeId => typeof v === "string" && THEMES.some((t) => t.id === v);

export const useTheme = () => {
  const current = useState<ThemeId>("stance-theme", () => "dark");
  const loaded = useState<boolean>("stance-theme-loaded", () => false);

  const apply = (id: ThemeId) => {
    if (import.meta.client) document.documentElement.dataset.theme = id;
  };

  const load = () => {
    if (loaded.value || import.meta.server) return;
    loaded.value = true;
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      if (isThemeId(raw)) current.value = raw;
    } catch {}
    apply(current.value);
  };

  const setTheme = (id: ThemeId) => {
    if (!isThemeId(id) || id === current.value) return;
    if (import.meta.client && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const el = document.documentElement;
      el.classList.add("theme-transition");
      window.setTimeout(() => el.classList.remove("theme-transition"), 280);
    }
    current.value = id;
    apply(id);
    if (!import.meta.server) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, current.value);
      } catch {}
    }
  };

  return { current: readonly(current), themes: THEMES, load, setTheme };
};
