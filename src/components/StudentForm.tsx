import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  GraduationCap,
  Bus,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Building2,
  User,
  ArrowRight,
  Database,
  Clock,
  ShieldCheck,
  Hash,
  BookOpen,
  Search,
  X,
  Navigation,
} from 'lucide-react';
import {
  Student,
  StudentFormData,
} from '../types';
import {
  INSTITUTIONS,
  BUS_ROUTES,
  ENGINEERING_DEPARTMENTS,
  COLLEGE_YEARS,
} from '../data/mockData';
import { Toast, ToastData } from './Toast';

interface StudentFormProps {
  onSaveStudent: (student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>) => Promise<any> | any;
  editingStudent?: Student | null;
  onCancelEdit?: () => void;
  saveSource?: 'mysql' | 'local' | null;
}

export const StudentForm: React.FC<StudentFormProps> = ({
  onSaveStudent,
  saveSource,
}) => {
  const [formData, setFormData] = useState<StudentFormData>({
    institutionId: '1', // NSCET Engineering College default
    studentName: '',
    identifier: '',
    departmentOrClass: '',
    yearOrSection: '',
    busRouteId: '',
    stoppingName: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastSavedStudent, setLastSavedStudent] = useState<Student | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);

  // Search input state for quick Stop / Route lookup
  const [stopSearchQuery, setStopSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedInstitution = INSTITUTIONS[0] || {
    id: '1',
    name: 'Nadar Saraswathi College of Engineering & Technology (NSCET)',
    type: 'college',
    code: 'NSCET',
    city: 'Vadapudupatti, Theni',
  };

  // Selected route and available stops
  const selectedRoute = BUS_ROUTES.find((r) => r.id === formData.busRouteId);
  const availableStops = selectedRoute ? selectedRoute.stops : [];

  // Map of every unique stop across all 187 routes with its routes
  const allUniqueStops = useMemo(() => {
    const map = new Map<string, Array<{ routeId: string; routeNumber: string; routeName: string }>>();
    BUS_ROUTES.forEach((route) => {
      route.stops.forEach((stop) => {
        const clean = stop.trim();
        if (!clean) return;
        if (!map.has(clean)) {
          map.set(clean, []);
        }
        map.get(clean)!.push({
          routeId: route.id,
          routeNumber: route.routeNumber,
          routeName: route.name,
        });
      });
    });
    return Array.from(map.entries())
      .map(([stopName, routes]) => ({ stopName, routes }))
      .sort((a, b) => a.stopName.localeCompare(b.stopName));
  }, []);

  // Search results matching stop name or route name
  const searchResults = useMemo(() => {
    const q = stopSearchQuery.trim().toLowerCase();
    if (!q) return [];

    const matches: Array<{
      type: 'stop' | 'route';
      title: string;
      subtitle: string;
      routeId: string;
      stopName: string;
    }> = [];

    // 1. Matches on Stop names
    allUniqueStops.forEach((item) => {
      if (item.stopName.toLowerCase().includes(q)) {
        item.routes.forEach((r) => {
          matches.push({
            type: 'stop',
            title: item.stopName,
            subtitle: `${r.routeNumber} — ${r.routeName}`,
            routeId: r.routeId,
            stopName: item.stopName,
          });
        });
      }
    });

    // 2. Matches on Route names or numbers
    BUS_ROUTES.forEach((r) => {
      if (r.name.toLowerCase().includes(q) || r.routeNumber.toLowerCase().includes(q)) {
        if (r.stops.length > 0) {
          matches.push({
            type: 'route',
            title: `${r.routeNumber} — ${r.name}`,
            subtitle: `Covers ${r.stops.length} stops (e.g. ${r.stops[0]})`,
            routeId: r.id,
            stopName: r.stops[0],
          });
        }
      }
    });

    return matches.slice(0, 30);
  }, [stopSearchQuery, allUniqueStops]);

  // Handle direct selection from search result
  const handleSelectStopAndRoute = (routeId: string, stopName: string) => {
    setFormData((prev) => ({
      ...prev,
      busRouteId: routeId,
      stoppingName: stopName,
    }));
    setStopSearchQuery('');
    setIsSearchOpen(false);

    if (errors.busRouteId || errors.stoppingName) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.busRouteId;
        delete next.stoppingName;
        return next;
      });
    }
  };

  // Handle route change -> dynamically updates boarding stops
  const handleRouteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRouteId = e.target.value;
    const route = BUS_ROUTES.find((r) => r.id === newRouteId);

    setFormData((prev) => {
      const isCurrentStopValid = route ? route.stops.includes(prev.stoppingName) : false;
      return {
        ...prev,
        busRouteId: newRouteId,
        stoppingName: isCurrentStopValid ? prev.stoppingName : '',
      };
    });

    if (errors.busRouteId) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.busRouteId;
        return next;
      });
    }
  };

  // Handle stop change: automatically finds and sets the route if not already set or invalid
  const handleStopChange = (stopName: string) => {
    if (stopName === '__SHOW_ALL_STOPS__') {
      setFormData((prev) => ({ ...prev, busRouteId: '', stoppingName: '' }));
      return;
    }

    const clean = stopName.trim();
    if (!clean) {
      setFormData((prev) => ({ ...prev, stoppingName: '' }));
      return;
    }

    const matchingRoutes = BUS_ROUTES.filter((r) =>
      r.stops.some((s) => s.trim().toLowerCase() === clean.toLowerCase())
    );

    let targetRouteId = formData.busRouteId;
    if (!targetRouteId || !matchingRoutes.some((r) => r.id === targetRouteId)) {
      targetRouteId = matchingRoutes.length > 0 ? matchingRoutes[0].id : formData.busRouteId;
    }

    setFormData((prev) => ({
      ...prev,
      stoppingName: clean,
      busRouteId: targetRouteId || prev.busRouteId,
    }));

    if (errors.stoppingName || errors.busRouteId) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.stoppingName;
        delete next.busRouteId;
        return next;
      });
    }
  };

  const handleInputChange = (field: keyof StudentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.studentName.trim()) {
      newErrors.studentName = 'Please enter your full name.';
    }

    if (!formData.identifier.trim()) {
      newErrors.identifier = 'Anna University 12-digit Register Number is required.';
    }

    if (!formData.departmentOrClass) {
      newErrors.departmentOrClass = 'Please select your Engineering Department.';
    }

    if (!formData.yearOrSection) {
      newErrors.yearOrSection = 'Please select your Year of Study.';
    }

    if (!formData.busRouteId) {
      newErrors.busRouteId = 'Please select your transit bus route.';
    }

    if (!formData.stoppingName) {
      newErrors.stoppingName = 'Please select your boarding stopping point.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const inst = selectedInstitution;
      const route = BUS_ROUTES.find((r) => r.id === formData.busRouteId)!;

      const studentRecord: Omit<Student, 'id' | 'createdAt' | 'updatedAt'> = {
        institutionId: inst.id,
        institutionName: inst.name,
        institutionType: 'college',
        studentName: formData.studentName.trim(),
        identifier: formData.identifier.trim(),
        departmentOrClass: formData.departmentOrClass,
        yearOrSection: formData.yearOrSection,
        busRouteId: route.id,
        busRouteName: `${route.routeNumber} - ${route.name}`,
        stoppingName: formData.stoppingName,
      };

      const result = await onSaveStudent(studentRecord);
      const isMySql = result?.source === 'mysql';

      // Trigger Toast notification
      setToast({
        id: `toast-${Date.now()}`,
        title: isMySql 
          ? 'Registration Saved to Cloud Database!' 
          : '⚠️ Saved to Local Storage (Backend Offline)',
        message: isMySql
          ? `${studentRecord.studentName} (${studentRecord.identifier}) was written directly to Railway MySQL.`
          : `${studentRecord.studentName} was saved to browser storage because the Railway backend was unreachable.`,
        type: isMySql ? 'success' : 'info',
        dbSource: isMySql ? 'mysql' : 'local',
      });

      // Save temporary reference for confirmation banner
      setLastSavedStudent({
        ...studentRecord,
        id: result?.savedStudent?.id || `saved-${Date.now()}`,
        createdAt: new Date().toISOString(),
      });

      // Reset form fields
      setFormData({
        institutionId: '1',
        studentName: '',
        identifier: '',
        departmentOrClass: '',
        yearOrSection: '',
        busRouteId: '',
        stoppingName: '',
      });
    } catch (err) {
      console.error(err);
      setToast({
        id: `toast-err-${Date.now()}`,
        title: 'Database Error',
        message: 'Could not submit student registration.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      institutionId: '1',
      studentName: '',
      identifier: '',
      departmentOrClass: '',
      yearOrSection: '',
      busRouteId: '',
      stoppingName: '',
    });
    setErrors({});
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} duration={4500} />

      {/* Confirmation Banner when student is saved */}
      {lastSavedStudent && (
        <div className="bg-emerald-50/95 border border-emerald-200 rounded-2xl p-5 shadow-xs transition-all animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-emerald-950">
                    Registration Safely Recorded in Database
                  </h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                    <ShieldCheck className="h-3 w-3" />
                    {saveSource === 'mysql' ? 'Saved to MySQL (phpMyAdmin)' : 'Saved to Local Storage'}
                  </span>
                </div>
                <p className="text-xs text-emerald-800/90 mt-1">
                  <strong>{lastSavedStudent.studentName}</strong> (Reg No: <strong>{lastSavedStudent.identifier}</strong>) enrolled in{' '}
                  <span className="font-semibold">{lastSavedStudent.departmentOrClass}</span> and assigned to{' '}
                  <strong>{lastSavedStudent.busRouteName}</strong> at stop <strong>{lastSavedStudent.stoppingName}</strong>.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLastSavedStudent(null)}
              className="text-xs font-medium text-emerald-700 hover:text-emerald-900 px-3 py-1.5 rounded-lg hover:bg-emerald-100/70 transition-colors self-end sm:self-center cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Main Student Entry Card */}
      <div
        id="student-data-entry-card"
        className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden transition-all"
      >
        {/* Card Header */}
        <div className="px-6 sm:px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <span className="h-10 w-10 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center text-xs font-semibold shadow-xs">
              <GraduationCap className="h-5 w-5 text-indigo-300" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">
                NSCET Student Registration & Bus Allocation
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Nadar Saraswathi College of Engineering & Technology — Transit Enrollment Portal
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-7">
          {/* SECTION 1: Academic Profile */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 tracking-wide uppercase">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                  1
                </span>
                <span>Engineering Academic Profile</span>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                <Building2 className="h-3.5 w-3.5" />
                NSCET Engineering
              </span>
            </div>

            {/* Institution Badge / Display */}
            <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  NS
                </div>
                <div>
                  <div className="font-bold text-slate-900">
                    Nadar Saraswathi College of Engineering & Technology (NSCET)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Vadapudupatti, Theni • Approved by AICTE, Affiliated to Anna University
                  </div>
                </div>
              </div>
              <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">
                Anna Univ Code: 9210
              </span>
            </div>

            {/* Academic Fields: Register Number, Department, Year */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Register Number */}
              <div>
                <label
                  htmlFor="register-number-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Register Number <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="register-number-input"
                    placeholder="e.g. 921023243001"
                    maxLength={15}
                    value={formData.identifier}
                    onChange={(e) => handleInputChange('identifier', e.target.value.trim())}
                    className={`w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border font-mono rounded-xl focus:outline-none focus:ring-2 transition-all ${
                      errors.identifier
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 text-rose-900'
                        : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100 text-slate-900'
                    }`}
                  />
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Hash className="h-4 w-4" />
                  </div>
                </div>
                {errors.identifier ? (
                  <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.identifier}
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-400">
                    e.g. 921023243001 (AD), 921023105001 (IT)
                  </p>
                )}
              </div>

              {/* Department */}
              <div>
                <label
                  htmlFor="department-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Department <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="department-select"
                    value={formData.departmentOrClass}
                    onChange={(e) => handleInputChange('departmentOrClass', e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl appearance-none pr-8 focus:outline-none focus:ring-2 transition-all cursor-pointer ${
                      errors.departmentOrClass
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 text-rose-900'
                        : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100 text-slate-900'
                    }`}
                  >
                    <option value="">-- Select Department --</option>
                    {ENGINEERING_DEPARTMENTS.map((dept) => (
                      <option key={dept.code} value={dept.name}>
                        {dept.code} - {dept.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {errors.departmentOrClass && (
                  <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.departmentOrClass}
                  </p>
                )}
              </div>

              {/* Year */}
              <div>
                <label
                  htmlFor="year-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Year of Study <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    id="year-select"
                    value={formData.yearOrSection}
                    onChange={(e) => handleInputChange('yearOrSection', e.target.value)}
                    className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl appearance-none pr-8 focus:outline-none focus:ring-2 transition-all cursor-pointer ${
                      errors.yearOrSection
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 text-rose-900'
                        : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100 text-slate-900'
                    }`}
                  >
                    <option value="">-- Choose Year --</option>
                    {COLLEGE_YEARS.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {errors.yearOrSection && (
                  <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.yearOrSection}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 2: Student Identity */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 tracking-wide uppercase">
              <span className="flex items-center justify-center h-5 w-5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                2
              </span>
              <span>Student Personal Details</span>
            </div>

            <div>
              <label
                htmlFor="student-name-input"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Student Full Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="student-name-input"
                  placeholder="e.g. Sneha Sharma, Vignesh Kumar"
                  value={formData.studentName}
                  onChange={(e) => handleInputChange('studentName', e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50/50 hover:bg-white focus:bg-white border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                    errors.studentName
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 text-rose-900'
                      : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100 text-slate-900'
                  }`}
                />
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <User className="h-4 w-4" />
                </div>
              </div>
              {errors.studentName && (
                <p className="mt-1.5 text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {errors.studentName}
                </p>
              )}
            </div>
          </div>

          {/* SECTION 3: Bus Transport & Boarding Assignment */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 tracking-wide uppercase">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                  3
                </span>
                <span>Bus Transport & Boarding Assignment</span>
              </div>

              {selectedRoute && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-700 font-medium flex items-center gap-1.5 bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-full border border-amber-200">
                    <Clock className="h-3 w-3 text-amber-600" />
                    Departs {selectedRoute.timing}
                  </span>
                  {selectedRoute.distance ? (
                    <span className="text-xs font-semibold flex items-center gap-1 bg-indigo-50 text-indigo-800 px-2.5 py-0.5 rounded-full border border-indigo-200">
                      {selectedRoute.distance} km
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            {/* Quick Stop & Route Finder Search Bar with Search Button */}
            <div className="bg-gradient-to-r from-indigo-50/70 via-blue-50/50 to-slate-50 border border-indigo-100/80 rounded-2xl p-3.5 sm:p-4 space-y-2.5" ref={searchContainerRef}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <label
                  htmlFor="stop-search-input"
                  className="text-xs font-semibold text-indigo-950 flex items-center gap-1.5"
                >
                  <Search className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Don't know your route name? Search by Stop or Village:</span>
                </label>
                <span className="text-[11px] text-indigo-600 font-medium">
                  {allUniqueStops.length} stops & {BUS_ROUTES.length} routes available
                </span>
              </div>

              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      id="stop-search-input"
                      placeholder="Type stop name (e.g. Park Stop, Aranmanai, G.H, Theni, Chinnamanur, Cumbum, Bodi)..."
                      value={stopSearchQuery}
                      onChange={(e) => {
                        setStopSearchQuery(e.target.value);
                        setIsSearchOpen(true);
                      }}
                      onFocus={() => setIsSearchOpen(true)}
                      className="w-full pl-10 pr-9 py-2.5 text-sm bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-500 transition-all text-slate-900 placeholder:text-slate-400 shadow-2xs"
                    />
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-indigo-500">
                      <Search className="h-4 w-4" />
                    </div>
                    {stopSearchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setStopSearchQuery('');
                          setIsSearchOpen(false);
                        }}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    id="search-stop-btn"
                    onClick={() => setIsSearchOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-sm font-semibold shadow-xs hover:shadow transition-all shrink-0 cursor-pointer"
                  >
                    <Search className="h-4 w-4" />
                    <span className="hidden sm:inline">Search</span> Stop
                  </button>
                </div>

                {/* Search Results Popover */}
                {isSearchOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-indigo-100 max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-150">
                    {searchResults.length > 0 ? (
                      <div>
                        <div className="p-2.5 bg-indigo-50/60 text-[11px] font-semibold text-indigo-900 flex items-center justify-between sticky top-0 z-10 border-b border-indigo-100">
                          <span>Found {searchResults.length} matching stop{searchResults.length > 1 ? 's' : ''} / routes</span>
                          <span className="text-slate-400 font-normal">Click to auto-select</span>
                        </div>
                        {searchResults.map((item, idx) => (
                          <button
                            key={`${item.routeId}-${item.stopName}-${idx}`}
                            type="button"
                            onClick={() => handleSelectStopAndRoute(item.routeId, item.stopName)}
                            className="w-full text-left px-4 py-2.5 hover:bg-indigo-50/80 transition-colors flex items-center justify-between gap-3 group cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-md shrink-0 ${
                                item.type === 'stop'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {item.type === 'stop' ? 'Stop' : 'Route'}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                  {item.title}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  {item.subtitle}
                                </p>
                              </div>
                            </div>
                            <span className="text-[11px] text-indigo-600 font-medium shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                              Select <ArrowRight className="h-3 w-3" />
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : stopSearchQuery.trim() ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        No stops or routes found matching "{stopSearchQuery}". Please try another village or stop name.
                      </div>
                    ) : (
                      <div className="p-4 text-xs text-slate-600 space-y-2">
                        <p className="font-semibold text-slate-800">Popular Boarding Locations:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {['PARK STOP', 'BODI', 'CHINNAMANUR', 'AUNDIPATTI', 'PERIYAKULAM', 'THENI NEW BUS STAND', 'CUMBUM', 'VEERAPANDI'].map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                setStopSearchQuery(name);
                                setIsSearchOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-800 rounded-lg transition-colors cursor-pointer"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Selection Confirmation Card */}
            {formData.stoppingName && formData.busRouteId && selectedRoute && (
              <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-in fade-in duration-150">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Navigation className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-950">
                      Assigned Stop: <span className="text-emerald-700 font-bold">{formData.stoppingName}</span>
                    </p>
                    <p className="text-[11px] text-emerald-800">
                      {selectedRoute.routeNumber} — {selectedRoute.name} (Departs: {selectedRoute.timing})
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, busRouteId: '', stoppingName: '' }))}
                  className="text-[11px] font-medium text-emerald-700 hover:text-emerald-900 underline self-start sm:self-center cursor-pointer"
                >
                  Change Selection
                </button>
              </div>
            )}

            {/* Route & Stop Dropdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {/* Bus Route Dropdown */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="bus-route-select"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Bus Route <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {BUS_ROUTES.length} NSCET routes
                  </span>
                </div>
                <div className="relative">
                  <select
                    id="bus-route-select"
                    value={formData.busRouteId}
                    onChange={handleRouteChange}
                    className={`w-full px-4 py-2.5 text-sm bg-slate-50/50 hover:bg-white focus:bg-white border rounded-xl appearance-none pr-10 focus:outline-none focus:ring-2 transition-all cursor-pointer ${
                      errors.busRouteId
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 text-rose-900'
                        : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100 text-slate-900'
                    }`}
                  >
                    <option value="">-- Choose Transit Route ({BUS_ROUTES.length}) --</option>
                    {BUS_ROUTES.map((route) => (
                      <option key={route.id} value={route.id}>
                        {route.routeNumber} — {route.name} {route.origin && route.origin !== route.name ? `[${route.origin}]` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                    <Bus className="w-4 h-4" />
                  </div>
                </div>
                {errors.busRouteId && (
                  <p className="mt-1.5 text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.busRouteId}
                  </p>
                )}
              </div>

              {/* Stopping Name Dropdown */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="stopping-name-select"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Boarding Stop <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-indigo-700 font-medium">
                    {formData.busRouteId
                      ? `${availableStops.length} stops on this route`
                      : `${allUniqueStops.length} all stops (select directly)`}
                  </span>
                </div>

                <div className="relative">
                  <select
                    id="stopping-name-select"
                    value={formData.stoppingName}
                    onChange={(e) => handleStopChange(e.target.value)}
                    className={`w-full px-4 py-2.5 text-sm bg-slate-50/50 hover:bg-white focus:bg-white border rounded-xl appearance-none pr-10 focus:outline-none focus:ring-2 transition-all cursor-pointer ${
                      errors.stoppingName
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 text-rose-900'
                        : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100 text-slate-900'
                    }`}
                  >
                    {formData.busRouteId ? (
                      <>
                        <option value="">-- Choose Boarding Stop on Route ({availableStops.length}) --</option>
                        {availableStops.map((stop) => (
                          <option key={stop} value={stop}>
                            {stop}
                          </option>
                        ))}
                        <option value="__SHOW_ALL_STOPS__">🔄 Browse all {allUniqueStops.length} stops across all routes</option>
                      </>
                    ) : (
                      <>
                        <option value="">-- Select Any Boarding Stop ({allUniqueStops.length}) --</option>
                        {allUniqueStops.map((s) => (
                          <option key={s.stopName} value={s.stopName}>
                            {s.stopName} {s.routes[0] ? `(${s.routes[0].routeNumber})` : ''}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
                    <MapPin className="w-4 h-4" />
                  </div>
                </div>
                {errors.stoppingName && (
                  <p className="mt-1.5 text-xs text-rose-600 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.stoppingName}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="submit"
                id="save-student-btn"
                disabled={isSubmitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer disabled:opacity-50"
              >
                <Database className="h-4 w-4" />
                <span>Submit</span>
                <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
              </button>

              <button
                type="button"
                id="clear-form-btn"
                onClick={handleReset}
                className="w-full sm:w-auto px-4 py-3 rounded-xl font-medium text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                Clear Form
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
