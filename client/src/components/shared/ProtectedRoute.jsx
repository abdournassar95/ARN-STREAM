import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { ShieldAlert, Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { isAuthenticated, isInitialized, hasLibraries, isLoading, user, checkAuth } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    // Re-verify if not authenticated
    if (!isAuthenticated) {
      checkAuth();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-text p-4">
        <div className="relative flex items-center justify-center mb-4">
          <div className="absolute w-20 h-20 rounded-full bg-cyan-500/20 blur-xl animate-pulse" />
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin relative z-10" />
        </div>
        <p className="text-muted text-sm font-medium tracking-wide">{isRtl ? 'جاري التحقق من الصلاحيات...' : 'Verifying permissions...'}</p>
      </div>
    );
  }

  // First-run setup required
  if (!isInitialized) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Unauthenticated -> Redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // No libraries -> Redirect to setup or block access
  if (hasLibraries === false) {
    if (user?.role === 'admin') {
      return <Navigate to="/login" replace state={{ from: location }} />;
    } else {
      return (
        <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-text p-6 text-center">
          <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-400 mb-4 shadow-lg shadow-orange-500/10">
            <ShieldAlert size={48} className="mx-auto" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{isRtl ? 'لا توجد مكتبات' : 'No Libraries Found'}</h2>
          <p className="text-muted text-sm max-w-md mb-6">
            {isRtl ? 'لم يقم مدير النظام بإضافة أي مكتبات وسائط حتى الآن. يرجى الانتظار.' : 'The system administrator has not added any media libraries yet. Please wait.'}
          </p>
        </div>
      );
    }
  }

  // Admin role required
  if (requireAdmin && user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-text p-6 text-center">
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 mb-4 shadow-lg shadow-red-500/10">
          <ShieldAlert size={48} className="mx-auto" />
        </div>
        <h2 className="text-2xl font-bold mb-2">{isRtl ? 'منطقة محمية - صلاحيات مسؤول فقط' : 'Protected Area - Administrator Only'}</h2>
        <p className="text-muted text-sm max-w-md mb-6">
          {isRtl ? 'عذراً، هذا القسم مخصص لمدير النظام (Administrator) فقط، حسابك الحالي لا يمتلك الصلاحيات الكافية للوصول.' : 'Sorry, this area is restricted to System Administrators only. Your current account does not have sufficient permissions.'}
        </p>
        <a
          href="/"
          className="px-6 py-2.5 rounded-xl bg-surface border border-border hover:bg-surfaceHover text-sm font-semibold transition"
        >
          {isRtl ? 'العودة للصفحة الرئيسية' : 'Return to Home'}
        </a>
      </div>
    );
  }

  return children;
}
