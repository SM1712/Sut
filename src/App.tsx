import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Layout from './components/layout/Layout';
import Dashboard from './views/Dashboard';
import TasksView from './views/TasksView';
import CalendarPageView from './views/CalendarPageView';
import CoursesView from './views/CoursesView';
import TagsView from './views/TagsView';
import StatsView from './views/StatsView';
import ToolsView from './views/ToolsView';
import PomodoroView from './views/PomodoroView';
import PDFConverterView from './views/PDFConverterView';
import { ToastProvider } from './components/ui/Toast';
import { useReminders } from './hooks/useReminders';

function AppInner() {
  useReminders(); // Schedule browser notification reminders for tasks

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/"          element={<Dashboard />} />
          <Route path="/tasks"     element={<TasksView />} />
          <Route path="/calendar"  element={<CalendarPageView />} />
          <Route path="/courses"   element={<CoursesView />} />
          <Route path="/tags"      element={<TagsView />} />
          <Route path="/stats"     element={<StatsView />} />
          <Route path="/tools"           element={<ToolsView />} />
          <Route path="/tools/pomodoro" element={<PomodoroView />} />
          <Route path="/tools/pdf"      element={<PDFConverterView />} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </Layout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
