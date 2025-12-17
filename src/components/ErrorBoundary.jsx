import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * React Error Boundary 组件
 * 捕获子组件中的 JavaScript 错误，防止整个应用崩溃
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // 更新 state 使下一次渲染显示降级 UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 仅在开发环境输出错误日志，生产环境可集成错误追踪服务
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-none p-8 max-w-lg w-full text-center">
            {/* 图标 */}
            <div className="w-16 h-16 bg-red-500/10 rounded-sm flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={32} className="text-red-500" />
            </div>

            {/* 标题 */}
            <h1 className="text-xl font-bold text-zinc-100 mb-2">
              应用发生错误
            </h1>
            <p className="text-zinc-500 text-sm mb-6">
              抱歉，应用遇到了一个意外错误。您可以尝试刷新页面或重置应用状态。
            </p>

            {/* 错误详情（开发模式） */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-zinc-950 border border-zinc-800 rounded-none p-4 mb-6 text-left overflow-auto max-h-40">
                <p className="text-red-400 text-xs font-mono break-all">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-zinc-500 text-xs mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 border border-zinc-700 rounded-none transition-colors"
              >
                重置状态
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 text-sm font-bold text-black bg-endfield-yellow hover:bg-yellow-400 rounded-none transition-colors flex items-center gap-2"
              >
                <RefreshCw size={16} />
                刷新页面
              </button>
            </div>

            {/* 提示 */}
            <p className="text-zinc-600 text-xs mt-6">
              如果问题持续存在，请联系管理员或提交反馈。
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
