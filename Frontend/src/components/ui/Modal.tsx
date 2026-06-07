import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ModalProps } from '@/types/ui.types';

export type { ModalProps };

const Modal = ({
  isOpen,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: ModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return (
          <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
        );
      case 'confirm':
        return (
          <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-100 sm:mx-0 sm:h-10 sm:w-10">
            <svg className="h-6 w-6 text-teal-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </div>
        );
      case 'warning':
        return (
          <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100 sm:mx-0 sm:h-10 sm:w-10">
            <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
            <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </div>
        );
    }
  };

  const formatMessage = (msg: string) => {
    if (!msg.includes('\n')) return <p className="text-sm text-slate-500 wrap-break-words">{msg}</p>;

    const lines = msg.split('\n').filter(line => line.trim().length > 0);
    
    return (
      <div className="text-sm text-slate-500 space-y-2">
        {lines.map((line, i) => {
          const trimmed = line.trim();
          
          // Header check (ends with :)
          if (i === 0 && trimmed.endsWith(':')) { 
             return <p key={i} className="font-medium text-slate-700 mb-1">{line}</p>
          }

          // Bullet point check (starts with - or *)
          const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
          const content = isBullet ? trimmed.substring(2) : trimmed;
          
          // Legacy check: validation messages often had "field: message" format
          const cleanLine = content.includes(': ') && !isBullet ? content.substring(content.indexOf(': ') + 2) : content;

          if (isBullet) {
            return (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                <span className="wrap-break-words">{cleanLine}</span>
              </div>
            );
          }

          return <p key={i} className="wrap-break-words">{cleanLine}</p>;
        })}
      </div>
    );
  };

  return createPortal(
    <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-slate-900/50 transition-opacity"></div>

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div 
            ref={modalRef}
            className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-slate-100"
          >
            <div className="px-6 pb-6 pt-6 sm:p-8 sm:pb-6">
              <div className="sm:flex sm:items-start">
                {getIcon()}
                <div className="mt-4 text-center sm:ml-5 sm:mt-0 sm:text-left w-full">
                  <h3 className="text-xl font-semibold leading-6 text-slate-800" id="modal-title">
                    {title}
                  </h3>
                  <div className="mt-4">
                    {formatMessage(message)}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-slate-50/50 px-6 py-4 sm:flex sm:flex-row-reverse sm:px-8 border-t border-slate-100 rounded-b-3xl gap-3">
              <button
                type="button"
                className={`inline-flex w-full justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all sm:w-auto ${
                  type === 'danger' ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20' : 
                  type === 'warning' ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20' :
                  'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
                }`}
                onClick={onConfirm}
              >
                {confirmText}
              </button>
              {type !== 'info' && (
                <button
                  type="button"
                  className="mt-3 inline-flex w-full justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 transition-colors sm:mt-0 sm:w-auto"
                  onClick={onCancel}
                >
                  {cancelText}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
