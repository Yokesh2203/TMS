import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  Search,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  FileDown,
  FileSpreadsheet,
  Printer,
  Download,
  BarChart3,
  Layers,
  ShieldCheck,
  ArrowUpDown,
  ShieldX,
  Home,
  Pencil,
  X,
  Bus,
  MapPin,
  Loader2,
  User,
  Hash,
  Trash2,
} from 'lucide-react';
import { Student } from '../types';
import {
  ENGINEERING_DEPARTMENTS,
  COLLEGE_YEARS,
  BUS_ROUTES,
} from '../data/mockData';
import {
  detectRegisterNumberGaps,
  detectDepartmentGaps,
  extractRollNumber,
} from '../utils/gapDetection';
import { updateStudentInDb, deleteStudentFromDb } from '../services/api';

// Persists which (DEPARTMENT + YEAR) combinations have been manually verified by admin
const VERIFIED_DEPTS_KEY = 'nscet_tms_verified_dept_years_v3';
const getDeptYearKey = (deptName: string, year: string): string => `${deptName}___${year}`;

interface AdminPanelProps {
  students: Student[];
  onRefreshStudents?: () => void;
  onUpdateStudent?: (studentId: string, data: Partial<Student>) => Promise<any>;
  onDeleteStudent?: (studentId: string) => Promise<any>;
  isRefreshing?: boolean;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  students,
  onRefreshStudents,
  onUpdateStudent,
  onDeleteStudent,
  isRefreshing = false,
}) => {
  // Edit Student Modal state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editFormData, setEditFormData] = useState<{
    studentName: string;
    identifier: string;
    departmentOrClass: string;
    yearOrSection: string;
    isHostel: boolean;
    busRouteId: string;
    stoppingName: string;
  }>({
    studentName: '',
    identifier: '',
    departmentOrClass: '',
    yearOrSection: '',
    isHostel: false,
    busRouteId: '',
    stoppingName: '',
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editToast, setEditToast] = useState<string | null>(null);

  // Delete Student state
  const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deletingStudent) return;
    setIsDeleting(true);
    try {
      if (onDeleteStudent) {
        await onDeleteStudent(deletingStudent.id);
      } else {
        await deleteStudentFromDb(deletingStudent.id);
        if (onRefreshStudents) {
          onRefreshStudents();
        }
      }
      setEditToast(`Deleted "${deletingStudent.studentName}" (${deletingStudent.identifier}) successfully!`);
      setTimeout(() => setEditToast(null), 4000);
      setDeletingStudent(null);
      if (editingStudent?.id === deletingStudent.id) {
        setEditingStudent(null);
      }
    } catch (err: any) {
      console.error('Failed to delete student:', err);
      alert(err.message || 'Failed to delete student from database.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenEdit = (student: Student) => {
    const isHostel = Boolean(student.isHostel || student.busRouteId === null || (!student.busRouteName && !student.stoppingName));
    setEditingStudent(student);
    setEditFormData({
      studentName: student.studentName || '',
      identifier: student.identifier || '',
      departmentOrClass: student.departmentOrClass || ENGINEERING_DEPARTMENTS[0].name,
      yearOrSection: student.yearOrSection || COLLEGE_YEARS[3],
      isHostel,
      busRouteId: student.busRouteId ? String(student.busRouteId) : (BUS_ROUTES[0]?.id || '1'),
      stoppingName: student.stoppingName || (BUS_ROUTES[0]?.stops[0] || ''),
    });
    setEditError(null);
  };

  const editSelectedRoute = useMemo(() => {
    return BUS_ROUTES.find((r) => r.id === editFormData.busRouteId) || BUS_ROUTES[0];
  }, [editFormData.busRouteId]);

  const editAvailableStops = editSelectedRoute ? editSelectedRoute.stops : [];

  const handleEditRouteChange = (newRouteId: string) => {
    const route = BUS_ROUTES.find((r) => r.id === newRouteId);
    setEditFormData((prev) => {
      const isCurrentStopValid = route ? route.stops.includes(prev.stoppingName) : false;
      return {
        ...prev,
        isHostel: false,
        busRouteId: newRouteId,
        stoppingName: isCurrentStopValid ? prev.stoppingName : (route?.stops[0] || ''),
      };
    });
  };

  const handleSaveStudentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    const cleanIdentifier = editFormData.identifier.trim().replace(/\D/g, '').slice(0, 12);
    if (!cleanIdentifier) {
      setEditError('Register Number is required.');
      return;
    }
    if (cleanIdentifier.length !== 12) {
      setEditError(`Register Number must be exactly 12 digits (currently ${cleanIdentifier.length} digits).`);
      return;
    }

    if (!editFormData.studentName.trim()) {
      setEditError('Student full name is required.');
      return;
    }

    if (!editFormData.isHostel && (!editFormData.busRouteId || !editFormData.stoppingName)) {
      setEditError('Day scholar students must have an assigned bus route and boarding stop.');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    try {
      const route = !editFormData.isHostel ? BUS_ROUTES.find((r) => r.id === editFormData.busRouteId) : null;
      const updatedPayload: Partial<Student> = {
        studentName: editFormData.studentName.trim().toUpperCase(),
        identifier: cleanIdentifier,
        departmentOrClass: editFormData.departmentOrClass,
        yearOrSection: editFormData.yearOrSection,
        isHostel: editFormData.isHostel,
        busRouteId: editFormData.isHostel ? null : (route?.id || null),
        busRouteName: editFormData.isHostel ? null : (route ? `${route.routeNumber} - ${route.name}` : null),
        stoppingName: editFormData.isHostel ? null : editFormData.stoppingName,
      };

      if (onUpdateStudent) {
        await onUpdateStudent(editingStudent.id, updatedPayload);
      } else {
        await updateStudentInDb(editingStudent.id, updatedPayload);
        if (onRefreshStudents) {
          onRefreshStudents();
        }
      }

      setEditToast(`Updated "${editFormData.studentName.trim().toUpperCase()}" (${cleanIdentifier}) successfully!`);
      setTimeout(() => setEditToast(null), 4000);
      setEditingStudent(null);
    } catch (err: any) {
      console.error('Failed to update student:', err);
      setEditError(err.message || 'Failed to update student in database.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Department filter: default to first engineering department (no 'ALL' option)
  const [selectedDept, setSelectedDept] = useState<string>(ENGINEERING_DEPARTMENTS[0].name);

  // Year filter
  const [selectedYear, setSelectedYear] = useState<string>('ALL');

  // General controls
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Table roster view: 'all_slots' (shows 1 to Max with missing slots), 'submitted', or 'missing'
  const [tableRosterView, setTableRosterView] = useState<'all_slots' | 'submitted' | 'missing'>('all_slots');

  // Department-Wise Report modal state
  const [showDeptReportModal, setShowDeptReportModal] = useState<boolean>(false);
  const [reportActiveDeptTab, setReportActiveDeptTab] = useState<string>('ALL');
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');
  const [reportYearFilter, setReportYearFilter] = useState<string>('ALL');
  const [reportViewMode, setReportViewMode] = useState<'roster' | 'table' | 'cards'>('roster');

  const handleOpenReportModal = () => {
    setReportActiveDeptTab(selectedDept);
    setReportYearFilter(selectedYear);
    setShowDeptReportModal(true);
  };

  // Department + Year granular verification state (Set of "${deptName}___${year}" strings verified by admin)
  const [verifiedDeptYears, setVerifiedDeptYears] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(VERIFIED_DEPTS_KEY);
      if (saved) {
        const arr = JSON.parse(saved);
        return new Set(Array.isArray(arr) ? arr : []);
      }
    } catch (e) {
      console.error('Error reading verified department years from localStorage:', e);
    }
    return new Set<string>();
  });

  // Check if a specific department + year is verified
  const isDeptYearVerified = (deptName: string, year: string): boolean => {
    return verifiedDeptYears.has(getDeptYearKey(deptName, year));
  };

  // Toggle verification for a specific department + year
  const toggleDeptYearVerification = (deptName: string, year: string) => {
    setVerifiedDeptYears((prev) => {
      const next = new Set(prev);
      const key = getDeptYearKey(deptName, year);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      try {
        localStorage.setItem(VERIFIED_DEPTS_KEY, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  };

  // Check if a department pill should show green:
  // - If a specific year is selected (e.g. '3rd Year'): green ONLY if (deptName, selectedYear) is verified!
  // - If 'ALL' is selected: green ONLY if all 4 years of that department are verified!
  const isDeptPillGreen = (deptName: string): boolean => {
    if (selectedYear !== 'ALL') {
      return isDeptYearVerified(deptName, selectedYear);
    }
    return COLLEGE_YEARS.every((yr) => isDeptYearVerified(deptName, yr));
  };

  // Get how many years are verified for a given department
  const getDeptVerifiedYearsCount = (deptName: string): number => {
    return COLLEGE_YEARS.filter((yr) => isDeptYearVerified(deptName, yr)).length;
  };

  // Filter students based on Department, Year, and Search Query
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (s.departmentOrClass !== selectedDept) return false;
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
    const ids = yearFilteredStudents
      .filter((s) => s.departmentOrClass === selectedDept)
      .map((s) => s.identifier);
    return detectRegisterNumberGaps(ids);
  }, [yearFilteredStudents, selectedDept]);

  // Total missing count for the selected department
  const totalMissingCount = useMemo(() => {
    return singleDeptGapResult ? singleDeptGapResult.missingCount : 0;
  }, [singleDeptGapResult]);

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

  // Detailed Year-by-Year breakdown for the selected department
  const deptYearsOverview = useMemo(() => {
    return COLLEGE_YEARS.map((yr) => {
      const yearStudents = students.filter(
        (s) => s.departmentOrClass === selectedDept && s.yearOrSection === yr
      );
      const ids = yearStudents.map((s) => s.identifier);
      const gapRes = detectRegisterNumberGaps(ids);
      const verified = isDeptYearVerified(selectedDept, yr);
      return {
        year: yr,
        students: yearStudents,
        totalSubmitted: yearStudents.length,
        gapResult: gapRes,
        isVerified: verified,
      };
    });
  }, [students, selectedDept, verifiedDeptYears]);

  // Count verified department batches (total across all 7 depts * 4 years = 28)
  const totalVerifiedBatches = useMemo(() => {
    let count = 0;
    ENGINEERING_DEPARTMENTS.forEach((d) => {
      COLLEGE_YEARS.forEach((yr) => {
        if (isDeptYearVerified(d.name, yr)) count++;
      });
    });
    return count;
  }, [verifiedDeptYears]);

  const verifiedInSelectedYear = useMemo(() => {
    if (selectedYear === 'ALL') return totalVerifiedBatches;
    return ENGINEERING_DEPARTMENTS.filter((d) => isDeptYearVerified(d.name, selectedYear)).length;
  }, [selectedYear, totalVerifiedBatches, verifiedDeptYears]);

  // Combine submitted students with missing register numbers for a complete S.No / Roll Number roster
  const rosterItems = useMemo(() => {
    const missingList = singleDeptGapResult?.missingNumbers || [];

    const submittedItems = sortedStudents.map((s, idx) => {
      const rollInfo = extractRollNumber(s.identifier);
      const isHostel = Boolean(s.isHostel || s.busRouteId === null || (!s.busRouteName && !s.stoppingName));
      return {
        key: s.id || `sub-${s.identifier}-${idx}`,
        sNo: rollInfo ? rollInfo.rollNo : idx + 1,
        identifier: s.identifier,
        studentName: s.studentName,
        departmentOrClass: s.departmentOrClass,
        yearOrSection: s.yearOrSection,
        isHostel,
        busRouteId: isHostel ? null : s.busRouteId,
        busRouteName: isHostel ? 'Hostel' : s.busRouteName,
        stoppingName: isHostel ? 'Hostel' : s.stoppingName,
        isSubmitted: true,
        rawStudent: s,
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
        isHostel: false,
        busRouteId: '-',
        busRouteName: '-',
        stoppingName: '-',
        isSubmitted: false,
        rawStudent: undefined,
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

  // Export records SQL for phpMyAdmin / MySQL import
  const handleExportSQL = () => {
    if (students.length === 0) return;
    const lines = [
      '-- NSCET Transport Management System - Exported Students Dump',
      `-- Export Date: ${new Date().toISOString()}`,
      `-- Total Records: ${students.length}`,
      '',
      'CREATE TABLE IF NOT EXISTS `students` (',
      '  `id` int(11) NOT NULL AUTO_INCREMENT,',
      '  `student_name` varchar(150) NOT NULL,',
      '  `identifier` varchar(50) NOT NULL,',
      '  `institution_id` int(11) NOT NULL,',
      '  `department_or_class` varchar(100) NOT NULL,',
      '  `year_or_section` varchar(50) NOT NULL,',
      '  `is_hostel` tinyint(1) NOT NULL DEFAULT 0,',
      '  `bus_route_id` int(11) DEFAULT NULL,',
      '  `bus_route_name` varchar(200) DEFAULT NULL,',
      '  `stopping_name` varchar(150) DEFAULT NULL,',
      '  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,',
      '  PRIMARY KEY (`id`)',
      ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
      '',
      'INSERT INTO `students` (`id`, `student_name`, `identifier`, `institution_id`, `department_or_class`, `year_or_section`, `is_hostel`, `bus_route_id`, `bus_route_name`, `stopping_name`) VALUES',
    ];

    const values = students.map((s, idx) => {
      const escape = (val: string | null | undefined) => (val || '').replace(/'/g, "\\'");
      const isHostel = Boolean(s.isHostel || s.busRouteId === null);
      return `(${idx + 1}, '${escape(s.studentName)}', '${escape(s.identifier)}', ${s.institutionId || 1}, '${escape(s.departmentOrClass)}', '${escape(s.yearOrSection)}', ${isHostel ? 1 : 0}, ${isHostel || !s.busRouteId ? 'NULL' : s.busRouteId}, ${isHostel || !s.busRouteName ? 'NULL' : `'${escape(s.busRouteName)}'`}, ${isHostel || !s.stoppingName ? 'NULL' : `'${escape(s.stoppingName)}'`})`;
    });

    lines.push(values.join(',\n') + ';');

    const sqlContent = 'data:text/sql;charset=utf-8,' + encodeURIComponent(lines.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', sqlContent);
    link.setAttribute('download', `nscet_students_dump_${new Date().toISOString().slice(0, 10)}.sql`);
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

  // Department + Year Granular Breakdown across all 7 Engineering Departments & 4 College Years
  const departmentYearWiseStats = useMemo(() => {
    const list: {
      deptCode: string;
      deptName: string;
      year: string;
      students: Student[];
      totalSubmitted: number;
      busCount: number;
      hostelCount: number;
      gapResult: ReturnType<typeof detectRegisterNumberGaps>;
      missingCount: number;
      isVerified: boolean;
    }[] = [];

    ENGINEERING_DEPARTMENTS.forEach((dept) => {
      COLLEGE_YEARS.forEach((yr) => {
        const batchStudents = students.filter(
          (s) => s.departmentOrClass === dept.name && s.yearOrSection === yr
        );
        const ids = batchStudents.map((s) => s.identifier);
        const gapResult = detectRegisterNumberGaps(ids);
        const busCount = batchStudents.filter(
          (s) => !s.isHostel && s.busRouteId !== null && (s.busRouteName || s.stoppingName)
        ).length;
        const hostelCount = batchStudents.length - busCount;
        const isVerified = isDeptYearVerified(dept.name, yr);

        list.push({
          deptCode: dept.code,
          deptName: dept.name,
          year: yr,
          students: batchStudents,
          totalSubmitted: batchStudents.length,
          busCount,
          hostelCount,
          gapResult,
          missingCount: gapResult.missingCount,
          isVerified,
        });
      });
    });

    return list;
  }, [students, verifiedDeptYears]);

  // Grouped by Department, containing an array of its 4 Year batches
  const departmentGroupsWithYears = useMemo(() => {
    return ENGINEERING_DEPARTMENTS.map((dept) => {
      const yearBatches = departmentYearWiseStats.filter((b) => b.deptName === dept.name);
      const deptTotalSubmitted = yearBatches.reduce((acc, b) => acc + b.totalSubmitted, 0);
      const deptBusCount = yearBatches.reduce((acc, b) => acc + b.busCount, 0);
      const deptHostelCount = yearBatches.reduce((acc, b) => acc + b.hostelCount, 0);
      const deptMissingCount = yearBatches.reduce((acc, b) => acc + b.missingCount, 0);
      const verifiedYearsCount = yearBatches.filter((b) => b.isVerified).length;

      return {
        deptCode: dept.code,
        deptName: dept.name,
        totalSubmitted: deptTotalSubmitted,
        busCount: deptBusCount,
        hostelCount: deptHostelCount,
        missingCount: deptMissingCount,
        verifiedYearsCount,
        isFullyVerified: verifiedYearsCount === COLLEGE_YEARS.length,
        yearBatches,
      };
    });
  }, [departmentYearWiseStats]);

  // Grand totals across all departments & years
  const departmentWiseGrandTotals = useMemo(() => {
    let totalSubmitted = 0;
    let totalBus = 0;
    let totalHostel = 0;
    let totalMissing = 0;
    const yearTotals: Record<string, number> = {};
    COLLEGE_YEARS.forEach((yr) => {
      yearTotals[yr] = 0;
    });

    departmentYearWiseStats.forEach((batch) => {
      totalSubmitted += batch.totalSubmitted;
      totalBus += batch.busCount;
      totalHostel += batch.hostelCount;
      totalMissing += batch.missingCount;
      yearTotals[batch.year] = (yearTotals[batch.year] || 0) + batch.totalSubmitted;
    });

    return {
      totalSubmitted,
      totalBus,
      totalHostel,
      totalMissing,
      yearTotals,
    };
  }, [departmentYearWiseStats]);

  // Export Department-Wise and Year-Wise Registered Students CSV
  const handleExportDepartmentWiseCSV = () => {
    if (students.length === 0) return;

    const lines: string[] = [];
    const timestamp = new Date().toLocaleString();

    // 1. Institution and Report Title
    lines.push(`"NADAR SARASWATHI COLLEGE OF ENGINEERING & TECHNOLOGY (NSCET)"`);
    lines.push(`"TRANSPORT MANAGEMENT SYSTEM - DEPARTMENT & YEAR-WISE REGISTERED STUDENTS REPORT"`);
    lines.push(`"Report Generated At: ${timestamp}"`);
    lines.push(`"Total Registered Students: ${students.length}"`);
    lines.push(``);

    // 2. Department and Year Registration Summary Table
    lines.push(`"=== SECTION 1: DEPARTMENT & YEAR-WISE REGISTRATION SUMMARY ==="`);
    lines.push([
      `"S.No"`,
      `"Dept Code"`,
      `"Department Name"`,
      `"Year of Study"`,
      `"Total Registered"`,
      `"Missing Register Numbers"`,
      `"Batch Verification Status"`,
    ].join(','));

    let sNoCounter = 1;
    departmentGroupsWithYears.forEach((deptGroup) => {
      deptGroup.yearBatches.forEach((batch) => {
        lines.push([
          `"${sNoCounter++}"`,
          `"${deptGroup.deptCode}"`,
          `"${deptGroup.deptName}"`,
          `"${batch.year}"`,
          `"${batch.totalSubmitted}"`,
          `"${batch.missingCount}"`,
          `"${batch.isVerified ? 'Verified ✓' : 'Pending'}"`,
        ].join(','));
      });

      // Subtotal row for this department
      lines.push([
        `"SUBTOTAL"`,
        `"${deptGroup.deptCode}"`,
        `"${deptGroup.deptName} (All 4 Years)"`,
        `"All Years"`,
        `"${deptGroup.totalSubmitted}"`,
        `"${deptGroup.missingCount}"`,
        `"${deptGroup.verifiedYearsCount}/${COLLEGE_YEARS.length} Years Verified"`,
      ].join(','));

      lines.push(``);
    });

    // Grand Totals row
    lines.push([
      `"GRAND TOTAL"`,
      `"ALL"`,
      `"All Engineering Departments"`,
      `"All Batches (1st - 4th Yr)"`,
      `"${departmentWiseGrandTotals.totalSubmitted}"`,
      `"${departmentWiseGrandTotals.totalMissing}"`,
      `"${totalVerifiedBatches}/${ENGINEERING_DEPARTMENTS.length * COLLEGE_YEARS.length} Batches Verified"`,
    ].join(','));

    lines.push(``);
    lines.push(``);

    // 3. Detailed Department & Year-Wise Student Rosters
    lines.push(`"=== SECTION 2: DETAILED REGISTERED STUDENTS ROSTER (ORGANIZED BY DEPARTMENT & YEAR) ==="`);
    lines.push([
      `"Department"`,
      `"Year of Study"`,
      `"Roll No / S.No"`,
      `"Register Number"`,
      `"Student Name"`,
      `"Status"`,
    ].join(','));

    departmentGroupsWithYears.forEach((deptGroup) => {
      deptGroup.yearBatches.forEach((batch) => {
        if (batch.students.length > 0) {
          lines.push(`"--- ${deptGroup.deptName} (${deptGroup.deptCode}) - ${batch.year} (${batch.students.length} Students) ---","","","","",""`);

          const sortedStudents = [...batch.students].sort((a, b) => {
            const aRoll = extractRollNumber(a.identifier);
            const bRoll = extractRollNumber(b.identifier);
            if (aRoll && bRoll && aRoll.rollNo !== bRoll.rollNo) {
              return aRoll.rollNo - bRoll.rollNo;
            }
            return a.identifier.localeCompare(b.identifier, undefined, { numeric: true });
          });

          sortedStudents.forEach((s, idx) => {
            const roll = extractRollNumber(s.identifier);
            const sNo = roll ? roll.rollNo : idx + 1;
            lines.push([
              `"${deptGroup.deptName} (${deptGroup.deptCode})"`,
              `"${batch.year}"`,
              `"${sNo}"`,
              `"${s.identifier}"`,
              `"${s.studentName}"`,
              `"Submitted"`,
            ].join(','));
          });

          lines.push(``);
        }
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(lines.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `nscet_department_year_wise_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Grouped by Department and Year for the Report Modal
  const reportGroupedByDeptAndYear = useMemo(() => {
    const result: {
      deptCode: string;
      deptName: string;
      years: {
        year: string;
        students: Student[];
        totalSubmitted: number;
        busCount: number;
        hostelCount: number;
        missingCount: number;
        isVerified: boolean;
      }[];
      totalDeptStudents: number;
    }[] = [];

    const deptsToInclude = reportActiveDeptTab === 'ALL'
      ? ENGINEERING_DEPARTMENTS
      : ENGINEERING_DEPARTMENTS.filter((d) => d.name === reportActiveDeptTab);

    deptsToInclude.forEach((dept) => {
      const yearsList: {
        year: string;
        students: Student[];
        totalSubmitted: number;
        busCount: number;
        hostelCount: number;
        missingCount: number;
        isVerified: boolean;
      }[] = [];

      const yearsToInclude = reportYearFilter === 'ALL'
        ? COLLEGE_YEARS
        : COLLEGE_YEARS.filter((yr) => yr === reportYearFilter);

      let deptTotalCount = 0;

      yearsToInclude.forEach((yr) => {
        const batch = departmentYearWiseStats.find(
          (b) => b.deptName === dept.name && b.year === yr
        );

        let batchStudents = (batch?.students || []).filter((s) => {
          if (!reportSearchQuery.trim()) return true;
          const q = reportSearchQuery.toLowerCase().trim();
          const cleanQ = q.startsWith('#') ? q.slice(1).trim() : q;
          const matchesName = (s.studentName || '').toLowerCase().includes(cleanQ);
          const matchesId = (s.identifier || '').toLowerCase().includes(cleanQ);
          const matchesRoute = (s.busRouteName || '').toLowerCase().includes(cleanQ);
          const matchesStop = (s.stoppingName || '').toLowerCase().includes(cleanQ);
          const rollInfo = extractRollNumber(s.identifier);
          const matchesSNo = rollInfo ? String(rollInfo.rollNo).includes(cleanQ) : false;
          return matchesName || matchesId || matchesRoute || matchesStop || matchesSNo;
        });

        batchStudents.sort((a, b) => {
          const aRoll = extractRollNumber(a.identifier);
          const bRoll = extractRollNumber(b.identifier);
          if (aRoll && bRoll && aRoll.rollNo !== bRoll.rollNo) {
            return aRoll.rollNo - bRoll.rollNo;
          }
          return a.identifier.localeCompare(b.identifier, undefined, { numeric: true });
        });

        deptTotalCount += batchStudents.length;

        if (batchStudents.length > 0 || (reportActiveDeptTab !== 'ALL' && reportYearFilter !== 'ALL')) {
          yearsList.push({
            year: yr,
            students: batchStudents,
            totalSubmitted: batchStudents.length,
            busCount: batch?.busCount || 0,
            hostelCount: batch?.hostelCount || 0,
            missingCount: batch?.missingCount || 0,
            isVerified: Boolean(batch?.isVerified),
          });
        }
      });

      if (yearsList.length > 0 || reportActiveDeptTab !== 'ALL') {
        result.push({
          deptCode: dept.code,
          deptName: dept.name,
          years: yearsList,
          totalDeptStudents: deptTotalCount,
        });
      }
    });

    return result;
  }, [departmentYearWiseStats, reportActiveDeptTab, reportYearFilter, reportSearchQuery]);

  const getDeptShortCode = (deptName: string): string =>
    ENGINEERING_DEPARTMENTS.find((d) => d.name === deptName)?.code ?? deptName;

  const isDeptGreen = (deptName: string): boolean => isDeptPillGreen(deptName);

  return (
    <div className="space-y-6">


      {/* Verified Departments Stat Banner */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {selectedYear !== 'ALL' ? `${selectedYear} Verified Departments` : 'Total Verified Batches'}
              </span>
              <span className="font-mono text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                {selectedYear !== 'ALL'
                  ? `${verifiedInSelectedYear} / ${ENGINEERING_DEPARTMENTS.length} Depts`
                  : `${totalVerifiedBatches} / ${ENGINEERING_DEPARTMENTS.length * COLLEGE_YEARS.length} Dept-Year Batches`}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {selectedYear !== 'ALL'
                ? `${verifiedInSelectedYear} of ${ENGINEERING_DEPARTMENTS.length} departments verified for ${selectedYear}`
                : `${totalVerifiedBatches} of ${ENGINEERING_DEPARTMENTS.length * COLLEGE_YEARS.length} total department-year batches verified by admin`}
            </p>
          </div>
        </div>

        {/* Action Button: Report */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenReportModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-xs hover:shadow transition-all cursor-pointer"
            title="Open registered students report"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Report</span>
          </button>
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

        {/* Row 2: Department Filter Pills (No 'All Departments' option) */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <span>Select Department</span>
              <span className="text-[10px] font-normal text-slate-400 lowercase">(click pill to switch department)</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Engineering Department Pills */}
            {ENGINEERING_DEPARTMENTS.map((dept) => {
              const isSelected = selectedDept === dept.name;
              const isGreen = isDeptPillGreen(dept.name);
              const verifiedYearsCount = getDeptVerifiedYearsCount(dept.name);
              const gapInfo = deptGapMap[dept.name];
              const hasGaps = gapInfo?.hasGaps ?? false;

              let pillClass = 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50';

              if (isSelected && isGreen) {
                pillClass = 'bg-emerald-600 text-white border-2 border-emerald-700 shadow-sm ring-2 ring-emerald-200 font-bold';
              } else if (isSelected) {
                pillClass = 'bg-blue-600 text-white border-2 border-blue-700 shadow-sm ring-2 ring-blue-200 font-bold';
              } else if (isGreen) {
                pillClass = 'bg-emerald-50 text-emerald-800 border-2 border-emerald-500 shadow-xs ring-2 ring-emerald-100 font-bold hover:bg-emerald-100';
              } else if (hasGaps) {
                pillClass = 'bg-rose-50/70 text-rose-800 border border-rose-300 hover:bg-rose-100/70';
              }

              return (
                <button
                  key={dept.code}
                  type="button"
                  onClick={() => setSelectedDept(dept.name)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none ${pillClass}`}
                  title={
                    selectedYear !== 'ALL'
                      ? `${dept.name} — ${isGreen ? `Verified for ${selectedYear} ✓` : `Not verified for ${selectedYear}`}`
                      : `${dept.name} — ${verifiedYearsCount}/4 Years Verified`
                  }
                >
                  <span>{dept.code}</span>
                  {isSelected ? (
                    <Check className="h-3.5 w-3.5 text-white stroke-[3]" />
                  ) : isGreen ? (
                    <span className="flex items-center justify-center h-4 w-4 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold">✓</span>
                  ) : selectedYear === 'ALL' && verifiedYearsCount > 0 ? (
                    <span className="text-emerald-700 font-bold text-[10px] px-1.5 py-0.2 bg-emerald-100 rounded-full border border-emerald-200">
                      {verifiedYearsCount}/4
                    </span>
                  ) : hasGaps ? (
                    <span className="text-rose-600 font-bold text-[10px] px-1 bg-rose-100 rounded-full">{gapInfo?.missingCount}</span>
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
            Showing <strong>{sortedStudents.length}</strong> students in <span className="text-indigo-700 font-bold">{selectedDept}</span>
            {selectedYear !== 'ALL' && <span className="ml-1 text-slate-700 font-semibold">• {selectedYear}</span>}
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
            {(selectedDept !== ENGINEERING_DEPARTMENTS[0].name || selectedYear !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => { setSelectedDept(ENGINEERING_DEPARTMENTS[0].name); setSelectedYear('ALL'); setSearchQuery(''); }}
                className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Department Overview & Verification */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Department &amp; Year Verification
              </h3>
              <span className="font-mono text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                {selectedDept} ({getDeptShortCode(selectedDept)})
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify each year separately for <strong>{selectedDept}</strong>. Clicking <strong>Verify</strong> confirms only that specific year.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {selectedYear !== 'ALL'
                ? `Active View: ${selectedYear}`
                : `Verified: ${getDeptVerifiedYearsCount(selectedDept)} / 4 Years`}
            </span>
          </div>
        </div>

        {/* View 1: If a specific Year is selected in dropdown -> Show that single Year card */}
        {selectedYear !== 'ALL' && (() => {
          const yearData = deptYearsOverview.find((d) => d.year === selectedYear);
          if (!yearData) return null;

          const isVerified = yearData.isVerified;
          const gapResult = yearData.gapResult;

          return (
            <div className="space-y-3">
              <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs ${
                isVerified
                  ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-200/80 shadow-xs'
                  : gapResult.hasGaps
                    ? 'bg-rose-50/50 border-rose-200'
                    : 'bg-indigo-50/50 border-indigo-100'
              }`}>
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{selectedDept}</span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold text-[11px]">
                      {selectedYear}
                    </span>
                    {isVerified && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Stats */}
                  <div className="flex flex-wrap items-center gap-3 text-slate-600 font-mono text-[11px]">
                    <span>Submitted: <strong>{yearData.totalSubmitted}</strong></span>
                    {gapResult.groups && gapResult.groups.length <= 1 ? (
                      <>
                        <span>Min Reg No: <strong>{gapResult.minRegisterNumber || '—'}</strong></span>
                        <span>Max Reg No: <strong>{gapResult.maxRegisterNumber || '—'}</strong></span>
                      </>
                    ) : (
                      <span>Groups: <strong>{gapResult.groups?.length || 1} Ranges</strong></span>
                    )}
                    <span className={gapResult.hasGaps ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                      Missing: {gapResult.missingCount}
                    </span>
                  </div>

                  {/* Verify / Unverify Button for this specific year */}
                  <button
                    type="button"
                    onClick={() => toggleDeptYearVerification(selectedDept, selectedYear)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isVerified
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-200'
                        : 'bg-white hover:bg-emerald-50 text-emerald-700 border-2 border-emerald-500 hover:border-emerald-600 shadow-xs'
                    }`}
                    title={
                      isVerified
                        ? `Click to unverify ${selectedDept} for ${selectedYear}`
                        : `Click to verify ${selectedDept} for ${selectedYear}`
                    }
                  >
                    {isVerified ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Verified ✓ ({selectedYear})</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Verify {selectedYear}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Continuous Range Groups breakdown for selected year */}
              {gapResult.groups && gapResult.groups.length > 1 && (
                <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                    Continuous Range Groups ({gapResult.groups.length}):
                  </span>
                  {gapResult.groups.map((grp, gIdx) => (
                    <div
                      key={gIdx}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs font-mono text-[11px]"
                    >
                      <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                        Group {gIdx + 1}
                      </span>
                      <span className="text-slate-800 font-semibold">
                        {grp.startFormatted} → {grp.endFormatted}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-600">{grp.submittedCount} sub</span>
                      {grp.missingCount > 0 ? (
                        <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded text-[10px]">
                          {grp.missingCount} missing
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                          0 missing ✓
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {yearData.totalSubmitted === 0 && (
                <div className="py-4 text-center text-slate-400 text-xs">
                  No submitted records for {selectedDept} ({selectedYear}) yet.
                </div>
              )}
            </div>
          );
        })()}

        {/* View 2: When 'All Years' is selected -> Show separate Year Cards for 1st, 2nd, 3rd, 4th Year */}
        {selectedYear === 'ALL' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {deptYearsOverview.map((item) => {
              const isVerified = item.isVerified;
              const gapResult = item.gapResult;
              const hasStudents = item.totalSubmitted > 0;

              return (
                <div
                  key={item.year}
                  className={`p-4 rounded-2xl border transition-all ${
                    isVerified
                      ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-200/80 shadow-xs'
                      : gapResult.hasGaps
                        ? 'bg-rose-50/40 border-rose-200 shadow-2xs'
                        : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${isVerified ? 'text-emerald-950 font-extrabold' : 'text-slate-900'}`}>
                        {item.year}
                      </span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        ({getDeptShortCode(selectedDept)})
                      </span>
                      {isVerified && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isVerified
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : gapResult.hasGaps
                            ? 'bg-rose-100 text-rose-700'
                            : hasStudents
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isVerified
                        ? '✓ Verified'
                        : gapResult.hasGaps
                          ? `${gapResult.missingCount} Missing`
                          : hasStudents
                            ? 'All Consecutive'
                            : 'No Data'}
                    </span>
                  </div>

                  {/* Stats Row */}
                  <div className="text-[11px] text-slate-600 font-mono mb-3 flex flex-wrap items-center justify-between gap-1">
                    <span>
                      Submitted: <strong className="text-slate-900">{item.totalSubmitted}</strong>
                    </span>
                    {hasStudents && (
                      <span className={isVerified ? 'text-emerald-700 font-bold' : gapResult.hasGaps ? 'text-rose-600 font-bold' : 'text-slate-500'}>
                        {gapResult.hasGaps ? `${gapResult.missingCount} Missing` : '0 Gaps ✓'}
                      </span>
                    )}
                  </div>

                  {/* Range preview */}
                  {hasStudents && gapResult.minRegisterNumber && (
                    <div className="text-[10px] font-mono text-slate-500 mb-3 bg-white/70 p-1.5 rounded-lg border border-slate-200/70 truncate">
                      {gapResult.minRegisterNumber} → {gapResult.maxRegisterNumber}
                    </div>
                  )}

                  {/* Verify Button for this specific year */}
                  <button
                    type="button"
                    onClick={() => toggleDeptYearVerification(selectedDept, item.year)}
                    className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isVerified
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs ring-1 ring-emerald-300'
                        : 'bg-white hover:bg-emerald-50 text-emerald-700 border-2 border-emerald-500 hover:border-emerald-600 shadow-2xs'
                    }`}
                    title={
                      isVerified
                        ? `Click to unverify ${selectedDept} ${item.year}`
                        : `Click to verify ${selectedDept} ${item.year}`
                    }
                  >
                    {isVerified ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Verified ✓ ({item.year})</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Verify {item.year}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
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
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${tableRosterView === 'all_slots'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                All Slots ({totalRosterCount})
              </button>
              <button
                type="button"
                onClick={() => setTableRosterView('submitted')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${tableRosterView === 'submitted'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-emerald-700'
                  }`}
              >
                Submitted ({submittedCount})
              </button>
              <button
                type="button"
                onClick={() => setTableRosterView('missing')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${tableRosterView === 'missing'
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
              onClick={handleOpenReportModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-all cursor-pointer"
              title={`View ${getDeptShortCode(selectedDept)} Year-Wise Registered Students Report`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Report</span>
            </button>

            <button
              type="button"
              onClick={handleExportSQL}
              disabled={students.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Download SQL dump file for phpMyAdmin / MariaDB import"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Export SQL Dump</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200/80 text-xs font-bold uppercase tracking-wider text-slate-500">
                <th className="py-4 px-4 sm:px-5 w-20 min-w-[75px]">S.No</th>
                <th className="py-4 px-4 sm:px-5 min-w-[160px]">Register Number</th>
                <th className="py-4 px-4 sm:px-5 min-w-[190px]">Student Name</th>
                <th className="py-4 px-4 sm:px-5 min-w-[140px]">Department &amp; Year</th>
                <th className="py-4 px-4 sm:px-5 min-w-[210px]">Bus Route</th>
                <th className="py-4 px-4 sm:px-5 min-w-[200px]">Boarding Stop</th>
                <th className="py-4 px-4 sm:px-5 min-w-[120px]">Status</th>
                <th className="py-4 px-4 sm:px-5 min-w-[140px] text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rosterItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <p className="text-base font-semibold text-slate-600">No student records found</p>
                    <p className="text-xs mt-1">Try selecting a different department or clearing search filters</p>
                  </td>
                </tr>
              ) : (
                rosterItems.map((item) => (
                  <tr
                    key={item.key}
                    className={`transition-colors group ${item.isSubmitted
                      ? 'hover:bg-slate-50/80 bg-white'
                      : 'bg-rose-50/25 hover:bg-rose-50/50'
                      }`}
                  >
                    {/* S.No / Roll Number */}
                    <td className="py-3.5 px-4 sm:px-5 font-mono font-bold text-sm whitespace-nowrap">
                      <span className={item.isSubmitted ? 'text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200/60 font-mono font-extrabold text-xs inline-block min-w-[42px] text-center shadow-2xs' : 'text-slate-400 px-2.5 font-mono'}>
                        #{item.sNo > 0 ? item.sNo : '-'}
                      </span>
                    </td>

                    {/* Register Number */}
                    <td className="py-3.5 px-4 sm:px-5 font-mono font-bold text-slate-900 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold tracking-wider ${item.isSubmitted
                          ? 'bg-slate-100 text-slate-900 border-slate-200/80 shadow-2xs'
                          : 'bg-rose-100/50 text-rose-800 border-rose-200'
                          }`}>
                          {item.identifier}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(item.identifier, item.identifier)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition-all cursor-pointer"
                          title="Copy Register Number"
                        >
                          {copiedText === item.identifier ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Student Name */}
                    <td className="py-3.5 px-4 sm:px-5 whitespace-nowrap">
                      {item.isSubmitted ? (
                        <span className="font-bold text-slate-900 text-sm tracking-wide">{item.studentName}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-500 font-medium italic text-xs">
                          Not Submitted
                        </span>
                      )}
                    </td>

                    {/* Department & Year */}
                    <td className="py-3.5 px-4 sm:px-5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                        <span>{getDeptShortCode(item.departmentOrClass)}</span>
                      </div>
                      {item.isSubmitted && item.yearOrSection && (
                        <div className="text-xs text-slate-500 font-medium mt-0.5">{item.yearOrSection}</div>
                      )}
                    </td>

                    {/* Bus Route */}
                    <td className="py-3.5 px-4 sm:px-5 whitespace-nowrap">
                      {item.isSubmitted ? (
                        item.isHostel ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100/90 text-amber-800 border border-amber-200 shadow-2xs">
                            <Home className="h-3.5 w-3.5 text-amber-600" />
                            <span>Hostel Resident</span>
                          </span>
                        ) : item.busRouteName && item.busRouteName !== '-' ? (
                          <div className="flex items-center gap-2 text-slate-800 text-xs">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs shrink-0">
                              Route {item.busRouteId}
                            </span>
                            <span className="font-semibold truncate max-w-[200px]" title={item.busRouteName}>{item.busRouteName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Boarding Stop */}
                    <td className="py-3.5 px-4 sm:px-5 whitespace-nowrap">
                      {item.isSubmitted ? (
                        item.isHostel ? (
                          <span className="text-xs text-amber-800/80 font-medium italic">Campus Hostel (NULL)</span>
                        ) : item.stoppingName && item.stoppingName !== '-' ? (
                          <div className="flex items-center gap-1.5 text-slate-800 text-xs font-semibold">
                            <span className="truncate max-w-[200px]" title={item.stoppingName}>{item.stoppingName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Status Pill */}
                    <td className="py-3.5 px-4 sm:px-5 whitespace-nowrap">
                      {item.isSubmitted ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Submitted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100/80 text-rose-700 border border-rose-200 shadow-2xs">
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                          Pending
                        </span>
                      )}
                    </td>

                    {/* Action Buttons (Edit & Delete) */}
                    <td className="py-3.5 px-4 sm:px-5 whitespace-nowrap text-center">
                      {item.isSubmitted && item.rawStudent ? (
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(item.rawStudent!)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 transition-all cursor-pointer shadow-2xs group/btn"
                            title={`Edit ${item.studentName}'s details`}
                          >
                            <Pencil className="h-3.5 w-3.5 text-indigo-500 group-hover/btn:text-white transition-colors" />
                            <span>Edit</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => setDeletingStudent(item.rawStudent!)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600 transition-all cursor-pointer shadow-2xs group/delBtn"
                            title={`Delete ${item.studentName} from database`}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-rose-500 group-hover/delBtn:text-white transition-colors" />
                            <span>Delete</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast message after saving edit */}
      {editToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{editToast}</span>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="px-6 py-4.5 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-white/10 flex items-center justify-center text-sky-400">
                  <Pencil className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Edit Student Details</h3>
                  <p className="text-[11px] text-slate-300 font-mono font-semibold">
                    Reg No: {editingStudent.identifier}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="h-7 w-7 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveStudentEdit} className="p-6 space-y-4 text-xs">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Register Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Register Number (12 Digits Only) <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${editFormData.identifier.length === 12
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                    {editFormData.identifier.length}/12 digits
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={12}
                    value={editFormData.identifier}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 12);
                      setEditFormData((prev) => ({
                        ...prev,
                        identifier: digitsOnly,
                      }));
                    }}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none tracking-wider text-xs"
                    placeholder="e.g. 921023243001"
                    required
                  />
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Must be exactly 12 numbers (no more, no less, letters/symbols blocked).
                </p>
              </div>

              {/* Student Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Student Name (Capital Letters) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={editFormData.studentName}
                    onChange={(e) =>
                      setEditFormData((prev) => ({
                        ...prev,
                        studentName: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl uppercase font-semibold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                    placeholder="e.g. K.AJAY PRASATH"
                    required
                  />
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </div>

              {/* Department & Year Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Department</label>
                  <select
                    value={editFormData.departmentOrClass}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, departmentOrClass: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:bg-white focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    {ENGINEERING_DEPARTMENTS.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Year of Study</label>
                  <select
                    value={editFormData.yearOrSection}
                    onChange={(e) =>
                      setEditFormData((prev) => ({ ...prev, yearOrSection: e.target.value }))
                    }
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:bg-white focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    {COLLEGE_YEARS.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Residence Category: Day Scholar vs Hostel */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Residence Category
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditFormData((prev) => ({ ...prev, isHostel: false }))}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-semibold transition-all cursor-pointer ${!editFormData.isHostel
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-100'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <Bus className="h-4 w-4 text-indigo-600" />
                    <span>🚌 Day Scholar (Bus)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setEditFormData((prev) => ({
                        ...prev,
                        isHostel: true,
                        busRouteId: '',
                        stoppingName: '',
                      }))
                    }
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-semibold transition-all cursor-pointer ${editFormData.isHostel
                      ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-100'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    <Home className="h-4 w-4 text-amber-600" />
                    <span>🏢 Hostel Resident</span>
                  </button>
                </div>
              </div>

              {/* Day Scholar Route & Stop selection */}
              {!editFormData.isHostel ? (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  {/* Bus Route Select */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Engineering Bus Route <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={editFormData.busRouteId}
                      onChange={(e) => handleEditRouteChange(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:bg-white focus:border-indigo-500 outline-none cursor-pointer"
                    >
                      {BUS_ROUTES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.routeNumber} — {r.name} ({r.stops.length} stops)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Boarding Stop Select */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Boarding Stop <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={editFormData.stoppingName}
                      onChange={(e) =>
                        setEditFormData((prev) => ({ ...prev, stoppingName: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold focus:bg-white focus:border-indigo-500 outline-none cursor-pointer"
                    >
                      {editAvailableStops.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs">
                  <span className="font-bold">Campus Resident: </span>
                  Bus route and boarding stop will be recorded as <span className="font-mono font-bold bg-amber-100 px-1 py-0.5 rounded">NULL</span> in the database.
                </div>
              )}

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-between gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeletingStudent(editingStudent)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                  title="Delete this student record"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Student</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingStudent(null)}
                    disabled={isSavingEdit}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSavingEdit ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal with Student Details */}
      {deletingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="h-12 w-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto">
              <Trash2 className="h-6 w-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Confirm Student Deletion
              </h3>
              <p className="text-xs text-slate-500">
                Are you sure you want to delete this student record?
              </p>
            </div>

            {/* Student Record Details Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs text-left">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Student Name:</span>
                <span className="font-extrabold text-slate-900">{deletingStudent.studentName}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Register Number:</span>
                <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  {deletingStudent.identifier}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Department &amp; Year:</span>
                <span className="font-semibold text-slate-800">
                  {deletingStudent.departmentOrClass} • {deletingStudent.yearOrSection}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Residence / Route:</span>
                <span className="font-semibold text-slate-800">
                  {deletingStudent.isHostel
                    ? '🏢 Hostel Resident'
                    : `${deletingStudent.busRouteName || 'Day Scholar'} • ${deletingStudent.stoppingName || '—'}`}
                </span>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200/80 rounded-xl text-[11px] text-rose-800 font-medium text-center">
              ⚠️ This will permanently remove the record from the MySQL database and update gap calculations.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStudent(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting Record...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Yes, Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Department-Wise Report Modal (Exact Match to User Mockup) */}
      {showDeptReportModal &&
        createPortal(
          <div
            id="printable-report-portal"
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-2 sm:p-6 overflow-y-auto animate-in fade-in duration-150"
          >
            {/* Print Styles */}
            <style>{`
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 15mm 15mm;
                }
                html, body {
                  height: auto !important;
                  min-height: 0 !important;
                  overflow: visible !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                #root {
                  display: none !important;
                  height: 0 !important;
                  overflow: hidden !important;
                }
                #printable-report-portal {
                  position: static !important;
                  inset: auto !important;
                  display: block !important;
                  width: 100% !important;
                  height: auto !important;
                  min-height: 0 !important;
                  max-height: none !important;
                  overflow: visible !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  backdrop-filter: none !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                #printable-dept-report {
                  display: block !important;
                  position: static !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .no-print, .print\\:hidden {
                  display: none !important;
                }
                .print-card {
                  background: #ffffff !important;
                  color: #000000 !important;
                  border: none !important;
                  box-shadow: none !important;
                  border-radius: 0 !important;
                  padding: 0 !important;
                  margin: 0 0 2rem 0 !important;
                  width: 100% !important;
                  box-sizing: border-box !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .print-page-break {
                  break-after: page !important;
                  page-break-after: always !important;
                }
                .print-break-inside-avoid {
                  break-inside: avoid !important;
                  page-break-inside: avoid !important;
                }
                table.official-report-table {
                  border-collapse: collapse !important;
                  width: 100% !important;
                  border: 1px solid #000000 !important;
                  page-break-inside: auto !important;
                  break-inside: auto !important;
                }
                table.official-report-table th, table.official-report-table td {
                  border: 1px solid #000000 !important;
                }
                tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                thead {
                  display: table-header-group !important;
                }
              }
            `}</style>

            {/* Top Control Bar (Screen only, hidden on print) */}
            <div className="max-w-4xl w-full mx-auto mb-4 bg-slate-900/95 border border-slate-800 rounded-2xl p-3.5 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xl print:hidden no-print">
              {/* Department Selector Pills */}
              <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
                <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Dept:</span>
                {ENGINEERING_DEPARTMENTS.map((d) => {
                  const count = students.filter((s) => s.departmentOrClass === d.name).length;
                  const isSelected = reportActiveDeptTab === d.name;
                  const label = d.code === 'AD' ? 'AI & DS' : d.code;
                  return (
                    <button
                      key={d.code}
                      type="button"
                      onClick={() => setReportActiveDeptTab(d.name)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white text-black shadow'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                      }`}
                    >
                      <span>{label}</span>
                      <span className={`text-[10px] px-1 rounded-full font-mono ${isSelected ? 'bg-slate-200 text-slate-900' : 'bg-slate-900 text-slate-400'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setReportActiveDeptTab('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    reportActiveDeptTab === 'ALL'
                      ? 'bg-white text-black shadow'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                  }`}
                >
                  All Depts
                </button>
              </div>

              {/* Year Selector & Actions */}
              <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5 w-full md:w-auto">
                {/* Year Filter */}
                <div className="inline-flex items-center bg-slate-800/90 p-0.5 rounded-lg border border-slate-700/60 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setReportYearFilter('ALL')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                      reportYearFilter === 'ALL' ? 'bg-white text-black font-bold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    All Years
                  </button>
                  {COLLEGE_YEARS.map((yr) => {
                    const roman = yr.includes('1') ? 'I' : yr.includes('2') ? 'II' : yr.includes('3') ? 'III' : 'IV';
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setReportYearFilter(yr)}
                        className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                          reportYearFilter === yr ? 'bg-white text-black font-bold' : 'text-slate-300 hover:text-white'
                        }`}
                        title={yr}
                      >
                        {roman} Year
                      </button>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-black hover:bg-slate-200 transition-all cursor-pointer shadow-xs"
                    title="Print / Save as PDF"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Print</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportDepartmentWiseCSV}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
                    title="Export to CSV"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowDeptReportModal(false)}
                    className="h-7 w-7 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-200 flex items-center justify-center transition-colors cursor-pointer border border-slate-700"
                    title="Close Report"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Printable Report Document (exact match to user mockup) */}
            <div id="printable-dept-report" className="max-w-4xl w-full mx-auto space-y-8 my-auto">
              {(() => {
                const deptsToRender = reportActiveDeptTab === 'ALL'
                  ? ENGINEERING_DEPARTMENTS
                  : ENGINEERING_DEPARTMENTS.filter((d) => d.name === reportActiveDeptTab);

                const getDeptLabel = (name: string, code: string) => {
                  if (code === 'AD' || name.includes('Artificial Intelligence')) return 'AI & DS';
                  return code || name;
                };

                const toRoman = (yr: string) => {
                  if (yr.includes('1')) return 'I Year';
                  if (yr.includes('2')) return 'II Year';
                  if (yr.includes('3')) return 'III Year';
                  if (yr.includes('4')) return 'IV Year';
                  return yr;
                };

                return deptsToRender.map((dept, deptIdx) => {
                  const yearsToRender = reportYearFilter === 'ALL'
                    ? COLLEGE_YEARS
                    : COLLEGE_YEARS.filter((y) => y === reportYearFilter);

                  return yearsToRender.map((yr, yrIdx) => {
                    const isLastCard =
                      deptIdx === deptsToRender.length - 1 &&
                      yrIdx === yearsToRender.length - 1;

                    let batchStudents = students.filter(
                      (s) => s.departmentOrClass === dept.name && s.yearOrSection === yr
                    );

                    // Sort by Roll Number / Register Number
                    batchStudents.sort((a, b) => {
                      const aRoll = extractRollNumber(a.identifier);
                      const bRoll = extractRollNumber(b.identifier);
                      if (aRoll && bRoll && aRoll.rollNo !== bRoll.rollNo) {
                        return aRoll.rollNo - bRoll.rollNo;
                      }
                      return a.identifier.localeCompare(b.identifier, undefined, { numeric: true });
                    });

                    return (
                      <div
                        key={`${dept.code}-${yr}`}
                        style={{ fontFamily: '"Times New Roman", Times, serif' }}
                        className={`bg-white text-black p-8 sm:p-12 shadow-2xl font-serif print-card print-break-inside-avoid border border-slate-300 sm:rounded-lg max-w-4xl mx-auto ${
                          !isLastCard ? 'print-page-break' : ''
                        }`}
                      >
                        {/* Centered Heading */}
                        <div className="text-center space-y-1.5 mb-6">
                          <h2 className="text-2xl sm:text-[26px] font-bold tracking-tight uppercase text-black">
                            STUDENT REGISTRATION REPORT
                          </h2>
                          <p className="text-sm sm:text-base text-black font-normal">
                            Training Management System (TMS)
                          </p>
                          <p className="text-sm sm:text-base text-black font-semibold">
                            Nadar Saraswathi College of Engineering and Technology
                          </p>
                        </div>

                        {/* Metadata Box with black border */}
                        <div className="border border-black p-3.5 sm:p-4 mb-6 text-sm sm:text-base text-black">
                          <div className="flex flex-col sm:flex-row justify-between gap-y-2">
                            <div className="space-y-2">
                              <div className="flex items-center">
                                <span className="font-bold inline-block w-36">Department</span>
                                <span className="font-bold mr-3">:</span>
                                <span className="font-medium">{getDeptLabel(dept.name, dept.code)}</span>
                              </div>
                              <div className="flex items-center">
                                <span className="font-bold inline-block w-36">Total Registered</span>
                                <span className="font-bold mr-3">:</span>
                                <span className="font-medium">{batchStudents.length} Students</span>
                              </div>
                            </div>
                            <div className="space-y-2 sm:pr-8">
                              <div className="flex items-center">
                                <span className="font-bold inline-block w-20">Year</span>
                                <span className="font-bold mr-3">:</span>
                                <span className="font-medium">{toRoman(yr)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Student Table with black grid borders */}
                        <div className="overflow-x-auto">
                          <table className="official-report-table w-full text-center border-collapse border border-black text-sm sm:text-base">
                            <thead>
                              <tr className="border-b border-black text-black font-bold">
                                <th className="py-2.5 px-3 w-20 sm:w-24 text-center border border-black">S.No</th>
                                <th className="py-2.5 px-6 min-w-[200px] text-center border border-black">Register Number</th>
                                <th className="py-2.5 px-6 min-w-[240px] text-center border border-black">Student Name</th>
                              </tr>
                            </thead>
                            <tbody>
                              {batchStudents.length === 0 ? (
                                <tr>
                                  <td colSpan={3} className="py-8 text-center text-slate-500 italic border border-black">
                                    No registered students found for this year.
                                  </td>
                                </tr>
                              ) : (
                                batchStudents.map((student, idx) => (
                                  <tr
                                    key={student.id || student.identifier}
                                    className="border-b border-black text-black"
                                  >
                                    <td className="py-2.5 px-3 text-center border border-black font-medium">
                                      {idx + 1}
                                    </td>
                                    <td className="py-2.5 px-6 text-center border border-black font-medium tracking-wide">
                                      {student.identifier}
                                    </td>
                                    <td className="py-2.5 px-6 text-center border border-black uppercase font-medium tracking-wide">
                                      {student.studentName}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Bottom-Right Footer: Total Registered */}
                        <div className="mt-4 text-right text-sm sm:text-base font-bold text-black">
                          <span>Total Registered</span>
                          <span className="mx-2">:</span>
                          <span>{batchStudents.length} Students</span>
                        </div>
                      </div>
                    );
                  });
                });
              })()}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
