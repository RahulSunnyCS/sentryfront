/**
 * SEO Grade Component
 * Phase 7.5: SEO Scanning
 * 
 * Displays SEO grade (A-F) in a colored ring with Lighthouse score
 */

interface SEOGradeProps {
  grade: string; // A-F
  score: number; // 0-100
}

const gradeColors: Record<string, { ring: string; text: string; bg: string }> = {
  A: { ring: 'stroke-green-500', text: 'text-green-700', bg: 'bg-green-50' },
  B: { ring: 'stroke-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
  C: { ring: 'stroke-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50' },
  D: { ring: 'stroke-orange-500', text: 'text-orange-700', bg: 'bg-orange-50' },
  F: { ring: 'stroke-red-600', text: 'text-red-700', bg: 'bg-red-50' },
};

export function SEOGrade({ grade, score }: SEOGradeProps) {
  const colors = gradeColors[grade] || gradeColors.F;
  const circumference = 2 * Math.PI * 45; // radius = 45
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg ${colors.bg}`}>
      {/* Ring display */}
      <div className="relative w-24 h-24">
        <svg className="transform -rotate-90 w-24 h-24">
          {/* Background ring */}
          <circle
            cx="48"
            cy="48"
            r="45"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-gray-200"
          />
          {/* Progress ring */}
          <circle
            cx="48"
            cy="48"
            r="45"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={colors.ring}
          />
        </svg>
        {/* Grade letter */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-3xl font-bold ${colors.text}`}>{grade}</span>
        </div>
      </div>

      {/* Text info */}
      <div>
        <div className="text-sm font-medium text-gray-600">SEO</div>
        <div className={`text-2xl font-bold ${colors.text}`}>{score}/100</div>
        <div className="text-xs text-gray-500 mt-1">Lighthouse Score</div>
      </div>
    </div>
  );
}
