import { useNavigate } from 'react-router-dom';
import type { PageHeaderProps } from '@/types/ui.types';
import { BackIcon } from '@/components/icons';

const PageHeader = ({ title, icon, actions, description, backUrl = '/', className = '' }: PageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <div className={`sticky top-0 z-30 -mx-6 -mt-6 px-6 py-4 mb-8 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm rounded-lg ${className}`}>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(backUrl)}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          title="Back"
        >
          <BackIcon />
        </button>
        <div>
          <div className="flex items-center gap-3">
            {icon && (
              <div className="shrink-0">
                {icon}
              </div>
            )}
            <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
          </div>
          {description && (
            <div className="mt-1 ml-1">
              {description}
            </div>
          )}
        </div>
      </div>
      
      {actions && (
        <div className="flex gap-3 items-center">
          {actions}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
