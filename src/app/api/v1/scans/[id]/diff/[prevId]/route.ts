import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { features } from '@/lib/features';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; prevId: string } }
) {
  // Check if feature is enabled
  if (!features.scanDiff) {
    return NextResponse.json(
      { error: 'Scan comparison is not enabled. Set FEATURE_SCAN_DIFF_ENABLED=true to enable this feature.' },
      { status: 404 }
    );
  }

  const { id, prevId } = params;

  // Fetch both scans with findings
  const [currentScan, previousScan] = await Promise.all([
    prisma.scan.findUnique({
      where: { id },
      include: { findings: true },
    }),
    prisma.scan.findUnique({
      where: { id: prevId },
      include: { findings: true },
    }),
  ]);

  // Validate both scans exist
  if (!currentScan) {
    return NextResponse.json({ error: 'Current scan not found.' }, { status: 404 });
  }

  if (!previousScan) {
    return NextResponse.json({ error: 'Previous scan not found.' }, { status: 404 });
  }

  // Validate both scans are for the same target URL
  if (currentScan.targetUrl !== previousScan.targetUrl) {
    return NextResponse.json(
      { error: 'Cannot compare scans from different target URLs.' },
      { status: 400 }
    );
  }

  // Validate both scans are completed
  if (currentScan.status !== 'COMPLETED') {
    return NextResponse.json(
      { error: 'Current scan is not yet completed.' },
      { status: 409 }
    );
  }

  if (previousScan.status !== 'COMPLETED') {
    return NextResponse.json(
      { error: 'Previous scan is not yet completed.' },
      { status: 409 }
    );
  }

  // Calculate diff
  const diff = calculateScanDiff(currentScan, previousScan);

  return NextResponse.json(diff);
}

// ── Diff Calculation ─────────────────────────────────────────────────────────

type ScanWithFindings = {
  id: string;
  targetUrl: string;
  grade: string | null;
  score: number | null;
  summary: string | null;
  completedAt: Date | null;
  findings: Array<{
    id: string;
    moduleId: string;
    severity: string;
    category: string;
    title: string;
    location: string;
  }>;
};

function calculateScanDiff(current: ScanWithFindings, previous: ScanWithFindings) {
  // Parse summaries
  const currentSummary = current.summary ? JSON.parse(current.summary) : {};
  const previousSummary = previous.summary ? JSON.parse(previous.summary) : {};

  // Create finding signature map for comparison
  // Signature = moduleId + title + location (ignore evidence as it may change slightly)
  const prevFindingMap = new Map(
    previous.findings.map((f) => [
      `${f.moduleId}::${f.title}::${f.location}`,
      f,
    ])
  );

  const currentFindingMap = new Map(
    current.findings.map((f) => [
      `${f.moduleId}::${f.title}::${f.location}`,
      f,
    ])
  );

  // Identify new, fixed, and unchanged findings
  const newFindings = current.findings.filter(
    (f) => !prevFindingMap.has(`${f.moduleId}::${f.title}::${f.location}`)
  );

  const fixedFindings = previous.findings.filter(
    (f) => !currentFindingMap.has(`${f.moduleId}::${f.title}::${f.location}`)
  );

  const unchangedFindings = current.findings.filter((f) =>
    prevFindingMap.has(`${f.moduleId}::${f.title}::${f.location}`)
  );

  // Count changes by severity
  const newBySeverity = countBySeverity(newFindings);
  const fixedBySeverity = countBySeverity(fixedFindings);

  // Calculate score and grade changes
  const scoreDelta = (current.score ?? 0) - (previous.score ?? 0);
  const gradeChanged = current.grade !== previous.grade;

  return {
    targetUrl: current.targetUrl,
    current: {
      scanId: current.id,
      grade: current.grade,
      score: current.score,
      summary: currentSummary,
      completedAt: current.completedAt,
      totalFindings: current.findings.length,
    },
    previous: {
      scanId: previous.id,
      grade: previous.grade,
      score: previous.score,
      summary: previousSummary,
      completedAt: previous.completedAt,
      totalFindings: previous.findings.length,
    },
    changes: {
      scoreDelta,
      gradeChanged,
      gradeImproved: gradeChanged && isGradeImproved(previous.grade, current.grade),
      newFindings: {
        total: newFindings.length,
        bySeverity: newBySeverity,
        items: newFindings.map((f) => ({
          id: f.id,
          moduleId: f.moduleId,
          severity: f.severity,
          category: f.category,
          title: f.title,
          location: f.location,
        })),
      },
      fixedFindings: {
        total: fixedFindings.length,
        bySeverity: fixedBySeverity,
        items: fixedFindings.map((f) => ({
          id: f.id,
          moduleId: f.moduleId,
          severity: f.severity,
          category: f.category,
          title: f.title,
          location: f.location,
        })),
      },
      unchangedFindings: {
        total: unchangedFindings.length,
      },
    },
  };
}

function countBySeverity(findings: Array<{ severity: string }>) {
  return findings.reduce((acc, f) => {
    acc[f.severity] = (acc[f.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function isGradeImproved(prevGrade: string | null, currentGrade: string | null): boolean {
  const gradeOrder = ['F', 'D', 'C', 'B', 'A'];
  const prevIndex = prevGrade ? gradeOrder.indexOf(prevGrade) : -1;
  const currentIndex = currentGrade ? gradeOrder.indexOf(currentGrade) : -1;
  return currentIndex > prevIndex; // Higher index = better grade
}
