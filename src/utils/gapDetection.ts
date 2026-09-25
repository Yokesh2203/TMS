export interface RollNumberInfo {
  rollNo: number;
  prefix: string;
  padLength: number;
  raw: string;
}

/**
 * Extracts the roll number / serial number from an Anna University or standard register number.
 * e.g. 921023243026 -> rollNo: 26, prefix: "921023243", padLength: 3
 * e.g. 921023106001 -> rollNo: 1, prefix: "921023106", padLength: 3
 */
export function extractRollNumber(rawIdentifier: string): RollNumberInfo | null {
  const clean = (rawIdentifier || '').trim();
  if (!clean) return null;

  // 1. Standard Anna University 12-digit format
  if (/^\d{12}$/.test(clean)) {
    const prefix = clean.slice(0, 9);
    const rollSeqStr = clean.slice(9);
    const num = parseInt(rollSeqStr, 10);
    if (!isNaN(num)) {
      return {
        rollNo: num,
        prefix,
        padLength: 3,
        raw: clean,
      };
    }
  }

  // 2. Generic fully numeric identifier (>= 6 digits)
  if (/^\d{6,}$/.test(clean)) {
    const prefix = clean.slice(0, -3);
    const rollSeqStr = clean.slice(-3);
    const num = parseInt(rollSeqStr, 10);
    if (!isNaN(num)) {
      return {
        rollNo: num,
        prefix,
        padLength: 3,
        raw: clean,
      };
    }
  }

  // 3. Alphanumeric format ending in 1 to 4 digits e.g. "NSCET-026"
  const match = clean.match(/^(.*?)(\d{1,4})$/);
  if (match) {
    const num = parseInt(match[2], 10);
    if (!isNaN(num)) {
      return {
        rollNo: num,
        prefix: match[1],
        padLength: match[2].length,
        raw: clean,
      };
    }
  }

  return null;
}

export interface GapDetectionResult {
  totalSubmitted: number;
  minRegisterNumber: string | null;
  maxRegisterNumber: string | null;
  missingCount: number;
  missingNumbers: string[];
  sortedSubmitted: string[];
  hasGaps: boolean;
}

interface ParsedRegisterNumber {
  raw: string;
  prefix: string;
  numericVal: bigint;
  padLength: number;
  suffix: string;
}

/**
 * Detects missing register numbers starting from 001 (roll number 1) up to the maximum submitted register number.
 * College engineering register series always begin at ...001.
 * e.g. If student 921023243026 is submitted, missing are 921023243001 to 921023243025 (25 missing).
 */
