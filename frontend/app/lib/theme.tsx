import { createContext, useContext, useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "dim" | "system";
export type AccentColor = "violet" | "blue" | "emerald" | "rose" | "amber" | "cyan" | "indigo" | "lime" | "coral";

interface ThemeContextValue {
  mode: ThemeMode;
  accent: AccentColor;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  resolved: "light" | "dark"; // actual computed theme
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  accent: "violet",
  setMode: () => {},
  setAccent: () => {},
  resolved: "dark",
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getResolved(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  if (mode === "dim") return "dark";
  return mode;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [accent, setAccentState] = useState<AccentColor>("violet");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");

  // Initialize from localStorage
  useEffect(() => {
    const savedMode = localStorage.getItem("theme-mode") as ThemeMode | null;
    const savedAccent = localStorage.getItem("theme-accent") as AccentColor | null;
    if (savedMode) setModeState(savedMode);
    if (savedAccent) setAccentState(savedAccent);
  }, []);

  // Apply theme to document
  useEffect(() => {
    const r = getResolved(mode);
    setResolved(r);
    document.documentElement.setAttribute("data-theme", mode === "dim" ? "dim" : r);
    document.documentElement.setAttribute("data-accent", accent);
  }, [mode, accent]);

  // Listen for system theme changes
  useEffect(() => {
    if (mode !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const r = getResolved("system");
      setResolved(r);
      document.documentElement.setAttribute("data-theme", r);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode]);

  function setMode(m: ThemeMode) {
    setModeState(m);
    localStorage.setItem("theme-mode", m);
  }

  function setAccent(a: AccentColor) {
    setAccentState(a);
    localStorage.setItem("theme-accent", a);
  }

  return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}
