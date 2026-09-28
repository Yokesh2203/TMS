import React, { useState, useEffect, useCallback } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';
import { Database, Loader2, RefreshCw } from 'lucide-react';
import { Student, AdminAuthState, AdminUser } from './types';
import { Header } from './components/Header';
import { StudentForm } from './components/StudentForm';
import { AdminPanel } from './components/AdminPanel';
import { AdminLogin } from './components/AdminLogin';
import {
  checkDbHealth,
  fetchStudentsFromDb,
  saveStudentToDb,
  updateStudentInDb,
  DbStatus,
  getStoredAdminAuth,
  adminLogout,
} from './services/api';

function AppContent() {
  const navigate = useNavigate();

  const [students, setStudents] = useState<Student[]>([]);
  const [dbStatus, setDbStatus] = useState<DbStatus>({ connected: false });
  const [saveSource, setSaveSource] = useState<'mysql' | 'local' | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Admin authentication state
  const [adminAuth, setAdminAuth] = useState<AdminAuthState>(() => getStoredAdminAuth());

  // Handle backward compatibility for old hash links (#admin -> /admin/dashboard)
  useEffect(() => {
    if (window.location.hash.toLowerCase() === '#admin') {
      window.history.replaceState(null, '', '/admin/dashboard');
      navigate('/admin/dashboard', { replace: true });
    }
  }, [navigate]);

  // Check DB connection status on mount and interval
  const checkHealth = useCallback(async () => {
    const status = await checkDbHealth();
    setDbStatus(status);
    return status;
  }, []);

  useEffect(() => {
    checkHealth();
    const timer = setInterval(checkHealth, 8000);
    return () => clearInterval(timer);
  }, [checkHealth]);

  // Load students from database
  const loadStudents = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const result = await fetchStudentsFromDb();
      setStudents(result.students);
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (dbStatus.connected) {
      loadStudents();
    }
  }, [dbStatus.connected, loadStudents]);

  // Handle Save Student directly into MySQL
  const handleSaveStudent = async (
    studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    const { savedStudent, source } = await saveStudentToDb(studentData);
    setSaveSource(source);
    setStudents((prev) => [savedStudent, ...prev]);
    return { savedStudent, source };
  };

  // Handle Update Student directly in MySQL
  const handleUpdateStudent = async (
    studentId: string,
    updatedData: Partial<Student>
  ) => {
    const { updatedStudent } = await updateStudentInDb(studentId, updatedData);
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, ...updatedStudent } : s))
    );
    return updatedStudent;
  };

  // Admin Login success handler
  const handleLoginSuccess = (user: AdminUser) => {
    setAdminAuth({
      isAuthenticated: true,
      user,
      token: user.token || 'valid-session',
    });
    navigate('/admin/dashboard', { replace: true });
  };

  // Admin Logout handler
  const handleLogout = () => {
    adminLogout();
    setAdminAuth({
      isAuthenticated: false,
      user: null,
      token: null,
    });
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 font-sans antialiased flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      {!dbStatus.connected ? (
        /* Database Disconnected Loading Page */
        <>
          <Header dbStatus={dbStatus} />
          <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 flex items-center justify-center min-h-[65vh]">
            <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="h-16 w-16 mx-auto rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs relative">
                <Database className="h-8 w-8 text-indigo-600 animate-pulse" />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500"></span>
                </span>
              </div>

              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Connecting to College Database...
                </h2>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  Establishing live connection with the NSCET Transport Management Server. The portal will automatically load as soon as connection is verified.
                </p>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center gap-2 text-xs font-semibold text-indigo-700">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600 shrink-0" />
                <span>Verifying system connection...</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  checkHealth().then((st) => {
                    if (st.connected) loadStudents();
                  });
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry Connection</span>
              </button>
            </div>
          </main>
        </>
      ) : (
        <Routes>
          {/* Public Route: Only Student Registration visible to students */}
          <Route
            path="/"
            element={
              <>
                <Header dbStatus={dbStatus} />
                <main className="flex-1 max-w-6xl w-full mx-auto px-2.5 sm:px-6 py-3 sm:py-8">
                  <div className="max-w-4xl mx-auto">
                    <StudentForm
                      onSaveStudent={handleSaveStudent}
                      editingStudent={null}
                      onCancelEdit={() => {}}
                      dbStatus={dbStatus}
                    />
                  </div>
                </main>
              </>
            }
          />

          {/* Administrator Login Route (/admin/login) */}
          <Route
            path="/admin/login"
            element={
              adminAuth.isAuthenticated ? (
                <Navigate to="/admin/dashboard" replace />
              ) : (
                <>
                  <Header dbStatus={dbStatus} />
                  <main className="flex-1 max-w-6xl w-full mx-auto px-2.5 sm:px-6 py-3 sm:py-8">
                    <AdminLogin
                      onLoginSuccess={handleLoginSuccess}
                      onCancel={() => navigate('/')}
                    />
                  </main>
                </>
              )
            }
          />

          {/* Protected Administrator Dashboard Route (/admin/dashboard) */}
          <Route
            path="/admin/dashboard"
            element={
              adminAuth.isAuthenticated ? (
                <>
                  <Header
                    dbStatus={dbStatus}
                    adminAuth={adminAuth}
                    onLogout={handleLogout}
                    isAdminDashboard={true}
                  />
                  <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
                    <AdminPanel
                      students={students}
                      onRefreshStudents={loadStudents}
                      onUpdateStudent={handleUpdateStudent}
                      isRefreshing={isRefreshing}
                    />
                  </main>
                </>
              ) : (
                /* If unauthenticated user tries to access /admin/dashboard, automatically redirect them to /admin/login */
                <Navigate to="/admin/login" replace />
              )
            }
          />

          {/* Catch-all redirect to public student registration */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
