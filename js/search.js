/**
 * SEARCH — barra de búsqueda global con atajo "/".
 */

import { $, debounce } from './utils.js';
import { renderDashboardTasks, renderTasksList } from './tasks.js';

export const initSearch = (getCurrentView) => {
  const input = $('#search-input');
  if (!input) return;

  // Atajo "/" para enfocar
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== input && !e.target.matches('input, textarea')) {
      e.preventDefault();
      input.focus();
      input.select();
    }
    if (e.key === 'Escape' && document.activeElement === input) {
      input.blur();
      input.value = '';
      onSearch('');
    }
  });

  const onSearch = debounce((q) => {
    const view = getCurrentView();
    if (view === 'dashboard') renderDashboardTasks(q);
    if (view === 'tasks') renderTasksList(q);
  }, 200);

  input.addEventListener('input', (e) => onSearch(e.target.value.trim()));
};
