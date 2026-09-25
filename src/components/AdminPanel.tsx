import React, { useState, useMemo } from 'react';
import {
  Building2,
  Search,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  FileDown,
  Layers,
  ShieldCheck,
  ArrowUpDown,
  ShieldX,
} from 'lucide-react';
import { Student } from '../types';
import {
  ENGINEERING_DEPARTMENTS,
  COLLEGE_YEARS,
} from '../data/mockData';
import {
  detectRegisterNumberGaps,
  detectDepartmentGaps,
  extractRollNumber,
} from '../utils/gapDetection';

// Persists which DEPARTMENTS have been manually verified by admin
const VERIFIED_DEPTS_KEY = 'nscet_tms_verified_departments_v1';

interface AdminPanelProps {
  students: Student[];
  onRefreshStudents?: () => void;
  isRefreshing?: boolean;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  students,
  onRefreshStudents,
  isRefreshing = false,
}) => {
  // Department filter: 'ALL' or department full name
  const [selectedDept, setSelectedDept] = useState<string>('ALL');

  // Year filter
  const [selectedYear, setSelectedYear] = useState<string>('ALL');

  // General controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Table roster view: 'all_slots' (shows 1 to Max with missing slots), 'submitted', or 'missing'
  const [tableRosterView, setTableRosterView] = useState<'all_slots' | 'submitted' | 'missing'>('all_slots');

  // Department-level verification state (Set of department names verified by admin)
  const [verifiedDepts, setVerifiedDepts] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(VERIFIED_DEPTS_KEY);
      if (saved) {
        const arr = JSON.parse(saved);
        return new Set(Array.isArray(arr) ? arr : []);
      }
    } catch (e) {
      console.error('Error reading verified departments from localStorage:', e);
    }
    return new Set<string>();
  });

  // Toggle department verification
  const toggleDeptVerification = (deptName: string) => {
    setVerifiedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptName)) {
        next.delete(deptName);
      } else {
        next.add(deptName);
      }
      try {
        localStorage.setItem(VERIFIED_DEPTS_KEY, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  // Filter students based on Department, Year, and Search Query
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (selectedDept !== 'ALL' && s.departmentOrClass !== selectedDept) return false;
      if (selectedYear !== 'ALL' && s.yearOrSection !== selectedYear) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = (s.studentName || '').toLowerCase().includes(query);
        const matchesId = (s.identifier || '').toLowerCase().includes(query);
        const matchesDept = (s.departmentOrClass || '').toLowerCase().includes(query);
        const matchesRoute = (s.busRouteName || '').toLowerCase().includes(query);
        const matchesStop = (s.stoppingName || '').toLowerCase().includes(query);
        if (!matchesName && !matchesId && !matchesDept && !matchesRoute && !matchesStop) return false;
      }
      return true;
    });
  }, [students, selectedDept, selectedYear, searchQuery]);

  // Sort students for the table
  const sortedStudents = useMemo(() => {
    const list = [...filteredStudents];
    list.sort((a, b) => {
      const aVal = (a.identifier || '').trim();
      const bVal = (b.identifier || '').trim();
      if (/^\d+$/.test(aVal) && /^\d+$/.test(bVal)) {
        try {
          const diff = BigInt(aVal) - BigInt(bVal);
          return sortOrder === 'asc' ? (diff < 0n ? -1 : 1) : (diff > 0n ? -1 : 1);
        } catch { /* fallback */ }
      }
      return sortOrder === 'asc'
        ? aVal.localeCompare(bVal, undefined, { numeric: true })
        : bVal.localeCompare(aVal, undefined, { numeric: true });
    });
    return list;
  }, [filteredStudents, sortOrder]);

  // Filter students by Year of Study so gap analysis and counts strictly respect the selected Year!
  const yearFilteredStudents = useMemo(() => {
    if (selectedYear === 'ALL') return students;
    return students.filter((s) => s.yearOrSection === selectedYear);
  }, [students, selectedYear]);

  // Department-Isolated Gap Analysis (strictly filtered by selectedYear!)
  const departmentGapAnalysis = useMemo(() => {
    const records = yearFilteredStudents.map((s) => ({
      identifier: s.identifier,
      departmentOrClass: s.departmentOrClass || 'General',
    }));
    return detectDepartmentGaps(records);
  }, [yearFilteredStudents]);

  // Single Department Gap Result (strictly filtered by selectedDept AND selectedYear!)
  const singleDeptGapResult = useMemo(() => {
    if (selectedDept === 'ALL') return null;
    const ids = yearFilteredStudents
      .filter((s) => s.departmentOrClass === selectedDept)
      .map((s) => s.identifier);
    return detectRegisterNumberGaps(ids);
  }, [yearFilteredStudents, selectedDept]);

  // Total missing count for the KPI card
  const totalMissingCount = useMemo(() => {
    if (selectedDept !== 'ALL') {
      return singleDeptGapResult ? singleDeptGapResult.missingCount : 0;
    }
    return departmentGapAnalysis.totalMissingCount;
  }, [selectedDept, singleDeptGapResult, departmentGapAnalysis]);

  // Build a quick lookup: deptName -> { hasGaps, totalSubmitted, minReg, maxReg }
  const deptGapMap = useMemo(() => {
    const map: Record<string, { hasGaps: boolean; totalSubmitted: number; missingCount: number }> = {};
    departmentGapAnalysis.departmentReports.forEach((rep) => {
      map[rep.department] = {
        hasGaps: rep.hasGaps,
        totalSubmitted: rep.totalSubmitted,
        missingCount: rep.missingCount,
      };
    });
    return map;
  }, [departmentGapAnalysis]);

  // Determine whether a department is "green" (verified by admin AND no gaps)
  const isDeptGreen = (deptName: string): boolean => {
    const gap = deptGapMap[deptName];
    if (!gap || gap.totalSubmitted === 0) return false;
    return verifiedDepts.has(deptName) && !gap.hasGaps;
  };

  // Combine submitted students with missing register numbers for a complete S.No / Roll Number roster
  const rosterItems = useMemo(() => {
    // Determine which missing numbers belong to current department/filter
    const missingList = selectedDept === 'ALL'
      ? departmentGapAnalysis.allMissingNumbers
      : (singleDeptGapResult?.missingNumbers || []);

    const submittedItems = sortedStudents.map((s, idx) => {
      const rollInfo = extractRollNumber(s.identifier);
      return {
        key: s.id || `sub-${s.identifier}-${idx}`,
        sNo: rollInfo ? rollInfo.rollNo : idx + 1,
        identifier: s.identifier,
        studentName: s.studentName,
        departmentOrClass: s.departmentOrClass,
        yearOrSection: s.yearOrSection,
        busRouteId: s.busRouteId,
        busRouteName: s.busRouteName,
        stoppingName: s.stoppingName,
        isSubmitted: true,
      };
    });

    // If search query is entered, only show matching submitted records
    if (searchQuery.trim()) {
      return submittedItems;
    }

    const missingRows = missingList.map((missingId) => {
      const rollInfo = extractRollNumber(missingId);
      return {
        key: `missing-${missingId}`,
        sNo: rollInfo ? rollInfo.rollNo : 0,
        identifier: missingId,
        studentName: 'Not Submitted',
        departmentOrClass: selectedDept === 'ALL' ? 'Unassigned' : selectedDept,
        yearOrSection: selectedYear === 'ALL' ? '-' : selectedYear,
        busRouteId: '-',
        busRouteName: '-',
        stoppingName: '-',
        isSubmitted: false,
      };
    });

    let allCombined = [...submittedItems, ...missingRows];
    allCombined.sort((a, b) => {
      if (a.sNo !== b.sNo && a.sNo !== 0 && b.sNo !== 0) {
        return sortOrder === 'asc' ? a.sNo - b.sNo : b.sNo - a.sNo;
      }
      return sortOrder === 'asc'
        ? a.identifier.localeCompare(b.identifier, undefined, { numeric: true })
        : b.identifier.localeCompare(a.identifier, undefined, { numeric: true });
    });

    if (tableRosterView === 'submitted') {
      return allCombined.filter((x) => x.isSubmitted);
    }
    if (tableRosterView === 'missing') {
      return allCombined.filter((x) => !x.isSubmitted);
    }
    return allCombined;
  }, [sortedStudents, searchQuery, selectedDept, departmentGapAnalysis, singleDeptGapResult, selectedYear, sortOrder, tableRosterView]);

  const submittedCount = sortedStudents.length;
  const missingCount = useMemo(() => {
    if (selectedDept === 'ALL') {
      return departmentGapAnalysis.totalMissingCount;
    }
    return singleDeptGapResult?.missingCount || 0;
  }, [selectedDept, departmentGapAnalysis, singleDeptGapResult]);
  const totalRosterCount = submittedCount + missingCount;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Export records CSV (exports current roster view including S.No)
  const handleExportCSV = () => {
    if (rosterItems.length === 0) return;
    const headers = ['S.No', 'Register Number', 'Student Name', 'Department', 'Year of Study', 'Bus Route', 'Boarding Stop', 'Status'];
    const rows = rosterItems.map((item) => [
      `"${item.sNo > 0 ? item.sNo : ''}"`,
      `"${item.identifier}"`,
      `"${item.studentName}"`,
      `"${item.departmentOrClass}"`,
      `"${item.yearOrSection}"`,
      `"${item.busRouteName}"`,
      `"${item.stoppingName}"`,
      `"${item.isSubmitted ? 'Submitted' : 'Not Submitted'}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `nscet_students_register.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export missing register numbers CSV
  const handleExportMissingCSV = () => {
    const reports = selectedDept !== 'ALL' && singleDeptGapResult
      ? [{ department: selectedDept, ...singleDeptGapResult }]
      : departmentGapAnalysis.departmentReports;

    const rows: string[][] = [];
    let sNo = 1;
    reports.forEach((rep) => {
      rep.missingNumbers.forEach((num) => {
        rows.push([String(sNo++), `"${num}"`, `"${rep.department}"`, `"${rep.minRegisterNumber || ''}"`, `"${rep.maxRegisterNumber || ''}"`, '"Not Submitted / Missing"']);
      });
    });
    if (rows.length === 0) return;

    const headers = ['S.No', 'Missing Register Number', 'Department', 'Dept Min Reg No', 'Dept Max Reg No', 'Status'];
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `nscet_missing_reg_numbers.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDeptShortCode = (deptName: string): string =>
    ENGINEERING_DEPARTMENTS.find((d) => d.name === deptName)?.code ?? deptName;

  // Count verified (green) departments
  const verifiedGreenDepts = ENGINEERING_DEPARTMENTS.filter((d) => isDeptGreen(d.name)).length;

  return (
    <div className="space-y-6">


      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Submitted */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Submitted</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 font-mono">{filteredStudents.length}</div>
          <p className="text-[11px] text-slate-500 mt-1">
            {selectedDept === 'ALL' ? 'All departments' : selectedDept}
            {selectedYear !== 'ALL' && ` • ${selectedYear}`}
          </p>
        </div>

        {/* Card 2: Departments Verified */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Departments Verified</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 font-mono">
            <span className="text-2xl font-extrabold text-emerald-600">{verifiedGreenDepts}</span>
            <span className="text-xs text-slate-400 font-semibold">/ {ENGINEERING_DEPARTMENTS.length} Depts</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {verifiedGreenDepts === ENGINEERING_DEPARTMENTS.length
              ? '🎉 All departments verified!'
              : `${ENGINEERING_DEPARTMENTS.length - verifiedGreenDepts} departments pending review`}
          </p>
        </div>

        {/* Card 3: Missing Register Numbers */}
        <div className={`rounded-2xl p-5 border shadow-xs transition-all ${
          totalMissingCount > 0
            ? 'bg-rose-50/70 border-rose-200/90 text-rose-950'
            : 'bg-emerald-50/70 border-emerald-200/90 text-emerald-950'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider opacity-75">Missing Register Numbers</span>
            <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
              totalMissingCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
            }`}>
              {totalMissingCount > 0 ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono">{totalMissingCount}</div>
          <p className="text-[11px] opacity-80 mt-1">
            {totalMissingCount > 0 
              ? `Gaps detected ${selectedYear !== 'ALL' ? `in ${selectedYear}` : '— per department series'}`
              : yearFilteredStudents.length === 0
              ? `No submissions recorded ${selectedYear !== 'ALL' ? `for ${selectedYear}` : 'yet'}`
              : `Continuous sequence ${selectedYear !== 'ALL' ? `for ${selectedYear}` : ''} — no gaps found`}
          </p>
        </div>
      </div>

      {/* Dynamic Filter Controls Bar */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        {/* Row 1: Year Filter & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-center">
          <div className="sm:col-span-5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Institution</label>
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold text-xs">
              <Building2 className="h-4 w-4 text-indigo-600 shrink-0" />
              <span className="truncate">Nadar Saraswathi College of Engg & Tech (NSCET)</span>
            </div>
          </div>

          <div className="sm:col-span-3">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Year of Study</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full py-2.5 pl-3.5 pr-8 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-semibold focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all cursor-pointer"
            >
              <option value="ALL">All Years (1st - 4th)</option>
              {COLLEGE_YEARS.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-4">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Search Records</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, reg no, stop..."
                className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >✕</button>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Department Filter Pills */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>Select Department</span>
              <span className="text-[10px] font-normal text-slate-400 lowercase">(click pill to filter)</span>
            </label>
            {selectedDept !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedDept('ALL')}
                className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
              >
                Clear Department Filter
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* All Departments Pill */}
            <button
              type="button"
              onClick={() => setSelectedDept('ALL')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none ${
                selectedDept === 'ALL'
                  ? 'bg-blue-50/90 text-blue-700 border-2 border-blue-600 shadow-xs ring-2 ring-blue-100 font-bold'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span>All Departments</span>
              {selectedDept === 'ALL' ? (
                <Check className="h-3.5 w-3.5 text-blue-600 stroke-[3]" />
              ) : (
                <span className="text-slate-400 font-bold ml-0.5 text-xs">+</span>
              )}
            </button>

            {/* Engineering Department Pills */}
            {ENGINEERING_DEPARTMENTS.map((dept) => {
              const isSelected = selectedDept === dept.name;
              const isGreen = isDeptGreen(dept.name);

              const pillClass = isSelected
                ? 'bg-blue-50/90 text-blue-700 border-2 border-blue-600 shadow-xs ring-2 ring-blue-100 font-bold'
                : isGreen
                ? 'bg-emerald-50/90 text-emerald-700 border-2 border-emerald-500 shadow-xs ring-2 ring-emerald-100 font-bold'
                : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50';

              return (
                <button
                  key={dept.code}
                  type="button"
                  onClick={() => setSelectedDept(isSelected ? 'ALL' : dept.name)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none ${pillClass}`}
                  title={isGreen ? `${dept.name} — Verified ✓` : dept.name}
                >
                  <span>{dept.code}</span>
                  {isSelected ? (
                    <Check className="h-3.5 w-3.5 text-blue-600 stroke-[3]" />
                  ) : isGreen ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[3]" />
                  ) : (
                    <span className="text-slate-400 font-bold ml-0.5 text-xs">+</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter Summary */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
          <div>
            Showing <strong>{sortedStudents.length}</strong> of <strong>{students.length}</strong> total students
            {selectedDept !== 'ALL' && <span className="ml-1 text-indigo-700 font-semibold">• {selectedDept}</span>}
            {selectedYear !== 'ALL' && <span className="ml-1 text-indigo-700 font-semibold">• {selectedYear}</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer"
            >
              <ArrowUpDown className="h-3 w-3" />
              <span>Reg No: <strong className="text-indigo-600 uppercase">{sortOrder}</strong></span>
            </button>
            {(selectedDept !== 'ALL' || selectedYear !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => { setSelectedDept('ALL'); setSelectedYear('ALL'); setSearchQuery(''); }}
                className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Department Gap Analysis + Verify Button */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Department-Separated Register Number Gap Analysis
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                totalMissingCount > 0
                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                  : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}>
                {totalMissingCount > 0 ? `${totalMissingCount} Missing` : 'All Consecutive'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Gaps are evaluated strictly per department series. Cross-department comparisons never occur.
              Once a department has no missing numbers, you can mark it as <strong>Verified</strong>.
            </p>
          </div>
          {totalMissingCount > 0 && (
            <button
              type="button"
              onClick={handleExportMissingCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-colors cursor-pointer self-start sm:self-center"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Export Missing CSV</span>
            </button>
          )}
        </div>

        {/* === SINGLE DEPARTMENT VIEW (dept pill selected) === */}
        {selectedDept !== 'ALL' && singleDeptGapResult && (() => {
          const isGreen = isDeptGreen(selectedDept);
          const isVerified = verifiedDepts.has(selectedDept);
          const canVerify = !singleDeptGapResult.hasGaps && singleDeptGapResult.totalSubmitted > 0;

          return (
            <div className="space-y-3">
              {/* Department Info Row */}
              <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                isGreen
                  ? 'bg-emerald-50/70 border-emerald-300'
                  : singleDeptGapResult.hasGaps
                  ? 'bg-rose-50/50 border-rose-200'
                  : 'bg-indigo-50/50 border-indigo-100'
              }`}>
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span>{selectedDept}</span>
                      <span className="text-slate-400 font-normal">({getDeptShortCode(selectedDept)})</span>
                      {isGreen && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Stats */}
                  <div className="flex flex-wrap items-center gap-3 text-slate-600 font-mono text-[11px]">
                    <span>Submitted: <strong>{singleDeptGapResult.totalSubmitted}</strong></span>
                    <span>Min: <strong>{singleDeptGapResult.minRegisterNumber || '—'}</strong></span>
                    <span>Max: <strong>{singleDeptGapResult.maxRegisterNumber || '—'}</strong></span>
                    <span className={singleDeptGapResult.hasGaps ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                      Missing: {singleDeptGapResult.missingCount}
                    </span>
                  </div>

                  {/* Verify / Unverify Button */}
                  {canVerify ? (
                    <button
                      type="button"
                      onClick={() => toggleDeptVerification(selectedDept)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isVerified
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                          : 'bg-white hover:bg-emerald-50 text-emerald-700 border-2 border-emerald-500 hover:border-emerald-600'
                      }`}
                    >
                      {isVerified ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Verified ✓</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Mark as Verified</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      Fix {singleDeptGapResult.missingCount} gaps first
                    </span>
                  )}
                </div>
              </div>

              {/* Gap content */}
              {singleDeptGapResult.totalSubmitted === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs">
                  No submitted records for this department yet.
                </div>
              ) : singleDeptGapResult.hasGaps ? (
                <div className="overflow-hidden border border-slate-200 rounded-2xl shadow-xs">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-700 text-xs">
                      {singleDeptGapResult.missingCount} Students Not Yet Submitted (Pending from S.No 1)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(singleDeptGapResult.missingNumbers.join('\n'));
                        setCopiedText('DEPT_MISSING');
                        setTimeout(() => setCopiedText(null), 2000);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs"
                    >
                      {copiedText === 'DEPT_MISSING' ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedText === 'DEPT_MISSING' ? 'Copied All!' : 'Copy Missing Register Numbers'}</span>
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        <tr>
                          <th className="py-2.5 px-4 w-16">S.No</th>
                          <th className="py-2.5 px-4">Missing Register Number</th>
                          <th className="py-2.5 px-4">Department</th>
                          <th className="py-2.5 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {singleDeptGapResult.missingNumbers.map((missingId) => {
                          const roll = extractRollNumber(missingId);
                          return (
                            <tr key={missingId} className="hover:bg-rose-50/30 transition-colors group">
                              <td className="py-2.5 px-4 font-mono font-bold text-slate-600">#{roll ? roll.rollNo : '-'}</td>
                              <td className="py-2.5 px-4 font-mono font-bold text-rose-700 whitespace-nowrap">{missingId}</td>
                              <td className="py-2.5 px-4 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  {getDeptShortCode(selectedDept)}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 whitespace-nowrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                  Not Submitted
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl text-emerald-900">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold">Continuous Sequence: </span>
                    All submitted register numbers starting from <strong>{singleDeptGapResult.minRegisterNumber}</strong> up to{' '}
                    <strong>{singleDeptGapResult.maxRegisterNumber}</strong> are consecutive with no missing students.
                    {!isVerified && (
                      <span className="ml-1 text-emerald-700 font-semibold">Click "Mark as Verified" above to confirm.</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* === ALL DEPARTMENTS VIEW === */}
        {selectedDept === 'ALL' && (
          <div className="space-y-4">
            {/* Department Summary Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {ENGINEERING_DEPARTMENTS.map((dept) => {
                const gapInfo = deptGapMap[dept.name];
                const isGreen = isDeptGreen(dept.name);
                const isVerified = verifiedDepts.has(dept.name);
                const hasStudents = gapInfo && gapInfo.totalSubmitted > 0;
                const hasGaps = gapInfo?.hasGaps ?? false;
                const canVerify = hasStudents && !hasGaps;

                return (
                  <div
                    key={dept.code}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isGreen
                        ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200'
                        : hasGaps
                        ? 'bg-rose-50/40 border-rose-200'
                        : 'bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:underline"
                        onClick={() => setSelectedDept(dept.name)}
                        title={`Filter by ${dept.name}`}
                      >
                        <span className={isGreen ? 'text-emerald-800' : 'text-slate-900'}>{dept.code}</span>
                        {isGreen && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                      </span>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isGreen
                          ? 'bg-emerald-200 text-emerald-800'
                          : hasGaps
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {isGreen ? 'Verified ✓' : hasGaps ? `${gapInfo!.missingCount} Missing` : hasStudents ? 'Continuous' : 'No Data'}
                      </span>
                    </div>

                    {/* Stats Row */}
                    {hasStudents && gapInfo && (
                      <div className="text-[11px] text-slate-500 font-mono mb-2.5">
                        <div>Submitted: <strong>{gapInfo.totalSubmitted}</strong></div>
                      </div>
                    )}

                    {/* Verify Button or Gap Message */}
                    {canVerify && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleDeptVerification(dept.name); }}
                        className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isVerified
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-white hover:bg-emerald-50 text-emerald-700 border-2 border-emerald-500'
                        }`}
                      >
                        {isVerified ? (
                          <><CheckCircle2 className="h-3.5 w-3.5" /><span>Verified ✓ (Click to Undo)</span></>
                        ) : (
                          <><ShieldCheck className="h-3.5 w-3.5" /><span>Mark as Verified</span></>
                        )}
                      </button>
                    )}
                    {!hasStudents && (
                      <div className="text-[11px] text-slate-400 italic">No submissions yet</div>
                    )}
                    {hasStudents && hasGaps && (
                      <div className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Fix {gapInfo!.missingCount} missing numbers first
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Missing numbers table (for departments with gaps) */}
            {departmentGapAnalysis.totalMissingCount > 0 && (
              <div className="overflow-hidden border border-slate-200 rounded-2xl shadow-xs">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600 shadow-xs">
                      <tr>
                        <th className="py-2.5 px-4 w-16">S.No</th>
                        <th className="py-2.5 px-4">Missing Register Number</th>
                        <th className="py-2.5 px-4">Department</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {departmentGapAnalysis.departmentReports.flatMap((rep) =>
                        rep.missingNumbers.map((missingId) => ({ missingId, department: rep.department }))
                      ).map((item, index) => (
                        <tr key={`${item.department}-${item.missingId}`} className="hover:bg-rose-50/30 transition-colors group">
                          <td className="py-2.5 px-4 font-mono text-slate-500">{index + 1}</td>
                          <td className="py-2.5 px-4 font-mono font-bold text-rose-700 whitespace-nowrap">{item.missingId}</td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {getDeptShortCode(item.department)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {departmentGapAnalysis.totalMissingCount === 0 && yearFilteredStudents.length > 0 && (
              <div className="flex items-center gap-3 bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl text-emerald-900">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="text-xs">
                  <span className="font-bold">Zero Missing Register Numbers: </span>
                  All submitted series {selectedYear !== 'ALL' ? `for ${selectedYear}` : 'across all departments'} are completely continuous!
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Student Records Table with S.No Roster View */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200/80 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Student Register</h3>
            
            {/* View Filter: All Slots vs Submitted Only vs Not Submitted */}
            <div className="inline-flex items-center bg-slate-200/70 p-0.5 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTableRosterView('all_slots')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  tableRosterView === 'all_slots'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Slots ({totalRosterCount})
              </button>
              <button
                type="button"
                onClick={() => setTableRosterView('submitted')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  tableRosterView === 'submitted'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                Submitted ({submittedCount})
              </button>
              <button
                type="button"
                onClick={() => setTableRosterView('missing')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  tableRosterView === 'missing'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600 hover:text-rose-700'
                }`}
              >
                Not Submitted ({missingCount})
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {missingCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  const missingList = selectedDept === 'ALL'
                    ? departmentGapAnalysis.allMissingNumbers
                    : (singleDeptGapResult?.missingNumbers || []);
                  navigator.clipboard.writeText(missingList.join('\n'));
                  setCopiedText('COPY_TABLE_MISSING');
                  setTimeout(() => setCopiedText(null), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-rose-700 border border-rose-200 shadow-xs transition-all cursor-pointer"
                title="Copy unsubmitted register numbers"
              >
                {copiedText === 'COPY_TABLE_MISSING' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedText === 'COPY_TABLE_MISSING' ? 'Copied!' : `Copy ${missingCount} Missing IDs`}</span>
              </button>
            )}

            {onRefreshStudents && (
              <button
                type="button"
                onClick={onRefreshStudents}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                title="Refresh from database"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              disabled={rosterItems.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4 w-16">S.No</th>
                <th className="py-3.5 px-4">Register Number</th>
                <th className="py-3.5 px-4">Student Name</th>
                <th className="py-3.5 px-4">Department &amp; Year</th>
                <th className="py-3.5 px-4">Bus Route</th>
                <th className="py-3.5 px-4">Boarding Stop</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rosterItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-medium text-slate-600">No student records found</p>
                    <p className="text-xs mt-1">Try selecting a different department or clearing search filters</p>
                  </td>
                </tr>
              ) : (
                rosterItems.map((item) => (
                  <tr
                    key={item.key}
                    className={`transition-colors group ${
                      item.isSubmitted
                        ? 'hover:bg-slate-50/70 bg-white'
                        : 'bg-rose-50/25 hover:bg-rose-50/50'
                    }`}
                  >
                    {/* S.No / Roll Number */}
                    <td className="py-3 px-4 font-mono font-bold text-xs whitespace-nowrap">
                      <span className={item.isSubmitted ? 'text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60' : 'text-slate-400 px-2'}>
                        #{item.sNo > 0 ? item.sNo : '-'}
                      </span>
                    </td>

                    {/* Register Number */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded border ${
                          item.isSubmitted
                            ? 'bg-slate-100 text-slate-900 border-slate-200/80 font-bold'
                            : 'bg-rose-100/50 text-rose-800 border-rose-200'
                        }`}>
                          {item.identifier}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.identifier, item.identifier)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 p-0.5 rounded transition-opacity cursor-pointer"
                          title="Copy Register Number"
                        >
                          {copiedText === item.identifier ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Student Name */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.isSubmitted ? (
                        <span className="font-semibold text-slate-900">{item.studentName}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-500 font-medium italic text-xs">
                          Not Submitted
                        </span>
                      )}
                    </td>

                    {/* Department & Year */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium text-slate-800">
                        <span>{getDeptShortCode(item.departmentOrClass)}</span>
                      </div>
                      {item.isSubmitted && item.yearOrSection && (
                        <div className="text-[11px] text-slate-500 font-semibold">{item.yearOrSection}</div>
                      )}
                    </td>

                    {/* Bus Route */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.isSubmitted && item.busRouteName !== '-' ? (
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 mr-1">
                            Route {item.busRouteId}
                          </span>
                          <span className="font-medium truncate max-w-[160px]" title={item.busRouteName}>{item.busRouteName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Boarding Stop */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.isSubmitted && item.stoppingName !== '-' ? (
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <span className="font-medium truncate max-w-[160px]" title={item.stoppingName}>{item.stoppingName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Status Pill */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.isSubmitted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Submitted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100/70 text-rose-700 border border-rose-200">
                          <AlertTriangle className="h-3 w-3 text-rose-500" />
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
