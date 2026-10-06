// Шрифты с кириллицей из fontsource.
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/600.css';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';

export const FONT_FAMILY: Record<'oswald' | 'rubik' | 'jetbrains', string> = {
  oswald: "'Oswald', 'Arial Narrow', sans-serif",
  rubik: "'Rubik', system-ui, sans-serif",
  jetbrains: "'JetBrains Mono', ui-monospace, monospace",
};
