import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { HomeIcon } from '@/components/icons';

export interface HubTab {
  label: string;
  path: string;
  icon?: React.ReactNode;
}

interface HubLayoutProps {
  hubName: string;
  tabs: HubTab[];
}

export default function HubLayout({ hubName, tabs }: HubLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-full flex flex-col relative animate-in fade-in duration-500">
      
      {/* Unified Full-Width Top Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-white/70 backdrop-blur-2xl border-b border-white/60 shadow-xs px-4 sm:px-6 py-3 flex items-center justify-between">
        
        {/* LEFT: PageHeader Title Portal Target */}
        <div id="page-header-left" className="flex items-center gap-4 flex-1 min-w-[200px]">
          {/* Default back button if a child doesn't mount its own header immediately */}
          <button 
            onClick={() => navigate('/')} 
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors group lg:hidden"
            title="Back to Hubs"
          >
            <HomeIcon width={20} height={20} className="group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* CENTER: Hub Tabs */}
        <div className="flex items-center justify-center shrink-0 mx-4">
          <div className="bg-slate-100/50 p-1.5 rounded-full flex items-center gap-1 border border-slate-200/50 shadow-inner">
            <button 
              onClick={() => navigate('/')} 
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-full transition-all shadow-xs group hidden lg:block"
              title="Back to Hubs"
            >
              <HomeIcon width={18} height={18} className="group-hover:scale-110 transition-transform" />
            </button>
            
            <div className="w-px h-5 bg-slate-200/80 mx-1 hidden lg:block" />
            
            <div className="px-3 text-xs font-bold text-slate-400 uppercase tracking-wider select-none hidden lg:block">
              {hubName}
            </div>
            
            <div className="w-px h-5 bg-slate-200/80 mx-1 hidden lg:block" />

            {tabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={({ isActive }) =>
                  `px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${
                    isActive
                      ? 'bg-white text-indigo-600 shadow-md shadow-slate-200/50 ring-1 ring-slate-900/5'
                      : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
                  }`
                }
              >
                {tab.icon && <span className="opacity-80">{tab.icon}</span>}
                {tab.label}
              </NavLink>
            ))}
          </div>
        </div>

        {/* RIGHT: PageHeader Actions Portal Target */}
        <div id="page-header-right" className="flex items-center justify-end gap-3 flex-1 min-w-[200px]">
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 pt-24 pb-8">
        <Outlet />
      </div>
    </div>
  );
}
