import React, { Component, ErrorInfo, ReactNode } from 'react';

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
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-slate-900 text-white z-50 absolute inset-0">
          <h2 className="text-2xl font-bold mb-4 text-red-400">渲染发生错误</h2>
          <p className="text-gray-300 mb-4">{this.state.error?.message}</p>
          <button
            className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              // 强制清理页面重新加载
              window.location.reload();
            }}
          >
            刷新页面重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
