import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { App } from '../App';
import { AuthProvider, type UserRole } from '../state/authContext';
import { PortalStateProvider } from '../state/PortalStateProvider';

/** Renders the whole portal at a given route, with persistence wired up. */
export function renderApp(initialPath = '/', initialRole: UserRole = 'admin'): RenderResult {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider initialRole={initialRole}>
        <PortalStateProvider>
          <App />
        </PortalStateProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Renders a single component inside the router and state providers. */
export function renderWithRouter(
  ui: ReactElement,
  initialPath = '/',
  initialRole: UserRole = 'admin',
): RenderResult {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider initialRole={initialRole}>
        <PortalStateProvider>{ui}</PortalStateProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}
