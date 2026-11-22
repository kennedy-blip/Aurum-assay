/**
 * sqlEngine.ts — Embedded declarative SQL executor persisted to IndexedDB.
 * Runs real SQL (SELECT / WHERE / JOIN / SUM / AVG / COUNT / GROUP BY /
 * ORDER BY / LIMIT) against the assay_schema.sql tables, 100% offline.
 */

export interface QueryResult {
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  ms: number;
}

type Row = Record<string, any>;

const DB_NAME = "aurum-assay-db";
const DB_VERSION = 1;
const STORES = ["bullion_specs", "assay_ledger", "horology_logs"] as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function getAll(store: string): Promise<Row[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, "readonly").objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result as Row[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

async function put(store: string, row: Row): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, "readwrite").objectStore(store).put(row);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

async function clearStore(store: string) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const req = db.transaction(store, "readwrite").objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Seed data (mirrors assay_schema.sql INSERT statements)
// ---------------------------------------------------------------------------

export const SEED_SPECS: Row[] = [
  { id: 1, item_name: "1 oz American Silver Eagle", metal: "Silver", purity_karat: 24, weight_g: 31.103, diameter_mm: 40.6, thickness_mm: 2.98, youngs_gpa: 82.7, poisson: 0.37, density: 10490, f20_hz: 3995, f30_hz: 8920, f01_hz: 11040, sustain_ms: 2150, melt_value_usd: 30.49 },
  { id: 2, item_name: "1 oz American Gold Eagle (22K)", metal: "Gold", purity_karat: 22, weight_g: 33.931, diameter_mm: 32.7, thickness_mm: 2.87, youngs_gpa: 79, poisson: 0.42, density: 19320, f20_hz: 3520, f30_hz: 7910, f01_hz: 9850, sustain_ms: 1680, melt_value_usd: 2437 },
  { id: 3, item_name: "1 oz Canadian Gold Maple Leaf", metal: "Gold", purity_karat: 24, weight_g: 31.103, diameter_mm: 30, thickness_mm: 2.87, youngs_gpa: 79, poisson: 0.42, density: 19320, f20_hz: 3610, f30_hz: 8120, f01_hz: 10120, sustain_ms: 1740, melt_value_usd: 2437 },
  { id: 4, item_name: "1 oz South African Krugerrand", metal: "Gold", purity_karat: 22, weight_g: 33.931, diameter_mm: 32.77, thickness_mm: 2.84, youngs_gpa: 79, poisson: 0.42, density: 19320, f20_hz: 3520, f30_hz: 7910, f01_hz: 9850, sustain_ms: 1620, melt_value_usd: 2437 },
  { id: 5, item_name: "1878-1921 Morgan Silver Dollar", metal: "Silver", purity_karat: 24, weight_g: 26.73, diameter_mm: 38.1, thickness_mm: 3.1, youngs_gpa: 82.7, poisson: 0.37, density: 10490, f20_hz: 3640, f30_hz: 8150, f01_hz: 10080, sustain_ms: 1980, melt_value_usd: 26.2 },
  { id: 6, item_name: "British Gold Sovereign", metal: "Gold", purity_karat: 22, weight_g: 7.988, diameter_mm: 22.05, thickness_mm: 1.52, youngs_gpa: 79, poisson: 0.42, density: 19320, f20_hz: 5480, f30_hz: 12100, f01_hz: 14900, sustain_ms: 940, melt_value_usd: 573.5 },
  { id: 7, item_name: "1 oz Platinum Eagle", metal: "Platinum", purity_karat: 24, weight_g: 31.103, diameter_mm: 32.7, thickness_mm: 2.87, youngs_gpa: 168, poisson: 0.39, density: 21450, f20_hz: 4410, f30_hz: 9890, f01_hz: 12310, sustain_ms: 1870, melt_value_usd: 969 },
  { id: 8, item_name: "1 oz American Silver Eagle (FAKE CuNi)", metal: "Silver", purity_karat: 24, weight_g: 31.103, diameter_mm: 40.6, thickness_mm: 2.98, youngs_gpa: 200, poisson: 0.34, density: 8900, f20_hz: 4480, f30_hz: 9980, f01_hz: 12410, sustain_ms: 520, melt_value_usd: 30.49 },
  { id: 9, item_name: "1 oz Gold Bar (Tungsten Core FAKE)", metal: "Gold", purity_karat: 24, weight_g: 31.103, diameter_mm: 30, thickness_mm: 2.87, youngs_gpa: 411, poisson: 0.28, density: 19320, f20_hz: 5640, f30_hz: 12650, f01_hz: 15720, sustain_ms: 610, melt_value_usd: 2437 },
  { id: 10, item_name: "1 oz Silver Bar (.999 Fine)", metal: "Silver", purity_karat: 24, weight_g: 31.103, diameter_mm: 40, thickness_mm: 3, youngs_gpa: 82.7, poisson: 0.37, density: 10490, f20_hz: 4020, f30_hz: 8990, f01_hz: 11120, sustain_ms: 2210, melt_value_usd: 30.49 },
];

