import { useEffect } from 'react';
import { useStore } from '../store';

export const useTheme = () => {
  const settings = useStore(s => s.settings);
  const applyTheme = useStore(s => s.applyTheme);

  useEffect(() => {
    applyTheme(settings);
  }, [settings, applyTheme]);

  return settings;
};
