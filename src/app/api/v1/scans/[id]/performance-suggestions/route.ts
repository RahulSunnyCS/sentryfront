/**
 * GET /api/v1/scans/:id/performance-suggestions
 * 
 * Returns AI-ready performance improvement suggestions for a completed scan.
 * This endpoint analyzes performance findings and generates:
 * - Prioritized action plan
 * - AI prompts for automated fixes
 * - Quick wins vs. major improvements
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateImprovementPlan } from '@/lib/scanner/performance-suggestions';
import type { RawFinding } from '@/lib/scanner/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const scan = await prisma.scan.findUnique({
    where: { id: params.id },
    include: { findings: true },
  });

  if (!scan) {
    return NextResponse.json({ error: 'Scan not found.' }, { status: 404 });
  }

  if (scan.status !== 'COMPLETED') {
    return NextResponse.json(
      { error: 'Scan is not yet complete.' },
      { status: 409 }
    );
  }

  // Check if performance data exists.
  //
  // IMPORTANT: we use explicit null/undefined checks here instead of a simple
  // falsy guard (`!scan.performanceScore`). A real worst-performing site can
  // legitimately score 0, which is falsy but is NOT the same as "no data".
  // A null performanceScore means the provider was unavailable (scoreSource
  // 'unavailable') — that is the only case we should 404.
  //
  // `== null` covers both null and undefined without requiring two comparisons.
  if (
    scan.performanceGrade == null ||
    scan.performanceScore == null ||
    scan.performanceMetrics == null
  ) {
    return NextResponse.json({
      error: 'No performance data available for this scan.',
      hint: 'Performance scanning may be disabled or may have failed. Check scan logs.',
    }, { status: 404 });
  }

  // Parse performance metrics
  const metrics = JSON.parse(scan.performanceMetrics);
  
  // Get performance findings (P2-xx modules)
  const performanceFindings: RawFinding[] = scan.findings
    .filter((f) => f.moduleId.startsWith('P2-'))
    .map((f) => ({
      moduleId: f.moduleId,
      severity: f.severity as 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO',
      category: f.category,
      title: f.title,
      location: f.location,
      evidence: f.evidence,
      explanation: f.explanation,
      impact: f.impact,
      fixManual: JSON.parse(f.fixManual) as string[],
      fixAiPrompt: f.fixAiPrompt,
    }));

  // Generate improvement plan
  const plan = generateImprovementPlan(
    performanceFindings,
    metrics,
    scan.performanceGrade,
    scan.performanceScore
  );

  return NextResponse.json({
    scanId: scan.id,
    targetUrl: scan.targetUrl,
    performanceGrade: scan.performanceGrade,
    performanceScore: scan.performanceScore,
    summary: plan.summary,
    quickWins: plan.quickWins,
    majorImprovements: plan.majorImprovements,
    optimizations: plan.optimizations,
    aiPromptBundle: plan.aiPromptBundle, // Single prompt for AI assistants
    meta: {
      totalSuggestions: plan.quickWins.length + plan.majorImprovements.length + plan.optimizations.length,
      quickWinsCount: plan.quickWins.length,
      majorImprovementsCount: plan.majorImprovements.length,
      optimizationsCount: plan.optimizations.length,
    },
  });
}
