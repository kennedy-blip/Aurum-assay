-- ============================================================================
-- AURUM-ASSAY · Declarative SQL Schema
-- Persisted to IndexedDB via src/services/sqlEngine.ts — runs 100% offline.
-- ============================================================================

CREATE TABLE IF NOT EXISTS bullion_specs (
  id            INTEGER PRIMARY KEY,
  item_name     TEXT NOT NULL,
  metal         TEXT NOT NULL,          -- 'Gold' | 'Silver' | 'Platinum'
  purity_karat  REAL NOT NULL,          -- 24.0 for .9999, 22.0 for crown gold...
  weight_g      REAL NOT NULL,
  diameter_mm   REAL NOT NULL,
  thickness_mm  REAL NOT NULL,
  youngs_gpa    REAL NOT NULL,          -- Young's modulus E (GPa)
  poisson       REAL NOT NULL,          -- Poisson's ratio ν
  density       REAL NOT NULL,          -- kg/m³
  f20_hz        REAL NOT NULL,          -- Biharmonic mode (2,0)
  f30_hz        REAL NOT NULL,          -- Biharmonic mode (3,0)
  f01_hz        REAL NOT NULL,          -- Biharmonic mode (0,1)
  sustain_ms    REAL NOT NULL,          -- Ring decay at −40 dB
  melt_value_usd REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS assay_ledger (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  item_name     TEXT NOT NULL,
  purity_karat  REAL,
  weight_g      REAL,
  melt_value_usd REAL,
  verdict       TEXT NOT NULL,          -- 'AUTHENTIC' | 'SUSPECT' | 'COUNTERFEIT'
  score_pct     REAL,
  sg_measured   REAL,
  module        TEXT NOT NULL,          -- 'acoustic' | 'horology' | 'archimedes' | 'caliper'
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  synced        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS horology_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  movement      TEXT NOT NULL,
  bph           REAL NOT NULL,
  drift_s_day   REAL NOT NULL,
  beat_error_ms REAL NOT NULL,
  amplitude_deg REAL NOT NULL,
  verdict       TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  synced        INTEGER NOT NULL DEFAULT 0
);

-- ---- Seed: World Mint Metallurgical Database -------------------------------
INSERT OR IGNORE INTO bullion_specs VALUES
  (1,  '1 oz American Silver Eagle',        'Silver',   24.0, 31.103, 40.60, 2.98,  82.7, 0.37, 10490, 3995, 8920, 11040, 2150, 30.49),
  (2,  '1 oz American Gold Eagle (22K)',    'Gold',     22.0, 33.931, 32.70, 2.87,  79.0, 0.42, 19320, 3520, 7910,  9850, 1680, 2437.0),
  (3,  '1 oz Canadian Gold Maple Leaf',     'Gold',     24.0, 31.103, 30.00, 2.87,  79.0, 0.42, 19320, 3610, 8120, 10120, 1740, 2437.0),
  (4,  '1 oz South African Krugerrand',     'Gold',     22.0, 33.931, 32.77, 2.84,  79.0, 0.42, 19320, 3520, 7910,  9850, 1620, 2437.0),
  (5,  '1878-1921 Morgan Silver Dollar',    'Silver',   24.0, 26.730, 38.10, 3.10,  82.7, 0.37, 10490, 3640, 8150, 10080, 1980, 26.20),
  (6,  'British Gold Sovereign',            'Gold',     22.0,  7.988, 22.05, 1.52,  79.0, 0.42, 19320, 5480, 12100, 14900,  940, 573.5),
  (7,  '1 oz Platinum Eagle',               'Platinum', 24.0, 31.103, 32.70, 2.87, 168.0, 0.39, 21450, 4410, 9890, 12310, 1870, 969.0),
  (8,  '1 oz American Silver Eagle (FAKE CuNi)', 'Silver', 24.0, 31.103, 40.60, 2.98, 200.0, 0.34,  8900, 4480, 9980, 12410,  520, 30.49),
  (9,  '1 oz Gold Bar (Tungsten Core FAKE)',     'Gold', 24.0, 31.103, 30.00, 2.87, 411.0, 0.28, 19320, 5640, 12650, 15720,  610, 2437.0),
  (10, '1 oz Silver Bar (.999 Fine)',       'Silver',   24.0, 31.103, 40.00, 3.00,  82.7, 0.37, 10490, 4020, 8990, 11120, 2210, 30.49);

-- ---- Example forensic queries (used by the SQL Console presets) ------------
-- SELECT item_name, purity_karat, weight_g, melt_value_usd, verdict
--   FROM assay_ledger WHERE verdict = 'AUTHENTIC' ORDER BY melt_value_usd DESC;
-- SELECT metal, COUNT(*) AS n, AVG(melt_value_usd) AS avg_melt
--   FROM bullion_specs GROUP BY metal;
-- SELECT a.item_name, b.f20_hz FROM assay_ledger a
--   JOIN bullion_specs b ON a.item_name = b.item_name WHERE a.verdict = 'AUTHENTIC';
