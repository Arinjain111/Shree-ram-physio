import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import InvoiceGenerator from './pages/InvoiceGenerator';
import DatabaseFind from './pages/DatabaseFind';
import InvoiceCustomizer from './pages/InvoiceCustomizer';
import TreatmentSettings from './pages/TreatmentSettings';
import Settings from './pages/Settings';
import Finances from './pages/Finances';
import Reports from './pages/Reports';
import Inventory from './pages/Inventory';
import UpdateBanner from './components/layout/UpdateBanner';
import HubLayout from './components/layout/HubLayout';

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-linear-to-br from-slate-50 to-slate-100">
      <UpdateBanner />
      <div className="px-4 py-4 flex-1">
        <Routes>
          <Route path="/" element={<Home />} />

          {/* Billing & Invoicing Hub */}
          <Route element={<HubLayout tabs={[
            { label: 'Generator', path: '/invoice-generator' },
            { label: 'Customizer', path: '/invoice-customizer' }
          ]} />}>
            <Route path="/invoice-generator" element={<InvoiceGenerator />} />
            <Route path="/invoice-customizer" element={<InvoiceCustomizer />} />
          </Route>

          {/* Clinic Management Hub */}
          <Route element={<HubLayout tabs={[
            { label: 'Finances', path: '/finances' },
            { label: 'Inventory', path: '/inventory' },
            { label: 'Reports', path: '/reports' }
          ]} />}>
            <Route path="/finances" element={<Finances />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/inventory" element={<Inventory />} />
          </Route>

          {/* Configuration Hub */}
          <Route element={<HubLayout tabs={[
            { label: 'App Settings', path: '/settings' },
            { label: 'Presets', path: '/treatment-settings' }
          ]} />}>
            <Route path="/settings" element={<Settings />} />
            <Route path="/treatment-settings" element={<TreatmentSettings />} />
          </Route>

          {/* Patient Database Hub (Single Tab for now) */}
          <Route element={<HubLayout tabs={[
            { label: 'Patient Search', path: '/database-find' }
          ]} />}>
            <Route path="/database-find" element={<DatabaseFind />} />
          </Route>
        </Routes>
      </div>
    </div>
  );
}

export default App;
