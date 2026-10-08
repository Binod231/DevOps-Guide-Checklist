import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Breadcrumb } from './components/Breadcrumb';
import { Header } from './components/Header';
import { SearchDialog } from './components/SearchDialog';
import { SidebarNav } from './components/SidebarNav';
import { ROUTES, guide } from './content/registry';
import { useTheme } from './state/useTheme';
import { useFocusTrap } from './state/useFocusTrap';
import { GuideCategoryPage } from './pages/GuideCategoryPage';
import { ImplementationOrderPage } from './pages/ImplementationOrderPage';
import { NotesPage } from './pages/NotesPage';
import { OverviewPage } from './pages/OverviewPage';
import { ProductionReadinessPage } from './pages/ProductionReadinessPage';
import { TrackerPage } from './pages/TrackerPage';

export function App() {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the mobile drawer on navigation so the reader lands on the content.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Cmd/Ctrl-K opens search from anywhere.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Escape closes the drawer, matching the search dialog's behaviour.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // The drawer is a modal overlay below `lg`, so trap focus while it is open.
  const sidebarRef = useRef<HTMLElement>(null);
  useFocusTrap(sidebarOpen, sidebarRef);

  return (
    <div className="min-h-screen bg-canvas">
      <a href="#portal-main" className="portal-skip-link">
        Skip to main content
      </a>

      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        sidebarOpen={sidebarOpen}
        onOpenSearch={() => setSearchOpen(true)}
      />

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />

      <div className="lg:flex">
        {/* Scrim behind the mobile drawer. */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        <aside
          ref={sidebarRef}
          id="portal-sidebar"
          className={[
            'border-edge bg-surface',
            'fixed inset-y-0 left-0 z-40 w-72 overflow-y-auto border-r',
            sidebarOpen ? 'block' : 'hidden',
            'lg:sticky lg:top-[57px] lg:z-0 lg:block lg:h-[calc(100vh-57px)] lg:shrink-0',
          ].join(' ')}
        >
          <SidebarNav onNavigate={closeSidebar} />
        </aside>

        <div className="min-w-0 flex-1">
          <Breadcrumb />
          <main id="portal-main" tabIndex={-1}>
            <Routes>
              <Route path={ROUTES.overview} element={<OverviewPage />} />
              <Route path="/guide/:categoryId" element={<GuideCategoryPage />} />
              <Route
                path="/guide"
                element={<Navigate to={ROUTES.guideCategory(guide.categories[0]!.id)} replace />}
              />
              <Route path={ROUTES.implementationOrder} element={<ImplementationOrderPage />} />
              <Route path={ROUTES.productionReadiness} element={<ProductionReadinessPage />} />
              <Route path={ROUTES.notes} element={<NotesPage />} />
              <Route path={ROUTES.tracker} element={<TrackerPage />} />
              <Route path="*" element={<Navigate to={ROUTES.overview} replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}
