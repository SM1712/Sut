/**
 * THEME — aplica settings al :root, abre y cierra el drawer
 * de personalización, gestiona color/tipografía/escala/radio.
 */

import { store } from './store.js';
import { $, $$, hexToHSL } from './utils.js';

const ACCENT_COLORS = [
  '#4F6BFF', '#6E5BFF', '#0EA5E9', '#06B6D4', '#10B981',
  '#22C55E', '#EAB308', '#F59E0B', '#EF4444', '#EC4899',
  '#8B5CF6', '#0F172A',
];

const TEXT_COLORS = [
  '', '#0F172A', '#1E293B', '#334155', '#0E7490',
  '#7C2D12', '#581C87', '#9F1239',
];

const root = document.documentElement;

/* ---- Aplica los settings al DOM ---- */
export const applyAllSettings = () => {
  const s = store.settings;

  // Tema
  root.dataset.theme = s.theme || 'light';

  // Acento (HSL)
  if (s.accentColor) {
    const { h, s: ss, l } = hexToHSL(s.accentColor);
    root.style.setProperty('--accent-h', h);
    root.style.setProperty('--accent-s', `${ss}%`);
    root.style.setProperty('--accent-l', `${l}%`);
  }

  // Color de botones (independiente)
  if (s.buttonColor) {
    root.style.setProperty('--button-color', s.buttonColor);
    const { h, s: ss, l } = hexToHSL(s.buttonColor);
    root.style.setProperty('--button-color-strong', `hsl(${h} ${ss}% ${Math.max(0, l - 8)}%)`);
  } else {
    root.style.removeProperty('--button-color');
    root.style.removeProperty('--button-color-strong');
  }

  // Color de texto custom
  if (s.textColor) {
    root.style.setProperty('--text', s.textColor);
  } else {
    root.style.removeProperty('--text');
  }

  // Tipografía
  if (s.fontFamily) {
    const stack = s.fontFamily === 'system-ui'
      ? "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
      : `'${s.fontFamily}', system-ui, sans-serif`;
    root.style.setProperty('--font-sans', stack);
  }

  // Escala de fuente
  root.style.setProperty('--font-scale', s.fontScale || 1);

  // Radio
  root.style.setProperty('--radius', `${s.radius || 14}px`);
};

/* ---- Pinta el panel de personalización ---- */
const buildSwatches = (container, colors, settingKey, currentValue) => {
  container.innerHTML = '';
  colors.forEach(c => {
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'color-swatch' + (c === currentValue ? ' is-selected' : '');
    sw.style.setProperty('--c', c || 'transparent');
    if (c === '') {
      sw.title = 'Predeterminado';
      sw.style.background = 'repeating-conic-gradient(#cbd5e1 0% 25%, transparent 0% 50%) 50%/12px 12px';
    } else {
      sw.title = c;
    }
    sw.addEventListener('click', () => {
      store.setSetting(settingKey, c);
      applyAllSettings();
      buildSwatches(container, colors, settingKey, c);
    });
    container.appendChild(sw);
  });
};

const setupSettingsPanel = () => {
  // Tema
  $$('input[name="theme"]').forEach(r => {
    r.checked = r.value === store.settings.theme;
    r.addEventListener('change', () => {
      store.setSetting('theme', r.value);
      applyAllSettings();
    });
  });

  // Color principal
  buildSwatches($('#accent-picker'), ACCENT_COLORS, 'accentColor', store.settings.accentColor);
  buildSwatches($('#button-picker'), ACCENT_COLORS, 'buttonColor', store.settings.buttonColor);
  buildSwatches($('#text-picker'), TEXT_COLORS, 'textColor', store.settings.textColor);

  // Tipografía
  $$('.font-pick').forEach(b => {
    if (b.dataset.font === store.settings.fontFamily) b.classList.add('is-selected');
    b.addEventListener('click', () => {
      $$('.font-pick').forEach(x => x.classList.remove('is-selected'));
      b.classList.add('is-selected');
      store.setSetting('fontFamily', b.dataset.font);
      applyAllSettings();
    });
  });

  // Tamaño de fuente
  const slider = $('#font-size-slider');
  const hint = $('#font-size-hint');
  const updateSize = (v) => {
    slider.value = v;
    hint.textContent = `${Math.round(v * 100)}%`;
    $$('.size-pick').forEach(b => b.classList.toggle('is-selected', Number(b.dataset.size) === Number(v)));
  };
  updateSize(store.settings.fontScale);
  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    store.setSetting('fontScale', v);
    applyAllSettings();
    updateSize(v);
  });
  $$('.size-pick').forEach(b => {
    b.addEventListener('click', () => {
      const v = Number(b.dataset.size);
      store.setSetting('fontScale', v);
      applyAllSettings();
      updateSize(v);
    });
  });

  // Radio
  const rad = $('#radius-slider');
  rad.value = store.settings.radius;
  rad.addEventListener('input', () => {
    store.setSetting('radius', Number(rad.value));
    applyAllSettings();
  });
};

/* ---- Toggle claro/oscuro rápido ---- */
export const toggleTheme = () => {
  const t = store.settings.theme;
  let next;
  if (t === 'light') next = 'dark';
  else if (t === 'dark') next = 'light';
  else next = 'light';
  store.setSetting('theme', next);
  applyAllSettings();
  // refleja en panel si está abierto
  const r = document.querySelector(`input[name="theme"][value="${next}"]`);
  if (r) r.checked = true;
};

/* ---- Drawer ---- */
const drawer = $('#settings-drawer');

export const openSettings = () => {
  drawer.hidden = false;
  document.body.style.overflow = 'hidden';
};
export const closeSettings = () => {
  drawer.hidden = true;
  document.body.style.overflow = '';
};

export const initTheme = () => {
  applyAllSettings();
  setupSettingsPanel();

  // Reactividad cuando cambian settings desde fuera
  store.on('settings:change', () => {
    // Reflejar valores actuales en controles si existe el panel
    $$('input[name="theme"]').forEach(r => r.checked = r.value === store.settings.theme);
    buildSwatches($('#accent-picker'), ACCENT_COLORS, 'accentColor', store.settings.accentColor);
    buildSwatches($('#button-picker'), ACCENT_COLORS, 'buttonColor', store.settings.buttonColor);
    buildSwatches($('#text-picker'), TEXT_COLORS, 'textColor', store.settings.textColor);
  });

  // Cierre del drawer
  drawer?.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) closeSettings();
  });

  // Atajos
  $('#open-settings')?.addEventListener('click', openSettings);
  $('#theme-toggle')?.addEventListener('click', toggleTheme);
};