export async function seedIfEmpty() {
  const specs = await getAll("bullion_specs");
  if (specs.length === 0) for (const s of SEED_SPECS) await put("bullion_specs", s);
}

// ---------------------------------------------------------------------------
// Minimal SQL parser: SELECT <cols|*|AGG(col) AS x> FROM t [JOIN u ON a=b]
//                     [WHERE c op v [AND ...]] [GROUP BY c] [ORDER BY c ASC|DESC] [LIMIT n]
// ---------------------------------------------------------------------------

function tokenize(sql: string): string[] {
  const out: string[] = [];
  const re = /'[^']*'|[A-Za-z_][\w.]*|\d+\.?\d*|>=|<=|!=|=|>|<|,|\(|\)|\*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) out.push(m[0]);
  return out;
}

function parseValue(tok: string): any {
  if (tok.startsWith("'")) return tok.slice(1, -1);
  const n = Number(tok);
  return isNaN(n) ? tok : n;
}

function compare(a: any, op: string, b: any): boolean {
  if (op === "=") return String(a) === String(b);
  if (op === "!=") return String(a) !== String(b);
  const x = Number(a), y = Number(b);
  if (op === ">") return x > y;
  if (op === "<") return x < y;
  if (op === ">=") return x >= y;
  if (op === "<=") return x <= y;
  return false;
}

