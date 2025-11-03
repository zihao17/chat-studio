/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const THEME_STORAGE_KEY = 'chat-studio-theme';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * 主题上下文提供器
 * - 使用 useLayoutEffect 在浏览器绘制前同步主题状态（html.dark 与 UA 控件颜色方案），避免切换时出现先后不一致的视觉问题
 * - 将主题持久化到 localStorage
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getPreferred = (): Theme => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (saved === 'light' || saved === 'dark') return saved;
    } catch { /* noop: 读取本地存储失败时忽略 */ }
    // 默认亮色，不跟随系统
    return 'light';
  };

  const [theme, setTheme] = useState<Theme>(getPreferred);

  // 应用到 html.dark 并持久化（改为 useLayoutEffect，确保在绘制前完成）
  useLayoutEffect(() => {
    const root = document.documentElement;

    // 切换前：临时禁用全局过渡，避免多处元素不同步过渡导致的“错帧”感
    root.classList.add('theme-switching');

    // 同步 .dark 类与 UA 颜色方案
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';

    // 同步 <meta name="color-scheme">（可选）
    const meta = document.querySelector('meta[name="color-scheme"]') as HTMLMetaElement | null;
    if (meta) meta.content = theme === 'dark' ? 'dark' : 'light';

    // 在下一帧恢复过渡（确保主题变量与类名已全部生效后再允许动画）
    requestAnimationFrame(() => {
      root.classList.remove('theme-switching');
    });

    try {
      localStorage.setItem('chat-studio-theme', theme);
    } catch { /* noop: 本地存储不可用时忽略 */ }
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    isDark: theme === 'dark',
    setTheme,
    toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
