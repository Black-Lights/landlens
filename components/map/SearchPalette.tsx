'use client';

// Command-palette style search modal. Opens on Cmd/Ctrl+K or when the map's
// search button is clicked. Talks to /api/search, groups results by type,
// supports keyboard nav. Recent searches are persisted in localStorage.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  X,
  Map as MapIcon,
  Building2,
  Trees,
  Hash,
  User,
  Loader2,
  History,
} from 'lucide-react';
import { clsx } from 'clsx';

import type { SearchResult } from '@/app/api/search/route';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (result: SearchResult) => void;
};

const RECENTS_KEY = 'landlens:recentSearches';
const RECENTS_MAX = 8;
const TYPE_ORDER: SearchResult['type'][] = ['state', 'district', 'village', 'khasra', 'owner'];

const TYPE_META: Record<SearchResult['type'], { label: string; Icon: typeof Search }> = {
  state:    { label: 'States',     Icon: MapIcon },
  district: { label: 'Districts',  Icon: Building2 },
  village:  { label: 'Villages',   Icon: Trees },
  khasra:   { label: 'Khasra Nos', Icon: Hash },
  owner:    { label: 'Owners',     Icon: User },
};

interface RecentEntry {
  query: string;
  result: SearchResult;
  at: number;
}

function loadRecents(): RecentEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, RECENTS_MAX) : [];
  } catch {
    return [];
  }
}

function saveRecent(entry: RecentEntry) {
  if (typeof window === 'undefined') return;
  try {
    const current = loadRecents().filter(
      (r) => !(r.result.type === entry.result.type && r.result.id === entry.result.id),
    );
    const next = [entry, ...current].slice(0, RECENTS_MAX);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* localStorage may be full or blocked — silently ignore */
  }
}

