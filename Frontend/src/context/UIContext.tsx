import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Toast from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import { UILogBridge } from '@/components/ui/UILogBridge';
import type { ToastType, ToastProps, ModalProps, UIContextType } from '@/types/ui.types';

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const [modalProps, setModalProps] = useState<ModalProps | null>(null);
  const [modalCallbacks, setModalCallbacks] = useState<{ onConfirm?: () => void; onCancel?: () => void }>({});

  const showToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => {
      const newToasts = [...prev, { id, type, message, duration, onClose: removeToast }];
      // Limit to max 5 toasts on screen
      if (newToasts.length > 5) {
        return newToasts.slice(newToasts.length - 5);
      }
      return newToasts;
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showModal = useCallback((props: Omit<ModalProps, 'isOpen' | 'onConfirm' | 'onCancel'> & { onConfirm?: () => void; onCancel?: () => void }) => {
    setModalProps({ ...props, isOpen: true, onConfirm: props.onConfirm ?? (() => {}), onCancel: props.onCancel ?? (() => {}) });
    setModalCallbacks({ onConfirm: props.onConfirm, onCancel: props.onCancel });
  }, []);

  const closeModal = useCallback(() => {
    setModalProps(null);
    setModalCallbacks({});
  }, []);

  const handleConfirm = useCallback(() => {
    if (modalCallbacks.onConfirm) {
      modalCallbacks.onConfirm();
    }
    closeModal();
  }, [modalCallbacks, closeModal]);

  const handleCancel = useCallback(() => {
    if (modalCallbacks.onCancel) {
      modalCallbacks.onCancel();
    }
    closeModal();
  }, [modalCallbacks, closeModal]);

  return (
    <UIContext.Provider value={{ showToast, showModal, closeModal }}>
      <UILogBridge />
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-9999 flex flex-col gap-3 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto transition-all duration-300 ease-out">
            <Toast {...toast} />
          </div>
        ))}
      </div>

      {/* Modal Container */}
      {modalProps && (
        <Modal
          {...modalProps}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
