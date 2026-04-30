import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/variables.css';
import './styles/base.css';
import './styles/animations.css';
import './styles/components.css';
import { useStore } from './store';
import { initSync, initAuth } from './store/sync';

/* ── Bootstrap ── */
const store = useStore.getState();

// Apply persisted theme/settings immediately to avoid flash
store.applyTheme(store.settings);

// Seed sample data on fresh start
store.seedSampleIfEmpty();

// Init Firebase sync + auth
initSync();
initAuth(
  (user) => {
    useStore.setState(s => ({
      meta: { ...s.meta, uid: user.uid, email: user.email, displayName: user.displayName },
    }));
  },
  () => {
    // Only clear auth credentials — keep spaceId, history, and local data intact
    useStore.getState().clearAuth();
  },
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
