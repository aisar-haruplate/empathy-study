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
        <div className="min-h-[300px] flex items-center justify-center p-6 bg-white border border-[#EAE6DF] rounded-3xl shadow-studio m-4">
          <div className="max-w-md text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#FDF4F3] text-[#D97A75] border border-[#E89994] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-heading text-xl font-bold text-[#292524] tracking-[-0.02em]">
              {this.props.fallbackTitle || 'A rendering error occurred'}
            </h3>
            <p className="text-base leading-[1.65] text-[#57534E] font-mono bg-[#F7F5F0] p-4 rounded-2xl border border-[#EAE6DF] text-left overflow-x-auto max-h-36">
              {this.state.error?.message || 'Unknown render error'}
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full font-heading text-sm font-bold bg-[#F6BEBA] hover:bg-[#E89994] border border-[#D97A75]/45 text-[#292524] cursor-pointer transition-all active:scale-95"
              >
                <RefreshCw className="w-4 h-4" />
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
