import { useEffect } from 'react';
import type { ToastType, ToastProps } from '@/types/ui.types';

export type { ToastType, ToastProps };

const icons = {
  success: (
    <svg className="w-6 h-6 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

const bgColors = {
  success: 'bg-teal-50/90 border-teal-100',
  error: 'bg-red-50/90 border-red-100',
  warning: 'bg-amber-50/90 border-amber-100',
  info: 'bg-blue-50/90 border-blue-100',
};

const formatMessage = (msg: string) => {
  if (!msg.includes('\n')) return msg;
  
  const lines = msg.split('\n').filter(line => line.trim());
  
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const cleanLine = line.includes(': ') ? line.substring(line.indexOf(': ') + 2) : line;
        return (
          <div key={i} className="flex items-start">
            <span className="mr-2 mt-1.5 w-1 h-1 rounded-full bg-current shrink-0 opacity-60" />
            <span className="whitespace-nowrap">{cleanLine}</span>
          </div>
        );
      })}
    </div>
  );
};

const Toast = ({ id, type, message, duration = 3000, onClose }: ToastProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, id, onClose]);

  return (
    <div className={`flex items-start w-full max-w-md p-4 mb-4 text-slate-600 rounded-xl shadow-xl border backdrop-blur-md ${bgColors[type]} animate-in slide-in-from-right-full duration-300`}>
      <div className="inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-lg mt-0.5">
        {icons[type]}
      </div>
      <div className="ml-3 text-sm font-medium flex-1">{formatMessage(message)}</div>
      <button
        type="button"
        className="ml-auto -mx-1.5 -my-1.5 text-slate-400 hover:text-slate-900 rounded-lg focus:ring-2 focus:ring-slate-300 p-1.5 hover:bg-black/5 inline-flex h-8 w-8 transition-colors shrink-0"
        onClick={() => onClose(id)}
      >
        <span className="sr-only">Close</span>
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
};

export default Toast;
