import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '@/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logger.error('ui', 'ErrorBoundary caught', { message: error.message, stack: error.stack, componentStack: errorInfo.componentStack });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
          <div className="w-full max-w-lg rounded-xl border border-red-200 bg-white p-8 shadow-lg">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
            </div>
            <p className="mb-4 text-sm text-slate-600">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.state.error && (
              <pre className="max-h-48 overflow-auto rounded-lg bg-slate-100 p-4 text-xs text-red-700">
                {this.state.error.message}
              </pre>
            )}
            <button
              className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
