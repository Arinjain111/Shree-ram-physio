import { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import UpdateBanner from './components/layout/UpdateBanner';
import HubLayout from './components/layout/HubLayout';
import PageLoader from './components/layout/PageLoader';

// Each page is split into its own JS chunk by Vite/Rollup. On first
// navigation React.lazy() throws a Promise while the chunk is being
// fetched/parsed; the nearest <Suspense> (PageLoader) catches it and
// shows the PageSkeleton. Subsequent navigations to the same page are
// instant because the chunk is cached by the module system.
const Home = lazy(() => import('./pages/Home'));
const InvoiceGenerator = lazy(() => import('./pages/InvoiceGenerator'));
const DatabaseFind = lazy(() => import('./pages/DatabaseFind'));
const InvoiceCustomizer = lazy(() => import('./pages/InvoiceCustomizer'));
const TreatmentSettings = lazy(() => import('./pages/TreatmentSettings'));
const Settings = lazy(() => import('./pages/Settings'));
const Finances = lazy(() => import('./pages/Finances'));
const Reports = lazy(() => import('./pages/Reports'));
const Inventory = lazy(() => import('./pages/Inventory'));

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-linear-to-br from-slate-50 to-slate-100">
      <UpdateBanner />
      <div className="px-4 flex-1">
        <Routes>
          <Route path="/" element={<PageLoader><Home /></PageLoader>} />

          {/* Billing & Invoicing Hub */}
          <Route element={<HubLayout tabs={[
            { label: 'Generator', path: '/invoice-generator' },
            { label: 'Customizer', path: '/invoice-customizer' }
          ]} />}>
            <Route path="/invoice-generator" element={<PageLoader><InvoiceGenerator /></PageLoader>} />
            <Route path="/invoice-customizer" element={<PageLoader><InvoiceCustomizer /></PageLoader>} />
          </Route>

          {/* Clinic Management Hub */}
          <Route element={<HubLayout tabs={[
            { label: 'Finances', path: '/finances' },
            { label: 'Inventory', path: '/inventory' },
            { label: 'Reports', path: '/reports' }
          ]} />}>
            <Route path="/finances" element={<PageLoader><Finances /></PageLoader>} />
            <Route path="/reports" element={<PageLoader><Reports /></PageLoader>} />
            <Route path="/inventory" element={<PageLoader><Inventory /></PageLoader>} />
          </Route>

          {/* Configuration Hub */}
          <Route element={<HubLayout tabs={[
            { label: 'App Settings', path: '/settings' },
            { label: 'Presets', path: '/treatment-settings' }
          ]} />}>
            <Route path="/settings" element={<PageLoader><Settings /></PageLoader>} />
            <Route path="/treatment-settings" element={<PageLoader><TreatmentSettings /></PageLoader>} />
          </Route>

          {/* Patient Database Hub (Single Tab for now) */}
          <Route element={<HubLayout tabs={[
            { label: 'Patient Search', path: '/database-find' }
          ]} />}>
            <Route path="/database-find" element={<PageLoader><DatabaseFind /></PageLoader>} />
          </Route>
        </Routes>
      </div>
    </div>
  );
}

export default App;
