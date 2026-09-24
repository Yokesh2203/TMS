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
 * Detects missing register numbers strictly between the minimum and maximum submitted register numbers.
 * Rules:
 * 1. Sort register numbers in ascending order.
 * 2. Only find gaps between the first (min) and last (max) submitted register numbers.
 * 3. Never assume total student strength.
 * 4. Never generate numbers after the last submitted record.
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
    // Format: [College 4 digits][Batch/Year 2 digits][Dept Code 3 digits][Roll No 3 digits]
    // e.g. 9210 23 243 001 (AD) vs 9210 23 105 001 (IT)
    if (/^\d{12}$/.test(raw)) {
      try {
        const seriesPrefix = raw.slice(0, 9); // e.g. 921023243 or 921023105
        const rollSeqStr = raw.slice(9);      // e.g. 001 to 026
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

    // 2. Generic fully numeric identifier (e.g. 6 to 11 digits)
    if (/^\d+$/.test(raw)) {
      try {
        // If length >= 6, use the leading digits as prefix and last 3 digits as roll number
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
  // Sort by prefix first, then numericVal, then suffix
  parsedItems.sort((a, b) => {
    if (a.prefix !== b.prefix) {
      return a.prefix.localeCompare(b.prefix);
    }
    if (a.numericVal !== b.numericVal) {
      return a.numericVal < b.numericVal ? -1 : 1;
    }
    return a.suffix.localeCompare(b.suffix);
  });

  // Remove exact duplicates in sorted list
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

  if (uniqueItems.length <= 1) {
    return {
      totalSubmitted: uniqueItems.length,
      minRegisterNumber,
      maxRegisterNumber,
      missingCount: 0,
      missingNumbers: [],
      sortedSubmitted,
      hasGaps: false,
    };
  }

  const missingNumbers: string[] = [];
  const MAX_REPORTABLE_GAPS = 5000; // Safeguard against massive accidental gaps

  // Find gaps strictly between consecutive records WITHIN THE SAME SERIES/PREFIX
  // (Never compares gaps across different department series prefixes)
  for (let i = 0; i < uniqueItems.length - 1; i++) {
    const current = uniqueItems[i];
    const next = uniqueItems[i + 1];

    // ONLY compare if the department/series prefix matches exactly!
    if (current.prefix === next.prefix && current.suffix === next.suffix) {
      const diff = next.numericVal - current.numericVal;

      if (diff > 1n) {
        // There is a gap between current and next within the same department series
        const gapSize = diff - 1n;
        const loopCount = gapSize > BigInt(MAX_REPORTABLE_GAPS) ? BigInt(MAX_REPORTABLE_GAPS) : gapSize;

        for (let step = 1n; step <= loopCount; step++) {
          const missingVal = current.numericVal + step;
          const formattedNum = missingVal.toString().padStart(current.padLength, '0');
          const missingFull = `${current.prefix}${formattedNum}${current.suffix}`;
          missingNumbers.push(missingFull);

          if (missingNumbers.length >= MAX_REPORTABLE_GAPS) break;
        }
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