export function detectRegisterNumberGaps(identifiers: string[]): GapDetectionResult {
  const cleaned = identifiers
    .map((id) => (id || '').trim())
    .filter((id) => id.length > 0);

  if (cleaned.length === 0) {
    return {
      totalSubmitted: 0,
      minRegisterNumber: null,
      maxRegisterNumber: null,
      missingCount: 0,
      missingNumbers: [],
      sortedSubmitted: [],
      hasGaps: false,
    };
  }

  // Parse each identifier into prefix, numeric BigInt value, padding length, suffix
  const parsedItems: ParsedRegisterNumber[] = [];

  for (const raw of cleaned) {
    // 1. Standard Anna University 12-digit engineering register number:
    if (/^\d{12}$/.test(raw)) {
      try {
        const seriesPrefix = raw.slice(0, 9);
        const rollSeqStr = raw.slice(9);
        parsedItems.push({
          raw,
          prefix: seriesPrefix,
          numericVal: BigInt(rollSeqStr),
          padLength: 3,
          suffix: '',
        });
        continue;
      } catch {
        // fallback
      }
    }

    // 2. Generic fully numeric identifier (>= 6 digits)
    if (/^\d+$/.test(raw)) {
      try {
        if (raw.length >= 6) {
          const seriesPrefix = raw.slice(0, raw.length - 3);
          const rollSeqStr = raw.slice(raw.length - 3);
          parsedItems.push({
            raw,
            prefix: seriesPrefix,
            numericVal: BigInt(rollSeqStr),
            padLength: 3,
            suffix: '',
          });
          continue;
        }

        parsedItems.push({
          raw,
          prefix: '',
          numericVal: BigInt(raw),
          padLength: raw.length,
          suffix: '',
        });
        continue;
      } catch {
        // Fallback below
      }
    }

    // 3. Alphanumeric format e.g. "NSCET-CSE-001" or "23AD001"
    const match = raw.match(/^(.*?)(\d+)(.*?)$/);
    if (match) {
      try {
        parsedItems.push({
          raw,
          prefix: match[1],
          numericVal: BigInt(match[2]),
          padLength: match[2].length,
          suffix: match[3],
        });
        continue;
      } catch {
        // fallback
      }
    }

    // 4. Non-numeric fallback
    parsedItems.push({
      raw,
      prefix: raw,
      numericVal: 0n,
      padLength: 0,
      suffix: '',
    });
  }

  // Deduplicate and sort in ascending order
  parsedItems.sort((a, b) => {
    if (a.prefix !== b.prefix) {
      return a.prefix.localeCompare(b.prefix);
    }
    if (a.numericVal !== b.numericVal) {
      return a.numericVal < b.numericVal ? -1 : 1;
    }
    return a.suffix.localeCompare(b.suffix);
  });

  const uniqueItems: ParsedRegisterNumber[] = [];
  const seenRaws = new Set<string>();
  for (const item of parsedItems) {
    if (!seenRaws.has(item.raw)) {
      seenRaws.add(item.raw);
      uniqueItems.push(item);
    }
  }

  const sortedSubmitted = uniqueItems.map((item) => item.raw);
  const minRegisterNumber = sortedSubmitted[0] || null;
  const maxRegisterNumber = sortedSubmitted[sortedSubmitted.length - 1] || null;

  // Group by prefix and suffix to evaluate each series from 001 up to max submitted
  const prefixGroups = new Map<string, ParsedRegisterNumber[]>();
  for (const item of uniqueItems) {
    const groupKey = `${item.prefix}___${item.suffix}`;
    if (!prefixGroups.has(groupKey)) {
      prefixGroups.set(groupKey, []);
    }
    prefixGroups.get(groupKey)!.push(item);
  }

  const missingNumbers: string[] = [];
  const MAX_REPORTABLE_GAPS = 5000;

  for (const [, items] of prefixGroups.entries()) {
    items.sort((a, b) => (a.numericVal < b.numericVal ? -1 : 1));
    const submittedSet = new Set<bigint>(items.map((x) => x.numericVal));
    const maxVal = items[items.length - 1].numericVal;
    const minVal = items[0].numericVal;
    const sample = items[0];

    // Determine the base starting number for this college series:
    // Regular students start at roll number 1 (001).
    // Lateral entry students typically start at 301.
    let startVal = 1n;
    if (minVal >= 301n && minVal <= 399n) {
      startVal = 301n;
    } else if (minVal > 1000n) {
      startVal = minVal;
    }

    // Check all roll numbers from startVal up to maxVal
    for (let currentVal = startVal; currentVal <= maxVal; currentVal++) {
      if (!submittedSet.has(currentVal)) {
        const formattedNum = currentVal.toString().padStart(sample.padLength, '0');
        const missingFull = `${sample.prefix}${formattedNum}${sample.suffix}`;
        missingNumbers.push(missingFull);

        if (missingNumbers.length >= MAX_REPORTABLE_GAPS) break;
      }
    }
  }

  return {
    totalSubmitted: uniqueItems.length,
    minRegisterNumber,
    maxRegisterNumber,
    missingCount: missingNumbers.length,
    missingNumbers,
    sortedSubmitted,
    hasGaps: missingNumbers.length > 0,
  };
}

export interface DepartmentGapReport {
  department: string;
  totalSubmitted: number;
  minRegisterNumber: string | null;
  maxRegisterNumber: string | null;
  missingCount: number;
  missingNumbers: string[];
  hasGaps: boolean;
}

/**
 * Detects gaps separated by department, ensuring each department is evaluated strictly on its own.
 */
export function detectDepartmentGaps(
  records: { identifier: string; departmentOrClass: string }[]
): {
  departmentReports: DepartmentGapReport[];
  totalMissingCount: number;
  allMissingNumbers: string[];
} {
  // Group records by department
  const deptMap: Record<string, string[]> = {};

  records.forEach((r) => {
    const dept = (r.departmentOrClass || 'Unassigned').trim();
    if (!deptMap[dept]) {
      deptMap[dept] = [];
    }
    deptMap[dept].push(r.identifier);
  });

  const departmentReports: DepartmentGapReport[] = [];
  let totalMissingCount = 0;
  const allMissingNumbers: string[] = [];

  Object.keys(deptMap).sort().forEach((dept) => {
    const ids = deptMap[dept];
    const res = detectRegisterNumberGaps(ids);
    departmentReports.push({
      department: dept,
      totalSubmitted: res.totalSubmitted,
      minRegisterNumber: res.minRegisterNumber,
      maxRegisterNumber: res.maxRegisterNumber,
      missingCount: res.missingCount,
      missingNumbers: res.missingNumbers,
      hasGaps: res.hasGaps,
    });
    totalMissingCount += res.missingCount;
    allMissingNumbers.push(...res.missingNumbers);
  });

  return {
    departmentReports,
    totalMissingCount,
    allMissingNumbers,
  };
}
