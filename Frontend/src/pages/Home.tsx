import { useNavigate } from 'react-router-dom';
import { HomeIcon } from '@/components/icons';
import { DocumentTextIcon, ChartBarIcon, UsersIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

const Home = () => {
  const navigate = useNavigate();

  const hubs = [
    {
      title: 'Billing & Invoicing',
      icon: DocumentTextIcon,
      description: 'Generate new patient invoices and customize your clinic billing layout.',
      features: ['Invoice Generator', 'Layout Customizer'],
      path: '/invoice-generator',
      color: 'from-blue-500 to-indigo-600',
      textColor: 'text-indigo-600',
      bgLight: 'bg-indigo-50/50',
      border: 'border-indigo-100',
    },
    {
      title: 'Clinic Management',
      icon: ChartBarIcon,
      description: 'Track your revenue, analyze performance reports, and manage clinic inventory.',
      features: ['Finances', 'Analytics Reports', 'Stock Inventory'],
      path: '/finances',
      color: 'from-emerald-500 to-teal-600',
      textColor: 'text-teal-600',
      bgLight: 'bg-teal-50/50',
      border: 'border-teal-100',
    },
    {
      title: 'Patient Database',
      icon: UsersIcon,
      description: 'Search through existing patient records and view comprehensive treatment history.',
      features: ['Patient Search', 'Treatment Records'],
      path: '/database-find',
      color: 'from-purple-500 to-fuchsia-600',
      textColor: 'text-fuchsia-600',
      bgLight: 'bg-fuchsia-50/50',
      border: 'border-fuchsia-100',
    },
    {
      title: 'Configuration',
      icon: Cog6ToothIcon,
      description: 'Configure application settings, database location, and clinical presets.',
      features: ['App Settings', 'Diagnosis Presets', 'Treatment Presets'],
      path: '/settings',
      color: 'from-slate-600 to-slate-800',
      textColor: 'text-slate-600',
      bgLight: 'bg-slate-50/50',
      border: 'border-slate-200',
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in zoom-in-95 duration-500">
      
      {/* Premium Hero Header */}
      <header className="relative bg-white rounded-3xl shadow-md p-10 mb-10 border border-slate-100 overflow-hidden">
        {/* Decorative background blobs */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-blue-50 pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-emerald-50 pointer-events-none" />
        
        <div className="relative flex items-center gap-6">
          <div className="p-4 bg-linear-to-br from-indigo-500 to-purple-600 text-white rounded-2xl shadow-sm">
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
        {hubs.map((hub) => {
          const Icon = hub.icon;
          return (
            <div
              key={hub.path}
              onClick={() => navigate(hub.path)}
              className={`relative bg-white rounded-3xl shadow-sm hover:shadow-md transition-shadow duration-200 cursor-pointer group border border-slate-100 overflow-hidden flex flex-col`}
            >
              <div className="p-8 flex-1 flex flex-col relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div className={`w-16 h-16 rounded-2xl ${hub.bgLight} ${hub.border} border flex items-center justify-center`}>
                    <Icon className={`w-8 h-8 ${hub.textColor}`} strokeWidth={1.5} />
                  </div>
                  <div className={`w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:${hub.textColor} group-hover:bg-slate-100 transition-colors duration-200`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                
                <h2 className="text-3xl font-semibold text-slate-800 mb-3 tracking-tight">
                  {hub.title}
                </h2>
                
                <p className="text-slate-500 text-lg mb-6 flex-1 font-medium leading-relaxed">
                  {hub.description}
                </p>
                
                {/* Feature Pills */}
                <div className="flex flex-wrap gap-2 mt-auto">
                  {hub.features.map(feature => (
                    <span key={feature} className="px-3.5 py-1.5 bg-slate-50 border border-slate-200/60 text-slate-500 text-sm font-medium rounded-xl">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
};

export default Home;
