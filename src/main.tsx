import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { App } from './App';
import { AuthProvider } from './state/authContext';
import { PortalStateProvider } from './state/PortalStateProvider';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PortalStateProvider>
          <App />
        </PortalStateProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
