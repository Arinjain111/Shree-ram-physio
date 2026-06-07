import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PageHeaderProps } from '@/types/ui.types';

const PageHeader = ({ title, breadcrumb, icon, actions }: PageHeaderProps) => {
  const [leftContainer, setLeftContainer] = useState<Element | null>(null);
  const [rightContainer, setRightContainer] = useState<Element | null>(null);

  useEffect(() => {
    // The HubLayout component provides these portal targets in the single unified top bar
    setLeftContainer(document.getElementById('page-header-left'));
    setRightContainer(document.getElementById('page-header-right'));
  }, []);

  // We return null in the normal DOM flow because the contents are teleported to the HubLayout top bar!
  return (
    <>
      {leftContainer && createPortal(
        <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-500">
          {icon && (
            <div className="shrink-0 scale-110 opacity-90">
              {icon}
            </div>
          )}
          <div className="flex flex-col justify-center min-w-0 gap-0.5">
            {breadcrumb && (
              <span className="text-[11px] font-semibold text-indigo-500/80 uppercase tracking-widest leading-none">
                {breadcrumb}
              </span>
            )}
            <h1 className="text-2xl font-semibold text-slate-800 leading-none truncate">
              {title}
            </h1>
          </div>
        </div>,
        leftContainer
      )}
      
      {rightContainer && actions && createPortal(
        <div className="flex gap-2 items-center animate-in fade-in slide-in-from-right-4 duration-500">
          {actions}
        </div>,
        rightContainer
      )}
    </>
  );
};

export default PageHeader;
