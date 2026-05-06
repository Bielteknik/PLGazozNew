import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  // Explicitly declaring props and state to satisfy the local compiler environment
  public props: Props;
  public state: State;

  constructor(props: Props) {
    super(props);
    this.props = props;
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6 bg-red-900/20 border-2 border-red-500 rounded-xl text-white m-4">
          <h2 className="text-xl font-bold mb-2">Bileşen Hatası</h2>
          <p className="text-sm opacity-80 mb-4">Bir şeyler ters gitti. Lütfen sayfayı yenileyin veya sistem yöneticisine danışın.</p>
          <pre className="text-[10px] bg-black/40 p-2 rounded overflow-auto">
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 bg-red-500 px-4 py-2 rounded font-bold text-sm"
          >
            SAYFAYI YENİLE
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
