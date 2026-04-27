/**
 * TOASTS — notificaciones efímeras en pantalla.
 * Soporta texto plano (por defecto) y HTML seguro (opt-in con html:true).
 */
import { $, escapeHTML } from './utils.js';

const root = $('#toaster');

const ICONS = {
  success: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M4 10l4 4 8-8"/><circle cx="10" cy="10" r="9" stroke-width="1.5" opacity="0.35"/></svg>`,
  danger:  `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="10" cy="10" r="9" stroke-width="1.5" opacity="0.35"/><path d="M10 6v5M10 14h.01"/></svg>`,
  warn:    `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M10 2L2 17h16L10 2z" stroke-width="1.5" opacity="0.35"/><path d="M10 8v4M10 14h.01"/></svg>`,
  info:    `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="10" cy="10" r="9" stroke-width="1.5" opacity="0.35"/><path d="M10 9v5M10 6h.01"/></svg>`,
};

export const toast = (message, { type = 'info', duration = 3200, html = false } = {}) => {
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  const iconHTML = ICONS[type] || '';
  el.innerHTML = `
    <span class="toast__icon" aria-hidden="true">${iconHTML}</span>
    <span class="toast__text">${html ? message : escapeHTML(message)}</span>
  `;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, duration);
};
