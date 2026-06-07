import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PageHeaderProps } from '@/types/ui.types';

const PageHeader = ({ title, icon, actions, description }: PageHeaderProps) => {
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
          <div className="flex flex-col justify-center min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-800 leading-tight truncate">{title}</h1>
            {description && (
              <div className="text-xs font-medium text-slate-500 hidden md:block mt-0.5 truncate max-w-[280px] xl:max-w-[400px]" title={typeof description === 'string' ? description : undefined}>
                {description}
              </div>
            )}
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
