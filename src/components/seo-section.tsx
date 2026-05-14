/**
 * SEO Section Component
 * Phase 7.5: SEO Scanning
 *
 * Summary-only panel. Per-finding cards live in the unified findings list
 * inside the Security tab's All view (grouped under the SEO category).
 */

import { SEOGrade } from './seo-grade';

interface SEOSectionProps {
  seoGrade: string;
  seoScore: number;
  seoMetrics: {
    issues: unknown[];
  };
}

export function SEOSection({ seoGrade, seoScore, seoMetrics }: SEOSectionProps) {
  const issueCount = seoMetrics.issues.length;

  const gradeMessages: Record<string, string> = {
    A: 'Excellent! Your site follows SEO best practices and is well-optimized for search engines.',
    B: 'Good SEO! Minor improvements could increase search visibility.',
    C: 'Fair SEO. Several optimizations needed to improve search rankings.',
    D: 'Poor SEO. Critical issues are preventing optimal search engine visibility.',
    F: 'Failing SEO. Major issues need immediate attention to appear in search results.',
  };

  return (
    <section>
      <h2 className="text-2xl font-bold mb-4">SEO Analysis</h2>

      <SEOGrade grade={seoGrade} score={seoScore} />

      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-700">
          {gradeMessages[seoGrade] || gradeMessages.F}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-600">Lighthouse Score</div>
          <div className="text-2xl font-bold text-gray-900">{seoScore}/100</div>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-600">Total Issues</div>
          <div className="text-2xl font-bold text-gray-900">{issueCount}</div>
        </div>
        <div className="p-4 bg-white border border-gray-200 rounded-lg">
          <div className="text-sm text-gray-600">Categories Checked</div>
          <div className="text-2xl font-bold text-gray-900">5/5</div>
        </div>
      </div>

      {issueCount === 0 ? (
        <div className="mt-6 p-6 bg-green-50 border border-green-200 rounded-lg text-center">
          <div className="text-green-700 font-semibold mb-2">No SEO issues detected</div>
          <div className="text-sm text-green-600">
            Your site is well-optimized for search engines. Continue monitoring SEO metrics regularly.
          </div>
        </div>
      ) : (
        <p className="mt-6 text-xs text-gray-500">
          Specific SEO findings appear in the Security tab&apos;s All view under the SEO category.
        </p>
      )}
    </section>
  );
}
