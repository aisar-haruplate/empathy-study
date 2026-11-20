import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[300px] flex items-center justify-center p-6 bg-stone-50 border border-stone-200 rounded-2xl m-4">
          <div className="max-w-md text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-stone-900">
              {this.props.fallbackTitle || 'A rendering error occurred'}
            </h3>
            <p className="text-xs text-stone-600 font-mono bg-white p-3 rounded-xl border border-stone-200 text-left overflow-x-auto max-h-32">
              {this.state.error?.message || 'Unknown render error'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 text-white shadow-xs cursor-pointer transition-all active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Application</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
