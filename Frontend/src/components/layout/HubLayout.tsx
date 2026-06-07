import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { HomeIcon } from '@/components/icons';

export interface HubTab {
  label: string;
  path: string;
  icon?: React.ReactNode;
}

interface HubLayoutProps {
  tabs: HubTab[];
}

export default function HubLayout({ tabs }: HubLayoutProps) {
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
          <div className="bg-slate-100/50 p-1 rounded-[20px] flex items-center gap-1 shadow-inner ring-1 ring-slate-200/50 backdrop-blur-md">
            <button 
              onClick={() => navigate('/')} 
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-[16px] transition-all group hidden lg:block"
              title="Back to Hubs"
            >
              <HomeIcon width={18} height={18} className="group-hover:scale-110 transition-transform" />
            </button>
            
            <div className="w-[2px] h-4 bg-slate-200/80 mx-1 rounded-full hidden lg:block" />

            {tabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={({ isActive }) =>
                  `px-5 py-2 rounded-[16px] text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                    isActive
                      ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/60'
                      : 'text-slate-500 hover:bg-white/60 hover:text-indigo-600'
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
