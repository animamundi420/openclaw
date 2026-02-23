export type Theme = {
  name: string;
  background: string;
  text: string;
  accent: string;
  fontFamily: string;
  headingFontFamily: string;
};

export const themes: Record<string, Theme> = {
  dark: {
    name: "dark",
    background: "#0f172a",
    text: "#f1f5f9",
    accent: "#3b82f6",
    fontFamily: "system-ui, -apple-system, sans-serif",
    headingFontFamily: "system-ui, -apple-system, sans-serif",
  },
  light: {
    name: "light",
    background: "#ffffff",
    text: "#1e293b",
    accent: "#2563eb",
    fontFamily: "system-ui, -apple-system, sans-serif",
    headingFontFamily: "system-ui, -apple-system, sans-serif",
  },
  corporate: {
    name: "corporate",
    background: "#1a1a2e",
    text: "#eaeaea",
    accent: "#e94560",
    fontFamily: "system-ui, -apple-system, sans-serif",
    headingFontFamily: "system-ui, -apple-system, sans-serif",
  },
  neon: {
    name: "neon",
    background: "#0a0a0a",
    text: "#00ff41",
    accent: "#ff00ff",
    fontFamily: "system-ui, -apple-system, monospace",
    headingFontFamily: "system-ui, -apple-system, monospace",
  },
  ocean: {
    name: "ocean",
    background: "#0c1445",
    text: "#e0f2fe",
    accent: "#06b6d4",
    fontFamily: "system-ui, -apple-system, sans-serif",
    headingFontFamily: "system-ui, -apple-system, sans-serif",
  },
};

export function getTheme(name?: string): Theme {
  return themes[name ?? "dark"] ?? themes.dark;
}
