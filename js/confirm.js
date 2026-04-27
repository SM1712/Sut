/**
 * CONFIRM — diálogo de confirmación elegante.
 * Reemplaza window.confirm() para acciones destructivas con una UI consistente.
 *
 * Uso: const ok = await confirmDialog({ title, text, confirmText, danger: true });
 */

let _host = null;

const ensureHost = () => {
  if (_host) return _host;
  _host = document.createElement('div');
  _host.className = 'confirm-host';
  document.body.appendChild(_host);
  return _host;
};

/**
 * @param {object} opts
 * @param {string} opts.title       Título del diálogo
 * @param {string} [opts.text]      Texto descriptivo
 * @param {string} [opts.confirmText='Eliminar']  Texto del botón principal
 * @param {string} [opts.cancelText='Cancelar']   Texto del botón secundario
 * @param {boolean}[opts.danger=true]  Usa estilo destructivo (rojo)
 * @param {string} [opts.icon]      'trash' (default), 'warn', 'info'
 * @returns {Promise<boolean>}
 */
export const confirmDialog = ({
  title,
  text = '',
  confirmText = 'Eliminar',
  cancelText  = 'Cancelar',
  danger = true,
  icon = 'trash',
} = {}) => new Promise(resolve => {
  const host = ensureHost();

  const ICONS = {
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>`,
    warn:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>`,
    info:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>`,
  };

  const overlay = document.createElement('div');
  overlay.className = 'confirm' + (danger ? ' confirm--danger' : '');
  overlay.innerHTML = `
    <div class="confirm__backdrop" data-cancel></div>
    <div class="confirm__panel" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div class="confirm__icon">${ICONS[icon] || ICONS.trash}</div>
      <h2 class="confirm__title" id="confirm-title">${title}</h2>
      ${text ? `<p class="confirm__text">${text}</p>` : ''}
      <div class="confirm__actions">
        <button type="button" class="btn btn--ghost" data-cancel>${cancelText}</button>
        <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-ok autofocus>${confirmText}</button>
      </div>
    </div>
  `;
  host.appendChild(overlay);
  document.body.style.overflow = 'hidden';

  const cleanup = (result) => {
    overlay.classList.add('is-leaving');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      overlay.remove();
      if (!host.children.length) document.body.style.overflow = '';
    }, 180);
    resolve(result);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') cleanup(false);
    if (e.key === 'Enter')  cleanup(true);
  };
  overlay.addEventListener('click', (e) => {
    if (e.target.closest('[data-cancel]')) cleanup(false);
    if (e.target.closest('[data-ok]'))     cleanup(true);
  });
  document.addEventListener('keydown', onKey);

  // foco al botón principal
  setTimeout(() => overlay.querySelector('[data-ok]')?.focus(), 50);
});
