import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
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
    console.error('Uncaught error inside component tree:', error, errorInfo);
  }

  private handleRecover = () => {
    this.setState({ hasError: false, error: null });
    // Soft reload component state without losing session
    window.location.hash = '';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="w-14 h-14 mx-auto bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Form Recovered Safely</h2>
              <p className="text-xs text-slate-600 mt-1">
                An unexpected display error occurred. Your technician session and saved drafts have been preserved.
              </p>
            </div>
            {this.state.error && (
              <div className="text-[11px] font-mono bg-slate-100 p-2.5 rounded-lg text-slate-700 text-left overflow-auto max-h-24">
                {this.state.error.message || 'Unknown error'}
              </div>
            )}
            <button
              type="button"
              onClick={this.handleRecover}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer transition active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Resume Form</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
