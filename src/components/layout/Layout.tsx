import { useState, useEffect, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MobileNav from './MobileNav';
import SettingsDrawer from '../settings/SettingsDrawer';
import AccountPanel from '../account/AccountPanel';
import GlobalSearch from '../search/GlobalSearch';
import { ConfirmProvider } from '../ui/Confirm';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { useTheme } from '../../hooks/useTheme';

interface Props { children: ReactNode }

// Simple context-free way to register a "new task" callback per view via a custom event
export const dispatchNewTask = () => window.dispatchEvent(new CustomEvent('sut:new-task'));

export default function Layout({ children }: Props) {
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen]   = useState(false);
  const [searchOpen, setSearchOpen]     = useState(false);
  const isMobile = useIsMobile();
  useTheme();

  // Listen for global search open event (dispatched by Cmd+K handler in GlobalSearch)
  useEffect(() => {
    const handler = () => setSearchOpen(true);
    window.addEventListener('sut:search-open', handler);
    return () => window.removeEventListener('sut:search-open', handler);
  }, []);

  const handleNewTask = () => dispatchNewTask();

  return (
    <ConfirmProvider>
      <div className="app-shell">
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSettings={() => { setSidebarOpen(false); setSettingsOpen(true); }}
          isMobile={isMobile}
        />

        <div className="main-content">
          <TopBar
            onMenuToggle={() => setSidebarOpen(o => !o)}
            onSettings={() => setSettingsOpen(true)}
            onAccount={() => setAccountOpen(o => !o)}
            onSearch={() => setSearchOpen(true)}
            onNewTask={handleNewTask}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        </div>

        {/* Mobile FAB — always on top of bottom nav */}
        {isMobile && (
          <button className="fab" onClick={handleNewTask} aria-label="Nueva tarea">
            <Plus size={26} />
          </button>
        )}

        <MobileNav />
        <SettingsDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <AccountPanel open={accountOpen} onClose={() => setAccountOpen(false)} />
        <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    </ConfirmProvider>
  );
}
