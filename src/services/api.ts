import { Student } from '../types';

const STORAGE_KEY = 'student_data_registry_records_v1';

function getApiBase(): string {
  let base = (import.meta.env.VITE_API_BASE_URL || '').trim();
  
  if (base.startsWith('mysql://')) {
    console.error('❌ Configuration Error: VITE_API_BASE_URL cannot be a mysql:// connection string. It must be your Railway Web Service HTTPS URL, e.g. https://your-app.up.railway.app');
    return '';
  }

  // Strip trailing slashes and redundant /api suffix
  base = base.replace(/\/+$/, '').replace(/\/api$/, '');

  // Auto-prepend https:// if protocol was omitted
  if (base && !base.startsWith('http://') && !base.startsWith('https://')) {
    base = `https://${base}`;
  }

  return base;
}

export const API_BASE = getApiBase();

if (typeof window !== 'undefined') {
  console.log('📡 [TMS App] Active Backend URL:', API_BASE || '(Local / same-origin)');
}

export interface DbStatus {
  connected: boolean;
  database?: string;
  error?: string;
}

// 1. Check MySQL connection health
export async function checkDbHealth(): Promise<DbStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${API_BASE}/api/health`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return { connected: data.status === 'connected', database: data.database };
    }
    return { connected: false, error: `Backend returned status ${res.status}` };
  } catch (err: any) {
    return { connected: false, error: err.message || 'Server offline' };
  }
}

// 2. Fetch all students (MySQL first, fallback to localStorage)
export async function fetchStudentsFromDb(): Promise<{ students: Student[]; source: 'mysql' | 'local' }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${API_BASE}/api/students`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        return { students: data.data, source: 'mysql' };
      }
    }
  } catch (err) {
    console.warn('[TMS API] Could not fetch students from MySQL, falling back to local storage:', err);
  }

  // Fallback to local storage
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { students: JSON.parse(saved), source: 'local' };
    }
  } catch {
    // Ignore parse errors
  }

  return { students: [], source: 'local' };
}

// 3. Save student (MySQL first, fallback to localStorage)
export async function saveStudentToDb(
  studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ savedStudent: Student; source: 'mysql' | 'local' }> {
  try {
    console.log(`📡 [TMS API] Submitting student to: ${API_BASE}/api/students`);
    const res = await fetch(`${API_BASE}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData),
    });

    if (res.ok) {
      const result = await res.json();
      if (result.success && result.data) {
        console.log('✅ [TMS API] Student saved to Railway MySQL successfully:', result.data);
        return { savedStudent: result.data, source: 'mysql' };
      }
    } else {
      const errBody = await res.text();
      console.error(`❌ [TMS API] Backend responded with HTTP ${res.status}:`, errBody);
    }
  } catch (error: any) {
    console.warn('⚠️ [TMS API] MySQL API unreachable, falling back to local browser storage:', error?.message || error);
  }

  // Local storage fallback
  const localStudent: Student = {
    ...studentData,
    id: `stu-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const list: Student[] = existing ? JSON.parse(existing) : [];
    const updated = [localStudent, ...list];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }

  return { savedStudent: localStudent, source: 'local' };
}

// ==========================================
// 4. Admin Authentication Services
// ==========================================
const ADMIN_AUTH_KEY = 'nadar_tms_admin_session_v1';

// Default fallback credentials if backend is in local fallback mode
const DEFAULT_ADMIN_USER = 'admin';
const DEFAULT_ADMIN_PASS = 'admin123';

export function getStoredAdminAuth(): { isAuthenticated: boolean; user: any | null; token: string | null } {
  try {
    const raw = sessionStorage.getItem(ADMIN_AUTH_KEY) || localStorage.getItem(ADMIN_AUTH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.token && parsed.user) {
        return {
          isAuthenticated: true,
          user: parsed.user,
          token: parsed.token,
        };
      }
    }
  } catch (e) {
    console.error('Error reading stored admin session:', e);
  }
  return { isAuthenticated: false, user: null, token: null };
}

export async function adminLogin(
  username: string,
  password: string,
  rememberMe: boolean = true
): Promise<{ success: boolean; user?: any; token?: string; error?: string }> {
  const cleanUser = username.trim();
  const cleanPass = password.trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, error: 'Please enter both username and password.' };
  }

  // 1. Try Backend API
  try {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cleanUser, password: cleanPass }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.token) {
        const sessionData = {
          user: data.user,
          token: data.token,
          savedAt: new Date().toISOString(),
        };
        sessionStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify(sessionData));
        if (rememberMe) {
          localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify(sessionData));
        }
        return { success: true, user: data.user, token: data.token };
      }
      return { success: false, error: data.error || 'Authentication failed' };
    } else if (res.status === 401) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.error || 'Invalid administrator username or password.' };
    }
  } catch (err) {
    console.warn('Backend server offline during admin login, checking credentials fallback:', err);
  }

  // 2. Offline / Local fallback validation
  if (cleanUser === DEFAULT_ADMIN_USER && cleanPass === DEFAULT_ADMIN_PASS) {
    const fallbackUser = {
      username: DEFAULT_ADMIN_USER,
      name: 'System Administrator',
      role: 'admin',
    };
    const fallbackToken = btoa(JSON.stringify({ username: DEFAULT_ADMIN_USER, role: 'admin', t: Date.now() }));
    const sessionData = {
      user: fallbackUser,
      token: fallbackToken,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify(sessionData));
    if (rememberMe) {
      localStorage.setItem(ADMIN_AUTH_KEY, JSON.stringify(sessionData));
    }
    return { success: true, user: fallbackUser, token: fallbackToken };
  }

  return { success: false, error: 'Invalid administrator credentials. Please check your username and password.' };
}

export function adminLogout(): void {
  try {
    sessionStorage.removeItem(ADMIN_AUTH_KEY);
    localStorage.removeItem(ADMIN_AUTH_KEY);
  } catch (e) {
    console.error('Error clearing admin session:', e);
  }
}
