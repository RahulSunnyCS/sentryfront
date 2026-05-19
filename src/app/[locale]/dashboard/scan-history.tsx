'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScanListItem, ScanListResult, SortOption } from '@/lib/dashboard-queries';
import { ScanTable } from './scan-table';
import { ScanCardList } from './scan-card-list';

interface Labels {
  scanHistory: string;
  searchPlaceholder: string;
  filterGrade: string;
  filterStatus: string;
  filterAll: string;
  sortDateDesc: string;
  sortDateAsc: string;
  sortGrade: string;
  sortIssues: string;
  loadMore: string;
  colSite: string;
  colGrade: string;
  colIssues: string;
  colScanned: string;
  colReport: string;
  colActions: string;
  critical: string;
  high: string;
  medium: string;
  view: string;
  rescan: string;
  rescanError: string;
  justNow: string;
  minutesAgo: string;
  hoursAgo: string;
  yesterday: string;
  daysAgo: string;
  emptyTitle: string;
  emptyDesc: string;
  loadError: string;
  statusCompleted: string;
  statusRunning: string;
  statusFailed: string;
}

interface Props {
  initialItems: ScanListItem[];
  initialCursor: string | null;
  initialHasMore: boolean;
  locale: string;
  labels: Labels;
}

const SORT_OPTIONS: { value: SortOption; label: keyof Labels }[] = [
  { value: 'date-desc', label: 'sortDateDesc' },
  { value: 'date-asc', label: 'sortDateAsc' },
  { value: 'grade', label: 'sortGrade' },
  { value: 'issues', label: 'sortIssues' },
];

const GRADE_OPTIONS = ['A', 'B', 'C', 'D', 'F'];

const inputStyle: React.CSSProperties = {
  height: 34,
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 'var(--fs-sm)',
  padding: '0 10px',
  outline: 'none',
};

export function ScanHistory({ initialItems, initialCursor, initialHasMore, locale, labels }: Props) {
  const [items, setItems] = useState<ScanListItem[]>(initialItems);
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<SortOption>('date-desc');

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const buildUrl = useCallback(
    (opts: { cursor?: string; offset?: number; searchVal?: string; gradeVal?: string; statusVal?: string; sortVal?: SortOption }) => {
      const p = new URLSearchParams();
      if (opts.sortVal && opts.sortVal !== 'date-desc') p.set('sort', opts.sortVal);
      if (opts.searchVal) p.set('search', opts.searchVal);
      if (opts.gradeVal) p.set('grade', opts.gradeVal);
      if (opts.statusVal) p.set('status', opts.statusVal);
      if (opts.cursor) p.set('cursor', opts.cursor);
      if (opts.offset !== undefined) p.set('offset', String(opts.offset));
      return `/api/v1/scans?${p.toString()}`;
    },
    [],
  );

  const fetchScans = useCallback(
    async (opts: { searchVal: string; gradeVal: string; statusVal: string; sortVal: SortOption }) => {
      setLoading(true);
      setError(null);
      try {
        const url = buildUrl({ ...opts });
        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch failed');
        const data = (await res.json()) as ScanListResult;
        setItems(data.items);
        setNextCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch {
        setError(labels.loadError);
      } finally {
        setLoading(false);
      }
    },
    [buildUrl, labels.loadError],
  );

  // Refetch when sort/grade/status change immediately
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    void fetchScans({ searchVal: search, gradeVal: grade, statusVal: status, sortVal: sort });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, grade, status]);

  // Debounce search input
  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      void fetchScans({ searchVal: val, gradeVal: grade, statusVal: status, sortVal: sort });
    }, 300);
  };

  const handleSortChange = (s: SortOption) => {
    setSort(s);
  };

  const handleLoadMore = async () => {
    setLoadMoreLoading(true);
    try {
      const url =
        sort === 'date-desc' && nextCursor
          ? buildUrl({ cursor: nextCursor, searchVal: search, gradeVal: grade, statusVal: status, sortVal: sort })
          : buildUrl({ offset: items.length, searchVal: search, gradeVal: grade, statusVal: status, sortVal: sort });
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const data = (await res.json()) as ScanListResult;
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      setError(labels.loadError);
    } finally {
      setLoadMoreLoading(false);
    }
  };

  return (
    <section data-testid="scan-history" aria-labelledby="scan-history-heading">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <h2 id="scan-history-heading" className="text-h3" style={{ margin: 0 }}>
          {labels.scanHistory}
        </h2>
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-4)',
        }}
      >
        <input
          type="search"
          data-testid="scan-history-search"
          placeholder={labels.searchPlaceholder}
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          style={{ ...inputStyle, flex: '1 1 180px', minWidth: 140 }}
          aria-label={labels.searchPlaceholder}
        />
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          style={{ ...inputStyle, paddingRight: 28 }}
          aria-label={labels.filterGrade}
        >
          <option value="">{labels.filterGrade}: {labels.filterAll}</option>
          {GRADE_OPTIONS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ ...inputStyle, paddingRight: 28 }}
          aria-label={labels.filterStatus}
        >
          <option value="">{labels.filterStatus}: {labels.filterAll}</option>
          <option value="COMPLETED">{labels.statusCompleted}</option>
          <option value="RUNNING">{labels.statusRunning}</option>
          <option value="FAILED">{labels.statusFailed}</option>
        </select>
        <select
          value={sort}
          onChange={(e) => handleSortChange(e.target.value as SortOption)}
          style={{ ...inputStyle, paddingRight: 28 }}
          aria-label="Sort"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {labels[o.label]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            background: 'rgba(220,38,38,0.08)',
            border: '1px solid rgba(220,38,38,0.25)',
            color: '#DC2626',
            padding: 'var(--space-4) var(--space-5)',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)',
          }}
        >
          {error}
        </div>
      )}

      {loading && (
        <div style={{ padding: 'var(--space-10)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          …
        </div>
      )}

      {!loading && items.length === 0 && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-10) var(--space-6)',
            textAlign: 'center',
          }}
        >
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{labels.emptyDesc}</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <ScanTable items={items} sort={sort} onSort={handleSortChange} locale={locale} labels={labels} />
          <ScanCardList items={items} locale={locale} labels={labels} />
        </>
      )}

      {hasMore && !loading && (
        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)' }}>
          <button
            type="button"
            data-testid="scan-history-load-more"
            onClick={handleLoadMore}
            disabled={loadMoreLoading}
            style={{
              padding: '9px 20px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              cursor: loadMoreLoading ? 'not-allowed' : 'pointer',
              opacity: loadMoreLoading ? 0.6 : 1,
            }}
          >
            {loadMoreLoading ? '…' : labels.loadMore}
          </button>
        </div>
      )}
    </section>
  );
}
