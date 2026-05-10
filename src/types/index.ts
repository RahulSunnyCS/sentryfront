export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
export type AccentTheme = 'teal' | 'indigo' | 'violet';
export type GradeStyle = 'ring' | 'shield' | 'letter';
export type CardStyle = 'elevated' | 'bordered' | 'flat';
export type ScanStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT';

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
}

export interface ScanModule {
  id: string;
  name: string;
}
