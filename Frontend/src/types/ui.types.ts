/**
 * UI-related type definitions for components, toast notifications, and modals.
 */

import type { ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  onClose: (id: string) => void;
}

export interface ModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'info' | 'confirm' | 'warning' | 'danger' | 'success';
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface UIContextType {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  showModal: (props: Omit<ModalProps, 'isOpen' | 'onConfirm' | 'onCancel'> & { 
    onConfirm?: () => void; 
    onCancel?: () => void 
  }) => void;
  closeModal: () => void;
}

export interface PageHeaderProps {
  title: string;
  icon?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backUrl?: string;
  className?: string;
}
