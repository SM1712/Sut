/**
 * TOASTS — notificaciones efímeras en pantalla.
 */
import { $, escapeHTML } from './utils.js';

const root = $('#toaster');

export const toast = (message, { type = 'info', duration = 3200, icon } = {}) => {
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.innerHTML = `
    ${icon ? `<span aria-hidden="true">${icon}</span>` : ''}
    <span>${escapeHTML(message)}</span>
  `;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, duration);
};
