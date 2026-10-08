import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    const isChunkError =
      error?.message?.includes('dynamically imported module') ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Failed to fetch');

    if (isChunkError && typeof window !== 'undefined') {
      const lastReload = parseInt(sessionStorage.getItem('arn_eb_chunk_reload') || '0', 10);
      const now = Date.now();
      // Only reload automatically if we haven't reloaded in the last 15 seconds
      if (now - lastReload > 15000) {
        sessionStorage.setItem('arn_eb_chunk_reload', String(now));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const isEn = typeof window !== 'undefined' && localStorage.getItem('i18nextLng') === 'en';
      const isChunkError =
        this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.message?.includes('Loading chunk') ||
        this.state.error?.message?.includes('Failed to fetch');

      return (
        <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-white dark:bg-surface border border-slate-200/80 dark:border-white/10 shadow-2xl text-center space-y-4">
            <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${
              isChunkError ? 'bg-primaryMovies/10 text-primaryMovies' : 'bg-red-500/10 text-red-500'
            }`}>
              <AlertCircle size={36} />
            </div>
            <h2 className="text-xl font-bold">
              {isChunkError
                ? (isEn ? 'Update Available' : 'تم تحديث المنصة بنجاح')
                : (isEn ? 'An Unexpected Error Occurred' : 'حدث خطأ غير متوقع')}
            </h2>
            <p className="text-xs sm:text-sm text-muted">
              {isChunkError
                ? (isEn 
                    ? 'A newer version of ARN Stream has been published. Please reload the page to load the latest features.' 
                    : 'تم تثبيت تحديث جديد لمنصة ARN Stream. يرجى الضغط على زر التحديث أدناه لتفعيل أحدث الميزات.')
                : (isEn 
                    ? 'We apologize for this error. You can try refreshing the page or return to the home page.' 
                    : 'نعتذر عن هذا الخطأ، يمكنك محاولة إعادة تحميل الصفحة أو العودة للصفحة الرئيسية.')}
            </p>
            {this.state.error?.message && !isChunkError && (
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-surfaceHover text-start font-mono text-[11px] text-muted overflow-x-auto">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primaryMovies text-white text-xs font-semibold shadow-md hover:brightness-110 transition"
              >
                <RefreshCw size={14} />
                <span>{isChunkError ? (isEn ? 'Reload Page' : 'تحديث الصفحة الآن') : (isEn ? 'Try Again' : 'إعادة المحاولة')}</span>
              </button>
              <a
                href="/"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-surfaceHover text-text text-xs font-semibold hover:bg-slate-200 dark:hover:bg-surface transition"
              >
                <Home size={14} />
                <span>{isEn ? 'Home' : 'الرئيسية'}</span>
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
