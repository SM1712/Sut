/**
 * useReminders — schedules browser Notification reminders for tasks.
 *
 * Strategy:
 *  - On each tasks change we scan all pending tasks with a `reminder` value,
 *    compute the fire time, and schedule a setTimeout only if NOT already scheduled.
 *  - Timers for tasks that were deleted/completed are cancelled individually.
 *  - We deliberately do NOT clear all timers on re-run — that caused a storm
 *    where a fired notification triggered upsertTask → tasks changed → all
 *    timers reset before they could fire.
 */
import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { parseDue } from '../lib/utils';

const POLL_MS = 60_000; // re-check every minute

export function useReminders() {
  const tasks      = useStore(s => s.tasks);
  // Keep a ref so timer callbacks always see the latest upsertTask without
  // being listed as a dependency (avoids re-triggering the scheduling effect).
  const upsertRef  = useRef(useStore.getState().upsertTask);
  const timerRefs  = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Keep upsertRef current without causing re-schedules
  useEffect(() => {
    upsertRef.current = useStore.getState().upsertTask;
  });

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const schedule = () => {
      const now = Date.now();

      // Build the set of keys that should currently have timers
      const validKeys = new Set<string>();

      tasks.forEach(task => {
        if (task.done || !task.dueDate || !task.reminder) return;

        const due = parseDue(task.dueDate, task.dueTime);
        if (!due) return;

        const reminderMs  = parseInt(task.reminder) * 60 * 1000;
        const fireAt      = due.getTime() - reminderMs;
        const msUntilFire = fireAt - now;
        const key         = `${task.id}-${task.reminder}`;

        validKeys.add(key);

        // Skip if already notified
        if (task.notified?.[key]) return;

        // Skip if more than 1 minute in the past (stale — user opened app late)
        if (msUntilFire < -60_000) return;

        // Don't schedule if timer already exists for this key
        if (timerRefs.current.has(key)) return;

        const delay = Math.max(0, msUntilFire);

        const timerId = setTimeout(() => {
          timerRefs.current.delete(key);

          // Re-check permission at fire time (user may have revoked it)
          if (Notification.permission !== 'granted') return;

          new Notification(`⏰ ${task.title}`, {
            body:   `Vence en ${task.reminder} minuto${parseInt(task.reminder) === 1 ? '' : 's'}.`,
            icon:   '/assets/icon.svg',
            badge:  '/assets/favicon.svg',
            tag:    key,
          });

          // Use the ref so we always have the latest upsertTask without
          // adding it as a dependency (which would clear timers on every mutation)
          upsertRef.current({
            id:       task.id,
            notified: { ...(task.notified || {}), [key]: true },
          });
        }, delay);

        timerRefs.current.set(key, timerId);
      });

      // Cancel timers for tasks that were completed, deleted, or had reminder removed
      for (const [key, timerId] of timerRefs.current) {
        if (!validKeys.has(key)) {
          clearTimeout(timerId);
          timerRefs.current.delete(key);
        }
      }
    };

    schedule();
    const interval = setInterval(schedule, POLL_MS);

    // On unmount only clear the poll interval — individual timers are managed above
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks]); // Only tasks, not upsertTask — see upsertRef pattern above
}
