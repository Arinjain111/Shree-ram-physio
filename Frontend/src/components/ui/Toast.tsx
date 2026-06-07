import { useEffect, useState, useRef } from 'react';
import type { ToastType, ToastProps } from '@/types/ui.types';

export type { ToastType, ToastProps };

const icons = {
  success: (
    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const bgColors = {
  success: 'bg-emerald-50 text-emerald-500',
  error: 'bg-rose-50 text-rose-500',
  warning: 'bg-amber-50 text-amber-500',
  info: 'bg-indigo-50 text-indigo-500',
};

const progressColors = {
  success: 'bg-emerald-500',
  error: 'bg-rose-500',
  warning: 'bg-amber-500',
  info: 'bg-indigo-500',
};

const formatMessage = (msg: string) => {
  if (!msg.includes('\n')) return msg;
  
  const lines = msg.split('\n').filter(line => line.trim());
  
  return (
    <div className="space-y-1.5 mt-1">
      {lines.map((line, i) => {
        const cleanLine = line.includes(': ') ? line.substring(line.indexOf(': ') + 2) : line;
        return (
          <div key={i} className="flex items-start">
            <span className="mr-2 mt-2 w-1.5 h-1.5 rounded-full bg-current shrink-0 opacity-40" />
            <span className="whitespace-pre-wrap">{cleanLine}</span>
          </div>
        );
      })}
    </div>
  );
};

const Toast = ({ id, type, message, duration = 3000, onClose }: ToastProps) => {
  const [isExiting, setIsExiting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>();
  // We need to track remaining time so the progress bar matches when unpaused.
  // But CSS animationPlayState handles pausing beautifully without React tick re-renders!

  const handleClose = () => {
    setIsExiting(true);
    // Allow animation to complete before unmounting
    setTimeout(() => {
      onClose(id);
    }, 300); // 300ms matches the exit animation duration
  };

  useEffect(() => {
    if (!isHovered) {
      timerRef.current = setTimeout(() => {
        handleClose();
      }, duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [duration, isHovered]);

  return (
    <div 
      className={`relative flex flex-col w-full max-w-sm rounded-2xl shadow-xl shadow-slate-200/50 border border-white/60 bg-white/85 backdrop-blur-xl overflow-hidden group ${
        isExiting ? 'animate-toast-exit' : 'animate-toast-enter'
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-start p-4">
        <div className={`inline-flex items-center justify-center shrink-0 w-10 h-10 rounded-xl ${bgColors[type]}`}>
          {icons[type]}
        </div>
        <div className="ml-3.5 text-sm font-medium text-slate-700 flex-1 pt-0.5">
          {formatMessage(message)}
        </div>
        <button
          type="button"
          className="ml-auto -mr-1.5 -mt-1.5 text-slate-400 hover:text-slate-700 rounded-lg focus:ring-2 focus:ring-slate-200 p-2 hover:bg-slate-100 transition-colors shrink-0"
          onClick={handleClose}
        >
          <span className="sr-only">Close</span>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      {/* Progress bar container */}
      <div className="h-[3px] w-full bg-slate-100/50">
        <div 
          className={`h-full ${progressColors[type]} opacity-80 animate-progress origin-left`}
          style={{ 
            animationDuration: `${duration}ms`,
            animationPlayState: isHovered ? 'paused' : 'running',
            animationFillMode: 'forwards'
          }}
        />
      </div>
    </div>
  );
};

export default Toast;
