// VibeSafe — Report + Finding Detail

// === Finding Card ===
function FindingCard({ finding, isExpanded, onToggle, cardStyle }) {
  const sevConfig = SEVERITY_CONFIG[finding.severity];
  const [fixTab, setFixTab] = React.useState('manual');

  const cardBorder = cardStyle === 'bordered' ? `1px solid ${sevConfig.border}` : '1px solid var(--border)';
  const cardShadow = cardStyle === 'elevated' ? 'var(--shadow-md)' : 'none';
  const cardBg = cardStyle === 'flat' ? 'var(--bg)' : 'var(--surface)';

  return (
    <div style={{
      borderRadius: 12, border: cardBorder, backgroundColor: cardBg,
      boxShadow: cardShadow, overflow: 'hidden', transition: 'all 0.2s',
    }}>
      {/* Header — always visible */}
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px', border: 'none', background: 'none', cursor: 'pointer',
        textAlign: 'left', fontFamily: 'var(--font)',
      }}>
        <SeverityBadge severity={finding.severity} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
            {finding.title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, fontFamily: 'var(--mono)' }}>
            {finding.location}
          </div>
        </div>
        <Icons.ChevronDown size={18} color="var(--text-tertiary)" style={{
          transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
          flexShrink: 0,
        }} />
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div style={{
          padding: '0 16px 20px', borderTop: '1px solid var(--border-light)',
        }}>
          {/* Explanation */}
          <div style={{ marginTop: 16 }}>
            <div style={findingSectionTitle}>What this means</div>
            <p style={findingText}>{finding.explanation}</p>
          </div>

          {/* Evidence */}
          <div style={{ marginTop: 16 }}>
            <div style={findingSectionTitle}>Evidence</div>
            <pre style={{
              backgroundColor: '#1a1a2e', color: '#e2e8f0', padding: '14px 16px',
              borderRadius: 8, fontSize: 12.5, lineHeight: 1.6, overflowX: 'auto',
              fontFamily: 'var(--mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>{finding.evidence}</pre>
          </div>

          {/* Impact */}
          <div style={{ marginTop: 16 }}>
            <div style={findingSectionTitle}>Impact</div>
            <p style={findingText}>{finding.impact}</p>
          </div>

          {/* Fix section with tabs */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={findingSectionTitle}>How to fix</div>
              <div style={{ display: 'flex', gap: 2, backgroundColor: 'var(--border-light)', borderRadius: 8, padding: 2 }}>
                {['manual', 'ai'].map(tab => (
                  <button key={tab} onClick={() => setFixTab(tab)} style={{
                    padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, fontFamily: 'var(--font)',
                    backgroundColor: fixTab === tab ? 'var(--surface)' : 'transparent',
                    color: fixTab === tab ? 'var(--text)' : 'var(--text-tertiary)',
                    boxShadow: fixTab === tab ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.15s',
                  }}>
                    {tab === 'manual' ? 'Manual steps' : 'AI prompt'}
                  </button>
                ))}
              </div>
            </div>

            {fixTab === 'manual' ? (
              <ol style={{ paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {finding.fixManual.map((step, i) => (
                  <li key={i} style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{step}</li>
                ))}
              </ol>
            ) : (
              <div>
                <div style={{
                  backgroundColor: 'var(--accent-light)', border: '1px solid var(--accent)',
                  borderRadius: 8, padding: '14px 16px', fontSize: 13, lineHeight: 1.6,
                  color: 'var(--text)', marginBottom: 10, opacity: 0.9,
                  fontFamily: 'var(--mono)', whiteSpace: 'pre-wrap',
                }}>
                  {finding.fixAiPrompt}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CopyButton text={finding.fixAiPrompt} label="Copy prompt" />
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Paste into Cursor, Lovable, or Bolt
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const findingSectionTitle = {
  fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8,
};
const findingText = {
  fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0,
};

window.FindingCard = FindingCard;


// === Report Page ===
function ReportPage({ scanData, gradeStyle, cardStyle, onNewScan }) {
  const [expandedId, setExpandedId] = React.useState(null);
  const [filterSeverity, setFilterSeverity] = React.useState('ALL');

  const GradeComponent = gradeStyle === 'shield' ? GradeShield
    : gradeStyle === 'letter' ? GradeLetter : GradeRing;

  const gradeConfig = GRADE_CONFIG[scanData.grade];
  const findings = filterSeverity === 'ALL'
    ? scanData.findings
    : scanData.findings.filter(f => f.severity === filterSeverity);

  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
  const sortedFindings = [...findings].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );

  return (
    <div style={{ minHeight: '100vh', padding: '24px 24px 80px' }} className="screen-enter">
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Header Card */}
        <div style={{
          backgroundColor: 'var(--surface)', borderRadius: 16,
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
          padding: '32px', marginBottom: 28, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 32,
            flexWrap: 'wrap', justifyContent: 'center',
          }}>
            <GradeComponent grade={scanData.grade} size={140} />
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Icons.Globe size={16} color="var(--text-tertiary)" />
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{scanData.url}</span>
              </div>
              <div style={{
                display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 16,
                flexWrap: 'wrap',
              }}>
                <span>{scanData.stack}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Icons.Clock size={12} /> {scanData.duration}
                </span>
                <span>{scanData.date}</span>
              </div>
              <SeveritySummary summary={scanData.summary} />
            </div>
          </div>

          {/* Executive summary */}
          <div style={{
            marginTop: 24, padding: '14px 16px', borderRadius: 10,
            backgroundColor: gradeConfig.bg, border: `1px solid ${gradeConfig.color}20`,
          }}>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {scanData.grade === 'D' || scanData.grade === 'F' ? (
                <>This site has <strong style={{ color: 'var(--text)' }}>critical security issues</strong> that need immediate attention. Exposed secrets and misconfigured access controls put user data and finances at risk.</>
              ) : scanData.grade === 'C' ? (
                <>This site has some security gaps that should be addressed. While no critical issues were found, the medium-severity findings reduce your overall security posture.</>
              ) : (
                <>This site has a <strong style={{ color: 'var(--text)' }}>solid security posture</strong>. The remaining findings are minor improvements that would further harden your site.</>
              )}
            </p>
          </div>
        </div>

        {/* Findings section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
            Findings ({sortedFindings.length})
          </h2>
          {/* Filter pills */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {['ALL', ...severityOrder.filter(s => scanData.summary[s] > 0)].map(sev => (
              <button key={sev} onClick={() => setFilterSeverity(sev)} style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)',
                cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font)',
                backgroundColor: filterSeverity === sev ? 'var(--text)' : 'var(--surface)',
                color: filterSeverity === sev ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s', textTransform: sev === 'ALL' ? 'none' : 'capitalize',
              }}>
                {sev === 'ALL' ? 'All' : sev.toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Finding cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sortedFindings.map(finding => (
            <FindingCard
              key={finding.id}
              finding={finding}
              isExpanded={expandedId === finding.id}
              onToggle={() => setExpandedId(expandedId === finding.id ? null : finding.id)}
              cardStyle={cardStyle}
            />
          ))}
        </div>

        {sortedFindings.length === 0 && (
          <div style={{
            textAlign: 'center', padding: 48, color: 'var(--text-tertiary)', fontSize: 14,
          }}>
            No findings match this filter.
          </div>
        )}
      </div>
    </div>
  );
}
window.ReportPage = ReportPage;
