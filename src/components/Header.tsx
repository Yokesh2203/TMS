import React from 'react';
import { Bus, ShieldCheck, LogOut } from 'lucide-react';
import { AdminAuthState } from '../types';
import { DbStatus } from '../services/api';

interface HeaderProps {
  dbStatus?: DbStatus;
  adminAuth?: AdminAuthState;
  onLogout?: () => void;
  isAdminDashboard?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  dbStatus,
  adminAuth,
  onLogout,
  isAdminDashboard = false,
}) => {
  return (
    <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between py-3.5 sm:py-4 gap-3.5">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0">
              <Bus className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                  Nadar Saraswathi College of Engineering and Technology Transport Portal
                </h1>
                {dbStatus?.connected ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    MySQL Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-100/80 text-amber-800 border border-amber-200">
                    <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                    Local Storage
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Nadar Saraswathi College of Engineering & Technology (NSCET)
              </p>
            </div>
          </div>

          {/* Admin Dashboard Header Actions (Only visible to authenticated admin on /admin/dashboard) */}
          {isAdminDashboard && adminAuth?.isAuthenticated && (
            <div className="flex items-center gap-2 sm:gap-3 self-start md:self-center">
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-700">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>{adminAuth.user?.name || 'Administrator'}</span>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer"
                  title="Log out from administrator session"
                >
                  <LogOut className="h-3.5 w-3.5 text-rose-600" />
                  <span>Logout</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
