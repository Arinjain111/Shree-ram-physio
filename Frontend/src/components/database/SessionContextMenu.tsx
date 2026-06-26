import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

interface SessionContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function SessionContextMenu({ x, y, items, onClose }: SessionContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', escHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [onClose]);

  const adjustedX = Math.min(x, window.innerWidth - 240);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 36 - 20);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[60] min-w-[220px] bg-white border border-slate-200 rounded-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {items.map((item, idx) => {
        if (item.separator) {
          return <div key={idx} className="h-px bg-slate-100 my-1" />;
        }
        return (
          <button
            key={idx}
            onClick={(e) => {
              e.stopPropagation();
              if (item.disabled) return;
              item.onClick();
              onClose();
            }}
            disabled={item.disabled}
            className={`w-full px-3 py-2 text-left text-sm font-medium flex items-center gap-2.5 transition-colors ${
              item.disabled
                ? 'text-slate-300 cursor-not-allowed'
                : item.destructive
                  ? 'text-rose-700 hover:bg-rose-50'
                  : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            {item.icon && <span className="w-4 h-4 shrink-0">{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
          </button>
        );
      })}
    </div>,
    document.body
  );
}
