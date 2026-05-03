import { useState, useEffect } from 'react';
import TaskCelebration from './TaskCelebration';

export default function CelebrationManager() {
  const [visible, setVisible] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ title: string }>).detail;
      setTaskTitle(detail?.title || '');
      setVisible(true);
    };
    window.addEventListener('sut:task-completed', handler);
    return () => window.removeEventListener('sut:task-completed', handler);
  }, []);

  return (
    <TaskCelebration
      visible={visible}
      taskTitle={taskTitle}
      onDone={() => setVisible(false)}
    />
  );
}
