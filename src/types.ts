export type InstitutionType = 'college';

export interface Institution {
  id: string;
  name: string;
  type: InstitutionType;
  code: string;
  city: string;
}

export interface BusRoute {
  id: string;
  routeNumber: string;
  name: string;
  origin?: string;
  destination?: string;
  distance?: number;
  institutionId?: string | null;
  shift?: string;
  timing: string;
  stops: string[];
}

export interface Student {
  id: string;
  institutionId: string;
  institutionName: string;
  institutionType: InstitutionType;
  studentName: string;
  identifier: string; // Register No (12-digit Anna University Register Number)
  departmentOrClass: string; // Engineering Department
  yearOrSection: string; // Engineering Year (1st, 2nd, 3rd, 4th)
  busRouteId: string;
  busRouteName: string;
  stoppingName: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StudentFormData {
  institutionId: string;
  studentName: string;
  identifier: string; // Register Number
  departmentOrClass: string; // Department
  yearOrSection: string; // Year
  busRouteId: string;
  stoppingName: string;
}

export interface FilterState {
  searchQuery: string;
  department: string;
  year: string;
  busRouteId: string;
  stoppingName: string;
}

export interface AdminUser {
  username: string;
  name: string;
  role: 'admin';
  token?: string;
  loggedInAt?: string;
}

export interface AdminAuthState {
  isAuthenticated: boolean;
  user: AdminUser | null;
  token: string | null;
}
