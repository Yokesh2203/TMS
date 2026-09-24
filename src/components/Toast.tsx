import React, { useEffect } from 'react';
import { CheckCircle2, Database, X, AlertTriangle, Info } from 'lucide-react';

export interface ToastData {
  id: string;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  dbSource?: 'mysql' | 'local' | null;
}

interface ToastProps {
  toast: ToastData | null;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose, duration = 4000 }) => {
  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, duration, onClose]);

  if (!toast) return null;

  const isSuccess = toast.type !== 'error' && toast.type !== 'info';

  return (
    <div className="fixed top-5 right-5 z-50 max-w-md w-full px-4 sm:px-0 pointer-events-auto transition-all animate-in fade-in slide-in-from-top-4 sm:slide-in-from-right-4 duration-300">
      <div className="bg-white/95 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-4 shadow-xl shadow-emerald-950/5 relative overflow-hidden flex items-start gap-3.5">
        {/* Left Status Icon */}
        <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shrink-0 shadow-xs">
          {isSuccess ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : toast.type === 'error' ? (
            <AlertTriangle className="h-5 w-5 text-rose-500" />
          ) : (
            <Info className="h-5 w-5 text-sky-500" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-800 tracking-tight">
              {toast.title}
            </h4>
            {toast.dbSource && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200/60">
                <Database className="h-2.5 w-2.5" />
                {toast.dbSource === 'mysql' ? 'MySQL' : 'Local'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed font-medium">
            {toast.message}
          </p>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
          title="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Bottom subtle progress line */}
        <div 
          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-400 animate-toast-progress"
          style={{
            animation: `shrinkWidth ${duration}ms linear forwards`,
          }}
        />
      </div>

      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};
