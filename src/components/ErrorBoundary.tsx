import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  category?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary [${this.props.category || 'General'}]:`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center bg-brand-bg/50 border border-red-500/20 rounded-3xl backdrop-blur-xl min-h-[300px]">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6 animate-pulse">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2 font-display">Algo salió mal</h3>
          <p className="text-gray-400 text-sm max-w-md mb-8 leading-relaxed">
            Se produjo un error al renderizar {this.props.category ? `el módulo de ${this.props.category}` : 'esta sección'}. 
            {this.state.error && <span className="block mt-2 font-mono text-[10px] text-red-400/80">{this.state.error.message}</span>}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-full font-bold text-sm hover:bg-red-600 transition-all active:scale-95 transition-all shadow-lg shadow-red-500/20"
          >
            <RefreshCw className="w-4 h-4" />
            Recargar Componente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
