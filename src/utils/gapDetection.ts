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

export interface RegisterRangeGroup {
  prefix: string;
  startVal: number;
  endVal: number;
  startFormatted: string;
  endFormatted: string;
  submittedCount: number;
  missingCount: number;
  missingNumbers: string[];
}

export interface GapDetectionResult {
  totalSubmitted: number;
  minRegisterNumber: string | null;
  maxRegisterNumber: string | null;
  missingCount: number;
  missingNumbers: string[];
  sortedSubmitted: string[];
  hasGaps: boolean;
  groups: RegisterRangeGroup[];
}

interface ParsedRegisterNumber {
  raw: string;
  prefix: string;
  numericVal: number;
  padLength: number;
  suffix: string;
}

/**
 * Detects missing register numbers based on continuous ranges.
 * If there is a large gap between register numbers (e.g., regular batch 001–026 and lateral batch 301–305),
 * it creates separate continuous groups and evaluates missing numbers ONLY within each group's range.
 * Gaps between batches (e.g., 027–300 or 054–920) are NOT considered missing.
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
      groups: [],
    };
  }

  // Parse each identifier into prefix, numeric value, padding length, suffix
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
          numericVal: parseInt(rollSeqStr, 10),
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
            numericVal: parseInt(rollSeqStr, 10),
            padLength: 3,
            suffix: '',
          });
          continue;
        }

        parsedItems.push({
          raw,
          prefix: '',
          numericVal: parseInt(raw, 10),
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
          numericVal: parseInt(match[2], 10),
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
      numericVal: 0,
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
      return a.numericVal - b.numericVal;
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

  // Group by prefix and suffix
  const prefixGroups = new Map<string, ParsedRegisterNumber[]>();
  for (const item of uniqueItems) {
    const groupKey = `${item.prefix}___${item.suffix}`;
    if (!prefixGroups.has(groupKey)) {
      prefixGroups.set(groupKey, []);
    }
    prefixGroups.get(groupKey)!.push(item);
  }

  const missingNumbers: string[] = [];
  const groupsSummary: RegisterRangeGroup[] = [];
  const MAX_REPORTABLE_GAPS = 5000;
  // Threshold to detect a break/jump between continuous series (e.g., 026 to 301 is a jump of 275)
  const LARGE_GAP_THRESHOLD = 30;

  for (const [, items] of prefixGroups.entries()) {
    items.sort((a, b) => a.numericVal - b.numericVal);
    const sample = items[0];

    // Partition `items` into continuous clusters based on large gaps or hundred-boundary jumps
    const clusters: ParsedRegisterNumber[][] = [];
    let currentCluster: ParsedRegisterNumber[] = [items[0]];

    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      const curr = items[i];
      const diff = curr.numericVal - prev.numericVal;

      // Check if we crossed a standard college batch boundary or gap > threshold
      const crossedHundredBoundary =
        (prev.numericVal < 300 && curr.numericVal >= 300) ||
        (prev.numericVal < 500 && curr.numericVal >= 500) ||
        (prev.numericVal < 700 && curr.numericVal >= 700) ||
        (prev.numericVal < 900 && curr.numericVal >= 900);

      const isLargeGap = diff > LARGE_GAP_THRESHOLD;

      if (crossedHundredBoundary || isLargeGap) {
        clusters.push(currentCluster);
        currentCluster = [curr];
      } else {
        currentCluster.push(curr);
      }
    }
    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    // Process each continuous cluster independently
    for (const cluster of clusters) {
      const clusterSubmittedSet = new Set<number>(cluster.map((x) => x.numericVal));
      const minClusterVal = cluster[0].numericVal;
      const maxClusterVal = cluster[cluster.length - 1].numericVal;

      // Determine base starting roll number for this continuous cluster:
      let startVal = minClusterVal;
      if (minClusterVal < 300) {
        // Regular batch starts at 1 if min <= 60
        if (minClusterVal <= 60) {
          startVal = 1;
        }
      } else if (minClusterVal >= 301 && minClusterVal <= 330) {
        // Lateral entry batch starts at 301
        startVal = 301;
      } else if (minClusterVal >= 501 && minClusterVal <= 520) {
        startVal = 501;
      } else if (minClusterVal >= 701 && minClusterVal <= 720) {
        startVal = 701;
      } else if (minClusterVal >= 901 && minClusterVal <= 910) {
        startVal = 901;
      }

      const clusterMissing: string[] = [];
      for (let v = startVal; v <= maxClusterVal; v++) {
        if (!clusterSubmittedSet.has(v)) {
          const formattedNum = v.toString().padStart(sample.padLength, '0');
          const missingFull = `${sample.prefix}${formattedNum}${sample.suffix}`;
          clusterMissing.push(missingFull);
          missingNumbers.push(missingFull);
          if (missingNumbers.length >= MAX_REPORTABLE_GAPS) break;
        }
      }

      const startFormatted = `${sample.prefix}${startVal.toString().padStart(sample.padLength, '0')}${sample.suffix}`;
      const endFormatted = `${sample.prefix}${maxClusterVal.toString().padStart(sample.padLength, '0')}${sample.suffix}`;

      groupsSummary.push({
        prefix: sample.prefix,
        startVal,
        endVal: maxClusterVal,
        startFormatted,
        endFormatted,
        submittedCount: cluster.length,
        missingCount: clusterMissing.length,
        missingNumbers: clusterMissing,
      });
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
    groups: groupsSummary,
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
  groups: RegisterRangeGroup[];
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
      groups: res.groups,
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
