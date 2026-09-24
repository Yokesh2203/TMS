import React, { useState } from 'react';
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
      const isMySql = result?.source === 'mysql' || saveSource === 'mysql';

      // Trigger Toast notification
      setToast({
        id: `toast-${Date.now()}`,
        title: 'Registration Submitted Successfully!',
        message: `${studentRecord.studentName} (${studentRecord.identifier}) was saved to ${isMySql ? 'MySQL (nadar_tms)' : 'database'}.`,
        type: 'success',
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
            <div className="flex items-center justify-between">
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
                    {BUS_ROUTES.length} NSCET routes available
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
                  {formData.busRouteId && (
                    <span className="text-[11px] text-indigo-700 font-medium">
                      {availableStops.length} stops on this route
                    </span>
                  )}
                </div>

                <div className="relative">
                  <select
                    id="stopping-name-select"
                    value={formData.stoppingName}
                    onChange={(e) => handleInputChange('stoppingName', e.target.value)}
                    disabled={!formData.busRouteId}
                    className={`w-full px-4 py-2.5 text-sm bg-slate-50/50 hover:bg-white focus:bg-white border rounded-xl appearance-none pr-10 focus:outline-none focus:ring-2 transition-all disabled:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400 ${
                      errors.stoppingName
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-200 text-rose-900'
                        : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-100 text-slate-900'
                    }`}
                  >
                    <option value="">
                      {formData.busRouteId
                        ? '-- Choose Boarding Stop --'
                        : '-- Select Route First --'}
                    </option>
                    {availableStops.map((stop) => (
                      <option key={stop} value={stop}>
                        {stop}
                      </option>
                    ))}
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
