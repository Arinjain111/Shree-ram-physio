import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import InvoiceGenerator from './pages/InvoiceGenerator';
import DatabaseFind from './pages/DatabaseFind';
import InvoiceCustomizer from './pages/InvoiceCustomizer';
import TreatmentSettings from './pages/TreatmentSettings';
import Settings from './pages/Settings';
import UpdateBanner from './components/layout/UpdateBanner';

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-linear-to-br from-slate-50 to-slate-100">
      <UpdateBanner />
      <div className="px-4 py-4 flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/invoice-generator" element={<InvoiceGenerator />} />
          <Route path="/invoice-customizer" element={<InvoiceCustomizer />} />
          <Route path="/database-find" element={<DatabaseFind />} />
          <Route path="/treatment-settings" element={<TreatmentSettings />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
