// Fuel Log — pure calculation helpers (no React imports, unit-testable)

export const DAY = 86400000;

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const pad = (n) => String(n).padStart(2, '0');

export const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// date formats: 'DMY' (11.11.2026), 'MDY' (11/11/2026), 'YMD' (2026-11-11)
export function fmtDate(iso, f = 'DMY') {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (f === 'MDY') return `${m}/${d}/${y}`;
  if (f === 'YMD') return `${y}-${m}-${d}`;
  return `${d}.${m}.${y}`;
}

export function parseDate(txt, f = 'DMY') {
  const p = String(txt || '').trim().split(/[.\/\-\s]+/).map((x) => parseInt(x, 10));
  if (p.length !== 3 || p.some(isNaN)) return null;
  let y, m, d;
  if (f === 'YMD') [y, m, d] = p;
  else if (f === 'MDY') [m, d, y] = p;
  else [d, m, y] = p;
  if (y < 100) y += 2000;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export const num = (s) => {
  const v = parseFloat(String(s ?? '').replace(/,/g, '').trim());
  return isFinite(v) ? v : NaN;
};

// Indian-style grouping for INR, western otherwise
export function money(v, cur = '₹', dp = 0) {
  if (!isFinite(v)) return '—';
  const s = Math.abs(v).toFixed(dp);
  let [i, f] = s.split('.');
  if (cur === '₹') {
    const last3 = i.slice(-3);
    const rest = i.slice(0, -3);
    i = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
  } else {
    i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  return `${v < 0 ? '-' : ''}${cur}${i}${f ? '.' + f : ''}`;
}

export const fixed = (v, dp = 1) => (isFinite(v) ? v.toFixed(dp) : '—');
export const grouped = (v) =>
  isFinite(v) ? Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '—';

export const entryCost = (e) =>
  e.kind === 'fuel' ? (e.litres || 0) * (e.price || 0) : e.amount || 0;

/**
 * Full-tank method.
 * For each full fill i, look back to previous full fill j.
 * fuel used = litres of every fill after j up to and including i (partials included)
 * distance  = odo_i - odo_j
 * Segment is invalid if any fill in (j, i] is flagged "missed previous".
 * Returns Map(entryId -> {eff, dist, fuel, flag})
 */
export function analyse(entries, vehicleType = 'car') {
  const fuel = entries
    .filter((e) => e.kind === 'fuel' && isFinite(e.odo))
    .sort((a, b) => a.odo - b.odo || a.date.localeCompare(b.date));
  const seg = new Map();
  let lastFull = -1;
  for (let i = 0; i < fuel.length; i++) {
    const e = fuel[i];
    if (!e.full) continue;
    if (lastFull >= 0) {
      let litres = 0;
      let broken = false;
      for (let k = lastFull + 1; k <= i; k++) {
        litres += fuel[k].litres || 0;
        if (fuel[k].missed) broken = true;
      }
      const dist = e.odo - fuel[lastFull].odo;
      if (!broken && dist > 0 && litres > 0) {
        seg.set(e.id, { eff: dist / litres, dist, fuel: litres, flag: null });
      }
    }
    lastFull = i;
  }
  // outlier flags
  const vals = [...seg.values()].map((s) => s.eff).sort((a, b) => a - b);
  const med = vals.length ? vals[Math.floor(vals.length / 2)] : NaN;
  const [lo, hi] = vehicleType === 'bike' ? [10, 90] : [3, 35];
  for (const s of seg.values()) {
    if (s.eff < lo || s.eff > hi) s.flag = 'Unlikely value — missed or partial fill?';
    else if (vals.length >= 3 && Math.abs(s.eff - med) / med > 0.3)
      s.flag = `${s.eff > med ? 'Well above' : 'Well below'} your usual ${med.toFixed(1)}`;
  }
  return seg;
}

/** Summary over a set of entries (already filtered to one vehicle and a date range). */
export function summarise(entries, vehicleType = 'car') {
  const seg = analyse(entries, vehicleType);
  const good = [...seg.values()].filter((s) => !s.flag);
  const use = good.length ? good : [...seg.values()];
  const dSum = use.reduce((a, s) => a + s.dist, 0);
  const fSum = use.reduce((a, s) => a + s.fuel, 0);
  const avg = fSum > 0 ? dSum / fSum : NaN;

  const fuel = entries.filter((e) => e.kind === 'fuel').sort((a, b) => a.odo - b.odo);
  const odos = entries.filter((e) => isFinite(e.odo)).map((e) => e.odo);
  const distance = odos.length > 1 ? Math.max(...odos) - Math.min(...odos) : NaN;

  const fuelSpend = fuel.reduce((a, e) => a + entryCost(e), 0);
  const otherSpend = entries.filter((e) => e.kind === 'expense').reduce((a, e) => a + entryCost(e), 0);
  const litres = fuel.reduce((a, e) => a + (e.litres || 0), 0);

  // cost/km: exclude the first fill (that fuel was burnt before tracking began)
  const fuelAfterFirst = fuel.slice(1).reduce((a, e) => a + entryCost(e), 0);
  const fuelPerKm = distance > 0 ? fuelAfterFirst / distance : NaN;
  const totalPerKm = distance > 0 ? (fuelAfterFirst + otherSpend) / distance : NaN;

  const effs = use.map((s) => s.eff);
  return {
    seg, avg, distance, fuelSpend, otherSpend, litres,
    fuelPerKm, totalPerKm,
    best: effs.length ? Math.max(...effs) : NaN,
    worst: effs.length ? Math.min(...effs) : NaN,
    fills: fuel.length,
  };
}

/** Monthly spend buckets: [{key:'2026-11', fuel, other}] ascending */
export function monthly(entries) {
  const m = new Map();
  for (const e of entries) {
    const k = e.date.slice(0, 7);
    if (!m.has(k)) m.set(k, { key: k, fuel: 0, other: 0 });
    const b = m.get(k);
    if (e.kind === 'fuel') b.fuel += entryCost(e);
    else b.other += entryCost(e);
  }
  return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function inRange(e, range) {
  const y = new Date().getFullYear();
  if (range === 'year') return e.date.startsWith(String(y));
  if (range === 'last') return e.date.startsWith(String(y - 1));
  if (range === '90') return Date.now() - new Date(e.date).getTime() <= 90 * DAY;
  return true;
}

export function toCSV(state) {
  const vname = Object.fromEntries(state.vehicles.map((v) => [v.id, v.name]));
  const rows = [['vehicle', 'type', 'date', 'odometer_km', 'litres', 'price_per_l', 'amount', 'full_tank', 'missed_previous', 'note']];
  for (const e of [...state.entries].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([
      vname[e.vid] || '', e.kind, e.date, e.odo ?? '', e.litres ?? '', e.price ?? '',
      entryCost(e).toFixed(2), e.kind === 'fuel' ? (e.full ? 'yes' : 'no') : '',
      e.kind === 'fuel' ? (e.missed ? 'yes' : 'no') : '', (e.note || '').replace(/"/g, '""'),
    ]);
  }
  return rows.map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${c}"` : c)).join(',')).join('\n');
}
