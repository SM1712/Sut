/**
 * ONBOARDING — guía animada paso a paso.
 * Se muestra automáticamente la primera vez y bajo demanda
 * desde el botón "Mostrar guía rápida" en settings.
 */

import { store } from './store.js';
import { $, $$ } from './utils.js';

const root = $('#onboarding');
const dotsRoot = $('#ob-dots');
const progressBar = $('#ob-progress');
const slides = () => $$('.ob-slide');

let current = 0;

const buildDots = () => {
  dotsRoot.innerHTML = '';
  slides().forEach((_, i) => {
    const s = document.createElement('span');
    if (i === 0) s.classList.add('is-active');
    s.addEventListener('click', () => goTo(i));
    dotsRoot.appendChild(s);
  });
};

const updateProgress = () => {
  const total = slides().length;
  progressBar.style.setProperty('--progress', `${((current + 1) / total) * 100}%`);
};

const goTo = (i) => {
  const all = slides();
  if (i < 0 || i >= all.length) return;
  const prev = all[current];
  const next = all[i];
  prev.classList.remove('is-active');
  prev.classList.add('is-leaving');
  setTimeout(() => prev.classList.remove('is-leaving'), 220);
  next.classList.add('is-active');
  current = i;

  $$('#ob-dots span').forEach((d, idx) => d.classList.toggle('is-active', idx === current));
  updateProgress();

  // Texto del botón
  const btn = $('#ob-next');
  if (current === slides().length - 1) {
    btn.querySelector('span') ? null : null;
    btn.innerHTML = `Empezar
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
  } else {
    btn.innerHTML = `Siguiente
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
  }
};

export const showOnboarding = () => {
  current = 0;
  slides().forEach((s, i) => s.classList.toggle('is-active', i === 0));
  buildDots();
  updateProgress();
  root.hidden = false;
};

export const hideOnboarding = () => {
  root.hidden = true;
  store.setOnboarded(true);
};

export const initOnboarding = (onFinish) => {
  $('#ob-next')?.addEventListener('click', () => {
    if (current >= slides().length - 1) {
      hideOnboarding();
      onFinish?.();
    } else {
      goTo(current + 1);
    }
  });
  $('#ob-skip')?.addEventListener('click', () => {
    hideOnboarding();
    onFinish?.();
  });

  // Permite cerrar con Escape
  document.addEventListener('keydown', (e) => {
    if (!root.hidden && e.key === 'Escape') {
      hideOnboarding();
      onFinish?.();
    }
    if (!root.hidden && (e.key === 'ArrowRight' || e.key === 'Enter')) {
      $('#ob-next')?.click();
    }
    if (!root.hidden && e.key === 'ArrowLeft') {
      goTo(current - 1);
    }
  });
};
