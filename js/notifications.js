/**
 * NOTIFICATIONS — alertas de vencimiento en tiempo real.
 * Usa setTimeout para la sesión activa y marca tareas como "notificadas"
 * para no repetir en la misma sesión.
 */

import { store } from './store.js';
import { parseDue } from './utils.js';
import { toast } from './toasts.js';

const scheduled = new Map(); // taskId → timeoutId

const scheduleOne = (task) => {
  if (!task.reminder || task.done) return;
  const due = parseDue(task.dueDate, task.dueTime);
  if (!due) return;
  const reminderMs = Number(task.reminder) * 60000;
  const fireAt = due.getTime() - reminderMs;
  const delay = fireAt - Date.now();

  if (delay <= 0) return; // ya pasó
  if (delay > 48 * 3600 * 1000) return; // más de 48h: no vale la pena un timeout

  if (scheduled.has(task.id)) {
    clearTimeout(scheduled.get(task.id));
  }

  const tid = setTimeout(() => {
    if (!task.done) {
      const label = task.reminder === '0'
        ? 'Vence ahora'
        : `Vence en ${task.reminder < 60 ? task.reminder + ' min' : Math.round(task.reminder / 60) + ' h'}`;
      toast(`⏰ ${task.title} — ${label}`, { type: 'warn', duration: 8000 });

      // Permiso de notificación del navegador
      if (Notification.permission === 'granted') {
        new Notification('SUT — Recordatorio', { body: `${task.title}\n${label}`, icon: 'assets/icon.svg' });
      }
    }
    scheduled.delete(task.id);
  }, delay);

  scheduled.set(task.id, tid);
};

const rescheduleAll = () => {
  // Cancelar los pendientes
  scheduled.forEach(id => clearTimeout(id));
  scheduled.clear();
  // Agendar todos los activos
  store.state.tasks.filter(t => !t.done).forEach(scheduleOne);
};

export const initNotifications = () => {
  // Solicitar permiso al entrar
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  rescheduleAll();

  // Reagendar cuando cambia el estado
  store.on('change', rescheduleAll);
};
