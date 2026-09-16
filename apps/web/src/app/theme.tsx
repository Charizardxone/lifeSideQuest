import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export const THEME_KEY = 'sidequest-theme-v1';
type Theme = 'daily' | 'pixel';
export const parseTheme = (value: string | null): Theme => (value === 'pixel' ? 'pixel' : 'daily');

export function initializeTheme() {
  let theme: Theme = 'daily';
  try {
    theme = parseTheme(localStorage.getItem(THEME_KEY));
  } catch {
    /* Storage is optional. */
  }
  document.documentElement.dataset.theme = theme;
  return theme;
}

const ThemeContext = createContext<{
  theme: Theme;
  selectTheme: (theme: Theme) => void;
  warning: string;
} | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    parseTheme(document.documentElement.dataset.theme ?? null),
  );
  const [warning, setWarning] = useState('');
  function apply(theme: Theme) {
    document.documentElement.dataset.theme = theme;
    setTheme(theme);
  }
  function selectTheme(theme: Theme) {
    apply(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
      setWarning('');
    } catch {
      setWarning('当前浏览器无法保存外观偏好，本次切换仍然有效。');
    }
  }
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === null) apply(parseTheme(event.newValue));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return (
    <ThemeContext.Provider value={{ theme, selectTheme, warning }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemePicker() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('ThemeProvider is required');
  return (
    <fieldset className="theme-picker">
      <legend>界面风格</legend>
      <p className="muted">
        随时切换，不影响任务、存档和成长。外观偏好仅保存在本浏览器，清除个人记录时保留。
      </p>
      <div className="theme-options">
        {(
          [
            ['daily', '简约日常', '纸白与松绿，轻松记录每一天。'],
            ['pixel', '复古像素 RPG', '像素边框、冒险面板，开启现实支线。'],
          ] as const
        ).map(([value, title, description]) => (
          <label className={`theme-option theme-preview-${value}`} key={value}>
            <span className="theme-swatch" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="theme-option-title">
              <input
                type="radio"
                name="theme"
                value={value}
                checked={context.theme === value}
                onChange={() => context.selectTheme(value)}
              />
              {title}
            </span>
            <span className="muted">{description}</span>
          </label>
        ))}
      </div>
      <p role="status">
        {context.warning || `当前风格：${context.theme === 'pixel' ? '复古像素 RPG' : '简约日常'}`}
      </p>
    </fieldset>
  );
}

/** Original code-native pixel landscape; decorative, no network assets or animation. */
export function PixelScene() {
  return (
    <div className="pixel-scene" aria-hidden="true">
      <span className="pixel-scene-label">SIDEQUEST / WORLD 01</span>
      <svg viewBox="0 0 320 128" shapeRendering="crispEdges" focusable="false">
        <path fill="#f1d58a" d="M252 16h16v4h4v16h-4v4h-16v-4h-4V20h4z" />
        <path fill="#93b4cd" d="M26 24h4v4h-4zM130 12h4v4h-4zM206 38h4v4h-4zM290 62h4v4h-4z" />
        <path
          fill="#344769"
          d="M0 88h24V72h16V56h16v16h16v16h24V72h24V48h16V32h16v16h16v24h24v16h24V68h16V52h16v16h16v20h24v-8h24v48H0z"
        />
        <path fill="#46746c" d="M0 104h32V92h32v8h32V88h40v8h48v12h40V96h40v8h56v24H0z" />
        <path fill="#8bbd83" d="M0 120h124v-8h48v8h148v8H0z" />
        <path fill="#d8b67b" d="M140 104h20v8h12v8h16v8h-64v-8h8v-8h8z" />
        <path fill="#f0dba8" d="M146 74h12v12h-12z" />
        <path fill="#ef9978" d="M142 86h20v14h-20z" />
        <path fill="#192a3c" d="M142 100h8v8h-8zM154 100h8v8h-8z" />
        <path
          fill="#8bbd83"
          d="M44 88h8v-8h8v-8h8v8h8v8h8v8H44zM260 100h8v-8h8v-8h8v8h8v8h8v8h-40z"
        />
      </svg>
      <span className="pixel-scene-caption">你的下一段冒险，就在日常之外。</span>
    </div>
  );
}
