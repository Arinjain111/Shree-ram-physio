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
    setToasts((prev) => [...prev, { id, type, message, duration, onClose: removeToast }]);
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
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} />
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
