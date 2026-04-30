import type { Priority, EventType } from '../types';

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: 'var(--prio-urgent)',
  high: 'var(--prio-high)',
  medium: 'var(--prio-medium)',
  low: 'var(--prio-low)',
};

export const EVENT_TYPES: Record<EventType, { label: string; color: string; emoji: string }> = {
  exam:         { label: 'Examen',          color: '#EF4444', emoji: '📝' },
  presentation: { label: 'Exposición',      color: '#F59E0B', emoji: '🎤' },
  project:      { label: 'Entrega',         color: '#8B5CF6', emoji: '📦' },
  break:        { label: 'Descanso',        color: '#22C55E', emoji: '☕' },
  holiday:      { label: 'Feriado',         color: '#0EA5E9', emoji: '🎉' },
  meeting:      { label: 'Reunión',         color: '#EC4899', emoji: '👥' },
  custom:       { label: 'Personalizado',   color: '#6E5BFF', emoji: '⭐' },
};

export const ACCENT_COLORS = [
  '#4F6BFF', '#6E5BFF', '#8B5CF6', '#EC4899',
  '#EF4444', '#F59E0B', '#22C55E', '#10B981',
  '#0EA5E9', '#06B6D4', '#F97316', '#84CC16',
];

export const EVENT_COLORS = [
  '#EF4444', '#F59E0B', '#22C55E', '#0EA5E9',
  '#8B5CF6', '#EC4899', '#6E5BFF', '#10B981', '#F97316',
];

export const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Manrope', label: 'Manrope' },
  { value: 'Plus Jakarta Sans', label: 'Plus Jakarta Sans' },
  { value: 'Lora', label: 'Lora' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono' },
  { value: 'system-ui', label: 'Sistema' },
];

export const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DAYS_LONG_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const STORAGE_KEY = 'sut.state.v2';
export const SETTINGS_KEY = 'sut.settings.v1';