export async function executeSQL(sql: string): Promise<QueryResult> {
  const t0 = performance.now();
  await seedIfEmpty();
  const clean = sql.replace(/;+\s*$/, "").trim();
  if (!/^SELECT\b/i.test(clean)) throw new Error("Only SELECT queries are supported in the forensic console.");
  const tokens = tokenize(clean);
  const upper = tokens.map((t) => t.toUpperCase());
  const idxOf = (kw: string, from = 0) => upper.indexOf(kw, from);

  // ---- SELECT list ----
  const fromIdx = idxOf("FROM");
  if (fromIdx < 0) throw new Error("Missing FROM clause.");
  const selectTokens = tokens.slice(1, fromIdx);
  const selectList = selectTokens.join(" ").split(",").map((s) => s.trim()).filter(Boolean);

  // ---- FROM / JOIN ----
  const fromTable = tokens[fromIdx + 1];
  if (!STORES.includes(fromTable as any)) throw new Error(`Unknown table "${fromTable}". Tables: ${STORES.join(", ")}`);
  let rows: Row[] = (await getAll(fromTable)).map((r) => ({ ...r }));
  const joinIdx = idxOf("JOIN");
  if (joinIdx >= 0) {
    const joinTable = tokens[joinIdx + 1];
    const onIdx = idxOf("ON", joinIdx);
    const [leftRef, , rightRef] = tokens.slice(onIdx + 1, onIdx + 4);
    const leftCol = leftRef.split(".").pop()!;
    const rightCol = rightRef.split(".").pop()!;
    const rightRows = await getAll(joinTable);
    const merged: Row[] = [];
    for (const l of rows) for (const r of rightRows) {
      if (String(l[leftCol]) === String(r[rightCol])) merged.push({ ...l, ...r });
    }
    rows = merged;
  }

  // ---- WHERE ----
  const whereIdx = idxOf("WHERE");
  const groupIdx = idxOf("GROUP");
  const orderIdx = idxOf("ORDER");
  const limitIdx = idxOf("LIMIT");
  if (whereIdx >= 0) {
    const end = [groupIdx, orderIdx, limitIdx].filter((i) => i > whereIdx).sort((a, b) => a - b)[0] ?? tokens.length;
    const condTokens = tokens.slice(whereIdx + 1, end);
    // split on AND
    const conds: string[][] = [[]];
    for (const t of condTokens) {
      if (t.toUpperCase() === "AND") conds.push([]);
      else conds[conds.length - 1].push(t);
    }
    rows = rows.filter((r) =>
      conds.every((c) => {
        if (c.length < 3) return true;
        const col = c[0].split(".").pop()!;
        return compare(r[col], c[1], parseValue(c[2]));
      })
    );
  }

  // ---- GROUP BY + aggregates ----
  const isAgg = (s: string) => /^(SUM|AVG|COUNT|MIN|MAX)\s*\(/i.test(s);
  let columns: string[] = [];
  let outRows: Row[] = [];
  if (groupIdx >= 0) {
    const gCol = tokens[groupIdx + 2].split(".").pop()!;
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      const k = String(r[gCol]);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
    for (const [k, grp] of groups) {
      const out: Row = { [gCol]: grp[0][gCol] };
      for (const sel of selectList) {
        const agg = sel.match(/^(SUM|AVG|COUNT|MIN|MAX)\s*\(\s*([\w.]+)\s*\)(?:\s+AS\s+(\w+))?$/i);
        if (agg) {
          const [, fn, colRaw, alias] = agg;
          const col = colRaw.split(".").pop()!;
          const vals = grp.map((r) => Number(r[col])).filter((v) => !isNaN(v));
          const name = alias || `${fn.toLowerCase()}(${col})`;
          out[name] =
            fn.toUpperCase() === "COUNT" ? grp.length
            : fn.toUpperCase() === "SUM" ? vals.reduce((a, b) => a + b, 0)
            : fn.toUpperCase() === "AVG" ? (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0)
            : fn.toUpperCase() === "MIN" ? Math.min(...vals)
            : Math.max(...vals);
        } else if (sel !== gCol && sel !== "*") {
          out[sel.split(".").pop()!] = grp[0][sel.split(".").pop()!];
        }
      }
      outRows.push(out);
    }
    columns = Object.keys(outRows[0] ?? { [gCol]: 0 });
  } else if (selectList.some(isAgg)) {
    const out: Row = {};
    for (const sel of selectList) {
      const agg = sel.match(/^(SUM|AVG|COUNT|MIN|MAX)\s*\(\s*([\w.]+)\s*\)(?:\s+AS\s+(\w+))?$/i);
      if (agg) {
        const [, fn, colRaw, alias] = agg;
        const col = colRaw.split(".").pop()!;
        const vals = rows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
        const name = alias || `${fn.toLowerCase()}(${col})`;
        out[name] =
          fn.toUpperCase() === "COUNT" ? rows.length
          : fn.toUpperCase() === "SUM" ? vals.reduce((a, b) => a + b, 0)
          : fn.toUpperCase() === "AVG" ? (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0)
          : fn.toUpperCase() === "MIN" ? Math.min(...vals)
          : Math.max(...vals);
      } else if (sel === "*") {
        Object.assign(out, rows[0] ?? {});
      } else {
        out[sel.split(".").pop()!] = rows[0]?.[sel.split(".").pop()!];
      }
    }
    outRows = [out];
    columns = Object.keys(out);
  } else {
    if (selectList.includes("*")) {
      outRows = rows;
      columns = rows.length ? Object.keys(rows[0]) : [];
    } else {
      columns = selectList.map((s) => s.split(".").pop()!);
      outRows = rows.map((r) => {
        const o: Row = {};
        for (const c of columns) o[c] = r[c];
        return o;
      });
    }
  }

  // ---- ORDER BY ----
  if (orderIdx >= 0) {
    const col = tokens[orderIdx + 2].split(".").pop()!;
    const dir = (tokens[orderIdx + 3] ?? "ASC").toUpperCase() === "DESC" ? -1 : 1;
    outRows = [...outRows].sort((a, b) => {
      const x = a[col], y = b[col];
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
      return String(x).localeCompare(String(y)) * dir;
    });
  }

  // ---- LIMIT ----
  if (limitIdx >= 0) {
    const n = Number(tokens[limitIdx + 1]);
    if (!isNaN(n)) outRows = outRows.slice(0, n);
  }

  return { columns, rows: outRows, rowCount: outRows.length, ms: Math.round((performance.now() - t0) * 10) / 10 };
}

// ---------------------------------------------------------------------------
// Ledger writes, exports & offline→online sync queue
// ---------------------------------------------------------------------------

export async function insertLedger(entry: Partial<Row>): Promise<number> {
  await seedIfEmpty();
  const row: Row = {
    item_name: entry.item_name ?? "Unnamed item",
    purity_karat: entry.purity_karat ?? null,
    weight_g: entry.weight_g ?? null,
    melt_value_usd: entry.melt_value_usd ?? 0,
    verdict: entry.verdict ?? "SUSPECT",
    score_pct: entry.score_pct ?? null,
    sg_measured: entry.sg_measured ?? null,
    module: entry.module ?? "acoustic",
    created_at: new Date().toISOString(),
    synced: 0,
  };
  const id = await put("assay_ledger", row);
  queueSync({ type: "assay_ledger", id, row });
  return id;
}

export async function insertHorology(entry: Partial<Row>): Promise<number> {
  await seedIfEmpty();
  const row: Row = {
    movement: entry.movement ?? "Unknown",
    bph: entry.bph ?? 0,
    drift_s_day: entry.drift_s_day ?? 0,
    beat_error_ms: entry.beat_error_ms ?? 0,
    amplitude_deg: entry.amplitude_deg ?? 0,
    verdict: entry.verdict ?? "SUSPECT",
    created_at: new Date().toISOString(),
    synced: 0,
  };
  const id = await put("horology_logs", row);
  queueSync({ type: "horology_logs", id, row });
  return id;
}

const SYNC_KEY = "aurum-sync-queue";
export function queueSync(item: any) {
  try {
    const q = JSON.parse(localStorage.getItem(SYNC_KEY) ?? "[]");
    q.push({ ...item, queuedAt: new Date().toISOString() });
    localStorage.setItem(SYNC_KEY, JSON.stringify(q));
  } catch { /* storage unavailable */ }
}
export function syncQueue(): any[] {
  try { return JSON.parse(localStorage.getItem(SYNC_KEY) ?? "[]"); } catch { return []; }
}
export async function flushSyncQueue(): Promise<number> {
  const q = syncQueue();
  if (!q.length) return 0;
  // Simulated cloud endpoint — in production POST to your Supabase/Vercel API.
  await new Promise((r) => setTimeout(r, 400));
  localStorage.setItem(SYNC_KEY, "[]");
  return q.length;
}

export async function exportTable(store: string, format: "csv" | "json"): Promise<string> {
  const rows = await getAll(store);
  if (format === "json") return JSON.stringify(rows, null, 2);
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function resetDatabase() {
  for (const s of STORES) await clearStore(s);
  await seedIfEmpty();
}
