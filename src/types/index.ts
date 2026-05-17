export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
export type AccentTheme = 'teal' | 'indigo' | 'violet';
export type GradeStyle = 'ring' | 'shield' | 'letter';
export type CardStyle = 'elevated' | 'bordered' | 'flat';
export type ScanStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT';

// Single canonical definition lives in lighthouse.ts (the producer).
// Import locally so the names are usable in this module (e.g. PerformanceData
// below), and re-export so UI consumers can keep importing from '@/types'
// without a direct dependency on the scanner internals.
import type {
  CrUXDistribution,
  CrUXMetric,
  CrUXFieldData,
} from '@/lib/scanner/lighthouse';

export type { CrUXDistribution, CrUXMetric, CrUXFieldData };

/**
 * Desktop performance sub-object.
 * Only present when features.desktopPerformance is true AND mobile PSI succeeded.
 * Never drives the headline grade.
 */
export interface DesktopPerformanceData {
  score: number | null;
  grade: string;
  scoreSource: 'lab' | 'unavailable';
  metrics: {
    lcp: number | null;
    fcp: number | null;
    cls: number | null;
    tbt: number | null;
    ttfb: number | null;
    opportunities?: unknown[];
  };
}

/**
 * Performance section of the scan result, as returned by the API and consumed
 * by the report UI (T-09).
 *
 * All fields beyond the legacy core (grade/score/metrics) are optional so that
 * old persisted scans (pre-T-06) still typecheck and render.
 */
export interface PerformanceData {
  performanceGrade: string;
  /** 0-100 integer on success; null when PSI failed (UNAVAILABLE). */
  performanceScore: number | null;
  performanceMetrics: {
    lcp: number | null;
    fcp: number | null;
    cls: number | null;
    tbt: number | null;
    ttfb: number | null;
    opportunities?: unknown[];
    // T-08 new fields — all optional for back-compat with pre-T-06 blobs
    /** 'lab' when Lighthouse ran; 'unavailable' when PSI failed. */
    scoreSource?: 'lab' | 'unavailable';
    /** Google CrUX overallCategory verdict (FAST/AVERAGE/SLOW). Null when absent. */
    fieldDataVerdict?: string | null;
    /** Full CrUX field data block. Null when absent. */
    fieldData?: CrUXFieldData | null;
    /** Best-practices score (0-100). Null when PSI failed or category absent. */
    bestPracticesScore?: number | null;
    /** A-F grade for best practices; 'N/A' when null. */
    bestPracticesGrade?: string;
    /**
     * Desktop sub-object. Only present when desktopPerformance feature flag is on
     * AND mobile PSI succeeded. Never drives the headline grade.
     */
    desktop?: DesktopPerformanceData;
  } | null;
}

export type FindingDispositionValue =
  | 'helpful'
  | 'dismissed'
  | 'fp'
  | 'fix_didnt_help'
  | 'missed_other';

export interface Finding {
  id: string;
  module: string;
  category: string;
  severity: Severity;
  title: string;
  location: string;
  evidence: string;
  explanation: string;
  impact: string;
  fixManual: string[];
  fixAiPrompt: string;
  confidence?: 'high' | 'medium' | 'low' | null;
  currentDisposition?: FindingDispositionValue | null;
}

export interface ScanSummary {
  CRITICAL: number;
  HIGH: number;
  MEDIUM: number;
  LOW: number;
  INFO: number;
}

export interface ScanData {
  id?: string;
  url: string;
  grade: Grade;
  score: number;
  stack: string;
  date: string;
  duration: string;
  summary: ScanSummary;
  moduleResults: Record<string, number>;
  findings: Finding[];
  status?: ScanStatus;
  performanceData?: PerformanceData | null;
  accessibilityData?: {
    accessibilityGrade: string;
    accessibilityScore: number;
    accessibilityMetrics: {
      violations: unknown[];
    };
  } | null;
  seoData?: {
    seoGrade: string;
    seoScore: number;
    seoMetrics: {
      issues: unknown[];
    };
  } | null;
}

export interface ScanModule {
  id: string;
  name: string;
  plainName: string;
}
