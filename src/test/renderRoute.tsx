import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { App } from '../App';
import { PortalStateProvider } from '../state/PortalStateProvider';

/** Renders the whole portal at a given route, with persistence wired up. */
export function renderApp(initialPath = '/'): RenderResult {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <PortalStateProvider>
        <App />
      </PortalStateProvider>
    </MemoryRouter>,
  );
}

/** Renders a single component inside the router and state providers. */
export function renderWithRouter(ui: ReactElement, initialPath = '/'): RenderResult {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <PortalStateProvider>{ui}</PortalStateProvider>
    </MemoryRouter>,
  );
}
