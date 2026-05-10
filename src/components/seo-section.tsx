/**
 * SEO Section Component
 * Phase 7.5: SEO Scanning
 * 
 * Main orchestrator for SEO results display
 * Shows grade, metrics, and categorized issues
 */

import { SEOGrade } from './seo-grade';
import type { Finding } from '@/types';

interface SEOSectionProps {
  seoGrade: string;
  seoScore: number;
  seoMetrics: {
    issues: unknown[];
  };
  findings: Finding[];
}

// Map module IDs to user-friendly category names
const categoryNames: Record<string, string> = {
  'P4-01': 'Meta Tags & Titles',
  'P4-02': 'Social Media (Open Graph & Twitter)',
  'P4-03': 'Structured Data (Schema.org)',
  'P4-04': 'Crawlability & Indexing',
  'P4-05': 'Mobile SEO & Core Web Vitals',
};

// Severity badge colors
const severityColors: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-800 border-red-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  LOW: 'bg-blue-100 text-blue-800 border-blue-200',
  INFO: 'bg-green-100 text-green-800 border-green-200',
};

export function SEOSection({ seoGrade, seoScore, findings }: SEOSectionProps) {
  // Filter SEO findings (P4-xx modules)
  const seoFindings = findings.filter(f => f.module.startsWith('P4-'));

  // Group findings by module
  const findingsByModule: Record<string, Finding[]> = {};
  seoFindings.forEach(finding => {
    if (!findingsByModule[finding.module]) {
      findingsByModule[finding.module] = [];
    }
    findingsByModule[finding.module].push(finding);
  });

  // Grade messaging
  const gradeMessages: Record<string, string> = {
    A: 'Excellent! Your site follows SEO best practices and is well-optimized for search engines.',
    B: 'Good SEO! Minor improvements could increase search visibility.',
    C: 'Fair SEO. Several optimizations needed to improve search rankings.',
    D: 'Poor SEO. Critical issues are preventing optimal search engine visibility.',
    F: 'Failing SEO. Major issues need immediate attention to appear in search results.',
  };

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-4">SEO Analysis</h2>
      
      {/* Grade display */}
      <SEOGrade grade={seoGrade} score={seoScore} />

      {/* Grade explanation */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-700">
          {gradeMessages[seoGrade] || gradeMessages.F}
        </p>
      </div>

      {/* SEO metrics summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-600">Lighthouse Score</div>
          <div className="text-2xl font-bold text-gray-900">{seoScore}/100</div>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-600">Total Issues</div>
          <div className="text-2xl font-bold text-gray-900">{seoFindings.length}</div>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-600">Categories Checked</div>
          <div className="text-2xl font-bold text-gray-900">{Object.keys(findingsByModule).length}/5</div>
        </div>
      </div>

      {/* SEO findings by category */}
      {Object.keys(findingsByModule).length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">SEO Issues by Category</h3>
          
          {Object.entries(findingsByModule).map(([moduleId, moduleFindings]) => (
            <div key={moduleId} className="mb-6 border border-gray-200 rounded-lg p-4 bg-white">
              <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <span className="text-blue-600">{categoryNames[moduleId] || moduleId}</span>
                <span className="text-sm font-normal text-gray-500">
                  ({moduleFindings.length} issue{moduleFindings.length !== 1 ? 's' : ''})
                </span>
              </h4>

              <div className="space-y-4">
                {moduleFindings.map((finding, idx) => (
                  <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h5 className="font-medium text-gray-900">{finding.title}</h5>
                      <span className={`px-2 py-1 text-xs font-semibold border rounded ${severityColors[finding.severity]}`}>
                        {finding.severity}
                      </span>
                    </div>
                    
                    {finding.evidence && (
                      <div className="text-sm text-gray-600 mb-2">
                        <strong>Evidence:</strong> {finding.evidence}
                      </div>
                    )}

                    <div className="text-sm text-gray-700 mb-2">
                      {finding.explanation}
                    </div>

                    <div className="text-sm text-gray-600">
                      <strong>Impact:</strong> {finding.impact}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No issues */}
      {seoFindings.length === 0 && (
        <div className="mt-6 p-6 bg-green-50 border border-green-200 rounded-lg text-center">
          <div className="text-green-700 font-semibold mb-2">✓ No SEO Issues Detected</div>
          <div className="text-sm text-green-600">
            Your site is well-optimized for search engines. Continue monitoring SEO metrics regularly.
          </div>
        </div>
      )}
    </section>
  );
}
