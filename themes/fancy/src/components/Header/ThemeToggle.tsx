// Theme toggle button for switching between light and dark modes

import { useTheme } from '../../hooks';
import { useTranslation } from '../../context/I18nContext';
import { Button, SunIcon, MoonIcon } from '../UI';

export function ThemeToggle() {
  const [theme, toggleTheme] = useTheme();
  const t = useTranslation();

  // Show the icon for the mode we'll switch TO
  const Icon = theme === 'dark' ? SunIcon : MoonIcon;
  const label = theme === 'dark' ? t('action.switch_to_light') : t('action.switch_to_dark');

  return (
    <Button
      variant="icon"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      <Icon />
    </Button>
  );
}
