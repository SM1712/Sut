export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Theme = 'light' | 'dark' | 'system';
export type CalendarView = 'month' | 'week' | 'agenda';

export interface Task {
  id: string;
  title: string;
  description: string;
  instructions?: string;
  courseId: string;
  tagIds: string[];
  priority: Priority;
  escalating: boolean;
  dueDate: string;
  dueTime: string;
  reminder: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  notified: Record<string, boolean>;
  createdBy?: string | null;
  audioUrl?: string | null;
  imageUrls?: string[];
}

export interface Course {
  id: string;
  name: string;
  code: string;
  teacher: string;
  color: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Tag {
  id: string;
  name: string;
  category: string;
  color: string;
  defaultPriority: Priority | '';
  createdAt?: string;
  updatedAt?: string;
}

export type EventType = 'exam' | 'presentation' | 'project' | 'break' | 'holiday' | 'meeting' | 'custom';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  type: EventType;
  color: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
}

export interface SpaceHistoryEntry {
  code: string;
  name: string;
  joinedAt: string;
}

export interface Meta {
  createdAt: string;
  onboarded: boolean;
  spaceId: string | null;
  spaceName: string;
  spaceHistory: SpaceHistoryEntry[];
  uid: string | null;
  email: string | null;
  displayName?: string | null;
}

export interface Settings {
  theme: Theme;
  accentColor: string;
  buttonColor: string;
  textColor: string;
  fontFamily: string;
  fontScale: number;
  radius: number;
}

export interface AppState {
  version: number;
  tasks: Task[];
  courses: Course[];
  tags: Tag[];
  events: CalendarEvent[];
  meta: Meta;
}

export interface SpaceMember {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  joinedAt: string;
}

export interface Space {
  id: string;
  name: string;
  code: string;
  owner: string;
  createdAt: string;
  members: string[];
}

export type ToastType = 'success' | 'danger' | 'warn' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}
