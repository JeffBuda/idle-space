import { useState, useEffect } from 'react';
import { initDB } from './db';
import { IOSInstallBanner } from './IOSInstallBanner';
import './App.css';

const App = () => {
  const [swStatus, setSwStatus] = useState<'Active' | 'Inactive'>('Inactive');
  const [dbStatus, setDbStatus] = useState<'Connected' | 'Disconnected'>(
    'Disconnected'
  );
  const [installReady, setInstallReady] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // ---- Service Worker registration status ----
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const sw = navigator.serviceWorker;

      const updateStatus = () => {
        setSwStatus(sw.controller ? 'Active' : 'Inactive');
      };

      // Check immediately
      updateStatus();

      // Listen for controller changes
      sw.addEventListener('controllerchange', updateStatus);

      // Fallback: poll every second for up to 5 seconds
      const interval = setInterval(updateStatus, 1000);

      return () => {
        sw.removeEventListener('controllerchange', updateStatus);
        clearInterval(interval);
      };
    }
  }, []);

  // ---- IndexedDB persistence status ----
  useEffect(() => {
    initDB()
      .then(() => setDbStatus('Connected'))
      .catch(() => setDbStatus('Disconnected'));
  }, []);

  // ---- PWA installation readiness ----
  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    setInstallReady('serviceWorker' in navigator && manifestLink !== null);
  }, []);

  // ---- Time-delta placeholder (pure state updates) ----
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Space Exploration Idle PWA</h1>
      </header>

      <main>
        <section className="status-card">
          <h2>Application Status</h2>
          <div className="status-item">
            <span className="label">Service Worker</span>
            <span data-testid="sw-status" className="value">
              {swStatus}
            </span>
          </div>
          <div className="status-item">
            <span className="label">IndexedDB</span>
            <span data-testid="db-status" className="value">
              {dbStatus}
            </span>
          </div>
          <div className="status-item">
            <span className="label">Install Ready</span>
            <span data-testid="install-status" className="value">
              {installReady ? 'Yes' : 'No'}
            </span>
          </div>
        </section>

        <section className="time-delta">
          <h2>Engine</h2>
          <p>
            Elapsed time:{' '}
            <span data-testid="elapsed-time">{elapsedSeconds}</span>s
          </p>
        </section>
      </main>

      {/* iOS "Add to Home Screen" install banner — globally visible on the landing page shell */}
      <IOSInstallBanner />
    </div>
  );
};

export default App;
