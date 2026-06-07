import { useNavigate } from 'react-router-dom';
import { HomeIcon } from '@/components/icons';

const Home = () => {
  const navigate = useNavigate();

  const hubs = [
    {
      title: 'Billing & Invoicing',
      icon: '📄',
      description: 'Generate new patient invoices and customize your clinic billing layout.',
      features: ['Invoice Generator', 'Layout Customizer'],
      path: '/invoice-generator',
      color: 'from-blue-500 to-indigo-600',
      bgLight: 'bg-blue-50',
      border: 'border-blue-100',
    },
    {
      title: 'Clinic Management',
      icon: '📈',
      description: 'Track your revenue, analyze performance reports, and manage clinic inventory.',
      features: ['Finances', 'Analytics Reports', 'Stock Inventory'],
      path: '/finances',
      color: 'from-emerald-500 to-teal-600',
      bgLight: 'bg-emerald-50',
      border: 'border-emerald-100',
    },
    {
      title: 'Patient Database',
      icon: '🔍',
      description: 'Search through existing patient records and view comprehensive treatment history.',
      features: ['Patient Search', 'Treatment Records'],
      path: '/database-find',
      color: 'from-purple-500 to-fuchsia-600',
      bgLight: 'bg-purple-50',
      border: 'border-purple-100',
    },
    {
      title: 'Configuration',
      icon: '⚙️',
      description: 'Configure application settings, database location, and clinical presets.',
      features: ['App Settings', 'Diagnosis Presets', 'Treatment Presets'],
      path: '/settings',
      color: 'from-slate-600 to-slate-800',
      bgLight: 'bg-slate-50',
      border: 'border-slate-200',
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in zoom-in-95 duration-500">
      
      {/* Premium Hero Header */}
      <header className="relative bg-white/80 backdrop-blur-2xl rounded-3xl shadow-xl shadow-slate-200/50 p-10 mb-10 border border-white overflow-hidden">
        {/* Decorative background blobs */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-blue-100/50 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-emerald-100/50 blur-3xl pointer-events-none" />
        
        <div className="relative flex items-center gap-6">
          <div className="p-4 bg-linear-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
            <HomeIcon width={40} height={40} />
          </div>
          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-slate-800 to-slate-600 tracking-tight mb-2">
              Shree Ram Physiotherapy
            </h1>
            <p className="text-slate-500 text-lg sm:text-xl font-medium">
              Clinic Management & Invoicing System
            </p>
          </div>
        </div>
      </header>

      {/* Main Hub Grid */}
      <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {hubs.map((hub) => (
          <div
            key={hub.path}
            onClick={() => navigate(hub.path)}
            className={`relative bg-white/60 backdrop-blur-lg rounded-3xl shadow-lg hover:shadow-2xl hover:shadow-slate-300/50 transition-all duration-500 cursor-pointer group border border-white overflow-hidden flex flex-col`}
          >
            {/* Top Color Bar */}
            <div className={`h-2 w-full bg-linear-to-r ${hub.color} absolute top-0 left-0 transition-transform origin-left group-hover:scale-y-150 duration-300`} />
            
            <div className="p-8 flex-1 flex flex-col">
              <div className="flex items-start justify-between mb-6">
                <div className={`w-16 h-16 rounded-2xl ${hub.bgLight} ${hub.border} border flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                  {hub.icon}
                </div>
                <div className="text-slate-300 group-hover:text-slate-400 transition-colors">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
              
              <h2 className="text-3xl font-bold text-slate-800 mb-3 tracking-tight">
                {hub.title}
              </h2>
              
              <p className="text-slate-600 text-lg mb-6 flex-1">
                {hub.description}
              </p>
              
              {/* Feature Pills */}
              <div className="flex flex-wrap gap-2 mt-auto">
                {hub.features.map(feature => (
                  <span key={feature} className="px-3 py-1 bg-white border border-slate-100 text-slate-500 text-sm font-medium rounded-full shadow-xs">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
};

export default Home;