export function SearchPalette({ open, onClose, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  // Focus input when opened; reset state when closed.
  useEffect(() => {
    if (open) {
      setRecents(loadRecents());
      // RAF so the input is mounted before we focus.
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery('');
      setDebounced('');
      setResults([]);
      setError(null);
      setActiveIdx(0);
    }
  }, [open]);

  // Debounce input → debounced query.
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(handle);
  }, [query]);

  // Fire search when debounced query changes.
  useEffect(() => {
    if (!open) return;
    if (debounced.length === 0) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/search?q=${encodeURIComponent(debounced)}&limit=20`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: { message?: string } };
          throw new Error(body?.error?.message ?? `Search failed (${r.status})`);
        }
        return r.json() as Promise<{ query: string; results: SearchResult[] }>;
      })
      .then((data) => {
        setResults(data.results);
        setActiveIdx(0);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setResults([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [debounced, open]);

  // Items that the keyboard cursor walks through. When the input is empty we
  // step through recents; otherwise through search results.
  const items = useMemo<SearchResult[]>(() => {
    if (debounced.length === 0) return recents.map((r) => r.result);
    return results;
  }, [debounced, recents, results]);

  // Reset cursor when the item list changes.
  useEffect(() => {
    setActiveIdx(0);
  }, [items.length]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      saveRecent({ query: debounced || result.label, result, at: Date.now() });
      onSelect(result);
      onClose();
    },
    [debounced, onClose, onSelect],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[activeIdx];
        if (item) handleSelect(item);
      }
    },
    [activeIdx, items, handleSelect, onClose],
  );

  // Keep the active item scrolled into view.
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-result-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open) return null;

  // Group search results by type, preserving the overall score-DESC order
  // within each group.
  const grouped = TYPE_ORDER.map((t) => ({
    type: t,
    items: results.filter((r) => r.type === t),
  })).filter((g) => g.items.length > 0);

  // Build a flat index for keyboard nav. The DOM index of each item must
  // match its position in `items` so ArrowUp/Down lines up.
  const flatIndex = (() => {
    const map = new Map<string, number>();
    let i = 0;
    for (const g of grouped) {
      for (const r of g.items) {
        map.set(`${r.type}:${r.id}`, i++);
      }
    }
    return map;
  })();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search states, districts, villages, khasra, owners…"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden />}
          <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 sm:inline-block">
            esc
          </kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="-mr-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 sm:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-1">
          {/* Empty input → recents */}
          {debounced.length === 0 && recents.length > 0 && (
            <Section title="Recent" icon={History}>
              {recents.map((r, i) => (
                <ResultRow
                  key={`recent-${r.result.type}-${r.result.id}-${r.at}`}
                  result={r.result}
                  active={i === activeIdx}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => handleSelect(r.result)}
                  domIndex={i}
                />
              ))}
            </Section>
          )}

          {debounced.length === 0 && recents.length === 0 && (
            <EmptyHint>
              Try <em className="font-mono not-italic text-slate-700">Pune</em>,{' '}
              <em className="font-mono not-italic text-slate-700">Maharashtra</em>, or a khasra
              number.
            </EmptyHint>
          )}

          {/* Active query, still fetching */}
          {debounced.length > 0 && loading && results.length === 0 && (
            <div className="space-y-2 p-3">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mx-3 my-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </div>
          )}

          {/* Results */}
          {debounced.length > 0 && !loading && results.length === 0 && !error && (
            <EmptyHint>
              No results for{' '}
              <span className="font-medium text-slate-700">&ldquo;{debounced}&rdquo;</span>.
            </EmptyHint>
          )}

          {grouped.map((g) => {
            const meta = TYPE_META[g.type];
            return (
              <Section key={g.type} title={meta.label} icon={meta.Icon}>
                {g.items.map((r) => {
                  const idx = flatIndex.get(`${r.type}:${r.id}`) ?? 0;
                  return (
                    <ResultRow
                      key={`${r.type}-${r.id}`}
                      result={r}
                      active={idx === activeIdx}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => handleSelect(r)}
                      domIndex={idx}
                    />
                  );
                })}
              </Section>
            );
          })}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <KbdHint k="↑↓">navigate</KbdHint>
            <KbdHint k="↵">open</KbdHint>
            <KbdHint k="esc">close</KbdHint>
          </div>
          <span>powered by pg_trgm</span>
        </footer>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Search;
  children: React.ReactNode;
}) {
  return (
    <div className="px-1 pb-1 pt-2">
      <div className="flex items-center gap-1.5 px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        <Icon className="h-3 w-3" aria-hidden />
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ResultRow({
  result,
  active,
  onMouseEnter,
  onClick,
  domIndex,
}: {
  result: SearchResult;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  domIndex: number;
}) {
  const { Icon } = TYPE_META[result.type];
  return (
    <button
      type="button"
      data-result-idx={domIndex}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left',
        active ? 'bg-indigo-50' : 'hover:bg-slate-50',
      )}
    >
      <span
        className={clsx(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1',
          active ? 'bg-indigo-100 text-indigo-700 ring-indigo-200' : 'bg-slate-100 text-slate-500 ring-slate-200',
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-slate-900">{result.label}</span>
        {result.sublabel && (
          <span className="block truncate text-xs text-slate-500">{result.sublabel}</span>
        )}
      </span>
      <span className="ml-2 hidden shrink-0 text-[10px] uppercase tracking-wider text-slate-400 sm:inline">
        {result.type}
      </span>
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-md px-3 py-2">
      <span className="h-7 w-7 shrink-0 animate-pulse rounded-md bg-slate-100" />
      <span className="flex-1 space-y-1.5">
        <span className="block h-3 w-1/2 animate-pulse rounded bg-slate-100" />
        <span className="block h-2.5 w-1/3 animate-pulse rounded bg-slate-100" />
      </span>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-6 text-center text-sm text-slate-500">{children}</div>;
}

function KbdHint({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5 font-mono text-[10px] text-slate-600">
        {k}
      </kbd>
      <span>{children}</span>
    </span>
  );
}
