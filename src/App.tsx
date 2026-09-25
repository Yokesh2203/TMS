import React, { useState, useEffect, useCallback } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from 'react-router-dom';
import { Student, AdminAuthState, AdminUser } from './types';
import { Header } from './components/Header';
import { StudentForm } from './components/StudentForm';
import { AdminPanel } from './components/AdminPanel';
import { AdminLogin } from './components/AdminLogin';
import {
  checkDbHealth,
  fetchStudentsFromDb,
  saveStudentToDb,
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
  useEffect(() => {
    const checkHealth = async () => {
      const status = await checkDbHealth();
      setDbStatus(status);
    };
    checkHealth();
    const timer = setInterval(checkHealth, 10000);
    return () => clearInterval(timer);
  }, []);

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
    loadStudents();
  }, [loadStudents]);

  // Handle Save Student directly into MySQL or local database
  const handleSaveStudent = async (
    studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    const { savedStudent, source } = await saveStudentToDb(studentData);
    setSaveSource(source);
    setStudents((prev) => [savedStudent, ...prev]);
    return { savedStudent, source };
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
                    saveSource={saveSource}
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
