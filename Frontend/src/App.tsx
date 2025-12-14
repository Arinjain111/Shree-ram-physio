import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import InvoiceGenerator from './pages/InvoiceGenerator';
import DatabaseFind from './pages/DatabaseFind';
import InvoiceCustomizer from './pages/InvoiceCustomizer';
import TreatmentSettings from './pages/TreatmentSettings';

function App() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100">
      <div className="px-4 py-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/invoice-generator" element={<InvoiceGenerator />} />
          <Route path="/invoice-customizer" element={<InvoiceCustomizer />} />
          <Route path="/database-find" element={<DatabaseFind />} />
          <Route path="/treatment-settings" element={<TreatmentSettings />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
