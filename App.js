// Fuel Log — minimal fuel expense tracker
export const __version__ = '1.0.0';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, Pressable, Modal,
  StyleSheet, Dimensions, StatusBar as RNStatusBar, Alert, Share, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Line, Circle, Rect, Text as SvgText } from 'react-native-svg';
import {
  uid, isoToday, fmtDate, parseDate, num, money, fixed, grouped,
  entryCost, summarise, monthly, inRange, toCSV, DAY,
} from './calc';

// ─── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0A0B',
  card: '#141416',
  card2: '#1B1B1E',
  line: '#26262A',
  text: '#F4F4F5',
  dim: '#8E8E93',
  faint: '#55555B',
  accent: '#FFB020',
  accentDim: '#3A2A08',
  warn: '#FF6B4A',
  ok: '#4ADE80',
};
const TAB = { fontVariant: ['tabular-nums'] };
const W = Dimensions.get('window').width;
const TOP = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 44;
const KEY = 'fuellog.v1';
const CURRENCIES = ['₹', '$', '€', '£'];
const DATEFMTS = [['DMY', 'DD.MM.YYYY'], ['MDY', 'MM/DD/YYYY'], ['YMD', 'YYYY-MM-DD']];
const EXP_CATS = ['Service', 'Tyres', 'Insurance', 'Repair', 'Wash', 'Parking', 'Toll', 'Other'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const EMPTY = {
  v: 1,
  settings: { currency: '₹', dateFmt: 'DMY' },
  vehicles: [],
  activeId: null,
  entries: [],
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const Ico = ({ d, size = 22, color = C.text, sw = 1.8, fill = 'none' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d={d} stroke={color} strokeWidth={sw} fill={fill} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
const I = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  plus: 'M12 5v14M5 12h14',
  down: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6 6 18',
  trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
  car: 'M5 17h14M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0M3 17v-5l2-5h14l2 5v5M3 12h18',
  bike: 'M5.5 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM18.5 18a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5.5 14.5 9 8h5l4.5 6.5M12 14.5 9 8M14 8l1-3h3',
  drop: 'M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z',
  wrench: 'M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 6-6-1.3-1.3a4 4 0 0 1-5-5l2.6 2.6 2-2z',
  warn: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  check: 'M5 12l5 5 9-10',
};

// ─── Small primitives ────────────────────────────────────────────────────────
const Label = ({ children, style }) => <Text style={[s.label, style]}>{children}</Text>;

const Chip = ({ on, children, onPress, style }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={[s.chip, on && s.chipOn, style]}>
    <Text style={[s.chipTxt, on && s.chipTxtOn]}>{children}</Text>
  </TouchableOpacity>
);

const Toggle = ({ on, label, onPress }) => (
  <Pressable onPress={onPress} style={s.toggleRow}>
    <Text style={s.toggleLabel}>{label}</Text>
    <View style={[s.toggle, on && s.toggleOn]}>
      <View style={[s.knob, on && s.knobOn]} />
    </View>
  </Pressable>
);

const Field = ({ label, suffix, hint, ...p }) => (
  <View style={s.field}>
    <Label>{label}</Label>
    <View style={s.fieldRow}>
      <TextInput
        placeholderTextColor={C.faint}
        selectionColor={C.accent}
        style={s.input}
        {...p}
      />
      {suffix ? <Text style={s.suffix}>{suffix}</Text> : null}
    </View>
    {hint ? <Text style={s.hint}>{hint}</Text> : null}
  </View>
);

const Stat = ({ label, value, unit, accent }) => (
  <View style={s.stat}>
    <Label>{label}</Label>
    <Text style={[s.statVal, TAB, accent && { color: C.accent }]} numberOfLines={1} adjustsFontSizeToFit>
      {value}
      {unit ? <Text style={s.statUnit}> {unit}</Text> : null}
    </Text>
  </View>
);

// ─── Charts ──────────────────────────────────────────────────────────────────
const compact = (v, cur) =>
  v >= 100000 ? `${cur}${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${cur}${(v / 1000).toFixed(1)}k` : `${cur}${Math.round(v)}`;

function LineChart({ points, height = 170, unit = '' }) {
  const w = W - 40 - 32;
  const pl = 34, pr = 10, pt = 14, pb = 22;
  if (points.length < 2)
    return <Text style={s.empty}>Needs at least two full-tank fills.</Text>;
  const ys = points.map((p) => p.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
  const padY = (hi - lo) * 0.15; lo -= padY; hi += padY;
  const X = (i) => pl + (i * (w - pl - pr)) / (points.length - 1);
  const Y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (height - pt - pb);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const area = `${d} L${X(points.length - 1)},${height - pb} L${X(0)},${height - pb} Z`;
  const ticks = [lo + padY, (lo + hi) / 2, hi - padY];
  const step = Math.max(1, Math.ceil(points.length / 5));
  return (
    <Svg width={w} height={height}>
      {ticks.map((t, i) => (
        <React.Fragment key={i}>
          <Line x1={pl} x2={w - pr} y1={Y(t)} y2={Y(t)} stroke={C.line} strokeWidth={1} />
          <SvgText x={pl - 6} y={Y(t) + 4} fill={C.dim} fontSize={10} textAnchor="end">{t.toFixed(1)}</SvgText>
        </React.Fragment>
      ))}
      <Path d={area} fill={C.accent} fillOpacity={0.08} />
      <Path d={d} stroke={C.accent} strokeWidth={2} fill="none" strokeLinejoin="round" />
      {points.map((p, i) => (
        <React.Fragment key={i}>
          <Circle cx={X(i)} cy={Y(p.y)} r={3.5} fill={p.flag ? C.warn : C.bg} stroke={p.flag ? C.warn : C.accent} strokeWidth={2} />
          {i % step === 0 || i === points.length - 1 ? (
            <SvgText x={X(i)} y={height - 6} fill={C.dim} fontSize={10} textAnchor="middle">{p.label}</SvgText>
          ) : null}
        </React.Fragment>
      ))}
    </Svg>
  );
}

function BarChart({ data, cur, height = 170 }) {
  const w = W - 40 - 32;
  const pl = 6, pr = 6, pt = 18, pb = 22;
  if (!data.length) return <Text style={s.empty}>No spend in this period.</Text>;
  const show = data.slice(-12);
  const max = Math.max(...show.map((d) => d.fuel + d.other), 1);
  const slot = (w - pl - pr) / show.length;
  const bw = Math.min(26, slot * 0.6);
  const H = (v) => (v / max) * (height - pt - pb);
  return (
    <Svg width={w} height={height}>
      <Line x1={pl} x2={w - pr} y1={height - pb} y2={height - pb} stroke={C.line} strokeWidth={1} />
      {show.map((d, i) => {
        const x = pl + i * slot + (slot - bw) / 2;
        const hf = H(d.fuel), ho = H(d.other);
        const base = height - pb;
        const [yy, mm] = d.key.split('-');
        return (
          <React.Fragment key={d.key}>
            <Rect x={x} y={base - hf} width={bw} height={Math.max(hf, 0)} rx={3} fill={C.accent} />
            {ho > 0 ? <Rect x={x} y={base - hf - ho - 2} width={bw} height={ho} rx={3} fill={C.dim} /> : null}
            {show.length <= 6 ? (
              <SvgText x={x + bw / 2} y={base - hf - ho - 6} fill={C.text} fontSize={10} textAnchor="middle">
                {compact(d.fuel + d.other, cur)}
              </SvgText>
            ) : null}
            <SvgText x={x + bw / 2} y={height - 6} fill={C.dim} fontSize={10} textAnchor="middle">
              {MONTHS[+mm - 1]}{show.length <= 6 ? ` ${yy.slice(2)}` : ''}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ─── Onboarding ──────────────────────────────────────────────────────────────
function Onboarding({ onDone }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('car');
  return (
    <View style={[s.screen, { paddingTop: TOP + 48, paddingHorizontal: 24 }]}>
      <Ico d={I.drop} size={40} color={C.accent} />
      <Text style={s.hero}>Fuel Log</Text>
      <Text style={[s.dimTxt, { marginBottom: 40 }]}>Mileage and running cost. Nothing else.</Text>
      <Label>Vehicle</Label>
      <TextInput
        value={name} onChangeText={setName} placeholder="e.g. Skoda" autoFocus
        placeholderTextColor={C.faint} selectionColor={C.accent} style={[s.input, s.bigInput]}
      />
      <View style={[s.row, { marginTop: 20, gap: 10 }]}>
        <Chip on={type === 'car'} onPress={() => setType('car')}>Car</Chip>
        <Chip on={type === 'bike'} onPress={() => setType('bike')}>Two-wheeler</Chip>
      </View>
      <View style={{ flex: 1 }} />
      <TouchableOpacity
        disabled={!name.trim()}
        style={[s.primary, !name.trim() && { opacity: 0.3 }, { marginBottom: 40 }]}
        onPress={() => onDone({ id: uid(), name: name.trim(), type })}
      >
        <Text style={s.primaryTxt}>Start</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Home ────────────────────────────────────────────────────────────────────
function Home({ entries, vehicle, cur, df, onEdit }) {
  const all = useMemo(() => summarise(entries, vehicle.type), [entries, vehicle.type]);
  const month = isoToday().slice(0, 7);
  const monthSpend = entries.filter((e) => e.date.startsWith(month)).reduce((a, e) => a + entryCost(e), 0);
  const fuel = entries.filter((e) => e.kind === 'fuel').sort((a, b) => b.odo - a.odo);
  const last = fuel[0];
  const lastSeg = last ? all.seg.get(last.id) : null;
  const flagged = [...all.seg.values()].some((x) => x.flag);

  return (
    <ScrollView contentContainerStyle={s.pad} showsVerticalScrollIndicator={false}>
      <View style={s.heroBlock}>
        <Label>Average mileage</Label>
        <View style={s.row}>
          <Text style={[s.mega, TAB]}>{fixed(all.avg, 1)}</Text>
          <Text style={s.megaUnit}>km/l</Text>
        </View>
        <Text style={s.dimTxt}>
          {isFinite(all.avg)
            ? `Best ${fixed(all.best, 1)} · Worst ${fixed(all.worst, 1)}`
            : fuel.length ? 'Log one more full-tank fill to see mileage.' : 'Add your first full-tank fill.'}
        </Text>
      </View>

      <View style={s.grid}>
        <Stat label="Cost / km" value={isFinite(all.totalPerKm) ? money(all.totalPerKm, cur, 2) : '—'} accent />
        <Stat label="Fuel / km" value={isFinite(all.fuelPerKm) ? money(all.fuelPerKm, cur, 2) : '—'} />
        <Stat label="This month" value={money(monthSpend, cur)} />
        <Stat label="Tracked" value={grouped(all.distance)} unit="km" />
      </View>

      {flagged ? (
        <View style={s.warnCard}>
          <Ico d={I.warn} size={18} color={C.warn} />
          <Text style={s.warnTxt}>
            Some readings look wrong and are left out of the average. Check for a missed or partial fill in the Log.
          </Text>
        </View>
      ) : null}

      {last ? (
        <TouchableOpacity activeOpacity={0.8} onPress={() => onEdit(last)} style={s.card}>
          <View style={s.rowBetween}>
            <Label style={{ marginBottom: 0 }}>Last fill</Label>
            <Text style={s.dimSmall}>{fmtDate(last.date, df)}</Text>
          </View>
          <View style={[s.rowBetween, { marginTop: 14, alignItems: 'flex-end' }]}>
            <View>
              <Text style={[s.cardBig, TAB]}>{money(entryCost(last), cur)}</Text>
              <Text style={[s.dimSmall, TAB]}>
                {fixed(last.litres, 2)} l × {money(last.price, cur, 2)} · {grouped(last.odo)} km
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.cardBig, TAB, { color: lastSeg?.flag ? C.warn : C.accent }]}>
                {lastSeg ? fixed(lastSeg.eff, 1) : '—'}
              </Text>
              <Text style={s.dimSmall}>km/l</Text>
            </View>
          </View>
        </TouchableOpacity>
      ) : null}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Log ─────────────────────────────────────────────────────────────────────
function Log({ entries, vehicle, cur, df, onEdit }) {
  const { seg } = useMemo(() => summarise(entries, vehicle.type), [entries, vehicle.type]);
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date) || (b.odo || 0) - (a.odo || 0));
  const groups = [];
  for (const e of sorted) {
    const k = e.date.slice(0, 7);
    if (!groups.length || groups[groups.length - 1].k !== k) groups.push({ k, items: [], total: 0 });
    const g = groups[groups.length - 1];
    g.items.push(e);
    g.total += entryCost(e);
  }
  if (!entries.length)
    return (
      <View style={s.center}>
        <Ico d={I.list} size={40} color={C.faint} />
        <Text style={[s.dimTxt, { marginTop: 12 }]}>No entries yet. Tap + to add one.</Text>
      </View>
    );
  return (
    <ScrollView contentContainerStyle={s.pad} showsVerticalScrollIndicator={false}>
      {groups.map((g) => {
        const [y, m] = g.k.split('-');
        return (
          <View key={g.k} style={{ marginBottom: 22 }}>
            <View style={[s.rowBetween, { marginBottom: 8, paddingHorizontal: 4 }]}>
              <Text style={s.monthHead}>{MONTHS[+m - 1]} {y}</Text>
              <Text style={[s.dimSmall, TAB]}>{money(g.total, cur)}</Text>
            </View>
            <View style={s.listCard}>
              {g.items.map((e, i) => {
                const sg = seg.get(e.id);
                const fuel = e.kind === 'fuel';
                return (
                  <TouchableOpacity
                    key={e.id} activeOpacity={0.7} onPress={() => onEdit(e)}
                    style={[s.logRow, i > 0 && s.logRowBorder]}
                  >
                    <View style={[s.dot, { backgroundColor: fuel ? C.accentDim : C.card2 }]}>
                      <Ico d={fuel ? I.drop : I.wrench} size={16} color={fuel ? C.accent : C.dim} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.logMain, TAB]}>
                        {fuel ? `${fixed(e.litres, 2)} l` : e.note || 'Expense'}
                        {fuel && !e.full ? <Text style={s.tag}>  PARTIAL</Text> : null}
                        {fuel && e.missed ? <Text style={s.tag}>  AFTER MISSED</Text> : null}
                      </Text>
                      <Text style={[s.dimSmall, TAB]}>
                        {fmtDate(e.date, df)}{isFinite(e.odo) ? ` · ${grouped(e.odo)} km` : ''}
                        {fuel ? ` · ${money(e.price, cur, 2)}/l` : ''}
                      </Text>
                      {sg?.flag ? <Text style={s.flagTxt}>{sg.flag}</Text> : null}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.logMain, TAB]}>{money(entryCost(e), cur)}</Text>
                      {fuel ? (
                        <Text style={[s.logEff, TAB, { color: sg?.flag ? C.warn : sg ? C.accent : C.faint }]}>
                          {sg ? `${fixed(sg.eff, 1)} km/l` : '—'}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Stats ───────────────────────────────────────────────────────────────────
function Stats({ entries, vehicle, cur, df }) {
  const [range, setRange] = useState('all');
  const list = entries.filter((e) => inRange(e, range));
  const sm = useMemo(() => summarise(list, vehicle.type), [list, vehicle.type]);
  const mon = useMemo(() => monthly(list), [list]);
  const fuelSorted = list.filter((e) => e.kind === 'fuel').sort((a, b) => a.odo - b.odo);
  const pts = fuelSorted
    .filter((e) => sm.seg.has(e.id))
    .map((e) => {
      const sg = sm.seg.get(e.id);
      return { y: sg.eff, flag: sg.flag, label: fmtDate(e.date, df).slice(0, 5) };
    });
  return (
    <ScrollView contentContainerStyle={s.pad} showsVerticalScrollIndicator={false}>
      <View style={[s.row, { gap: 8, marginBottom: 20 }]}>
        {[['all', 'All'], ['year', 'This year'], ['last', 'Last year'], ['90', '90 days']].map(([k, l]) => (
          <Chip key={k} on={range === k} onPress={() => setRange(k)}>{l}</Chip>
        ))}
      </View>

      <View style={s.card}>
        <View style={s.rowBetween}>
          <Label style={{ marginBottom: 0 }}>Mileage per fill</Label>
          <Text style={s.dimSmall}>km/l</Text>
        </View>
        <View style={{ marginTop: 12 }}><LineChart points={pts} /></View>
      </View>

      <View style={s.card}>
        <View style={s.rowBetween}>
          <Label style={{ marginBottom: 0 }}>Monthly spend</Label>
          <View style={s.row}>
            <View style={[s.legend, { backgroundColor: C.accent }]} /><Text style={s.dimSmall}>Fuel   </Text>
            <View style={[s.legend, { backgroundColor: C.dim }]} /><Text style={s.dimSmall}>Other</Text>
          </View>
        </View>
        <View style={{ marginTop: 12 }}><BarChart data={mon} cur={cur} /></View>
      </View>

      <View style={s.card}>
        {[
          ['Average mileage', isFinite(sm.avg) ? `${fixed(sm.avg, 2)} km/l` : '—'],
          ['Distance', `${grouped(sm.distance)} km`],
          ['Fuel bought', `${fixed(sm.litres, 1)} l in ${sm.fills} fills`],
          ['Fuel spend', money(sm.fuelSpend, cur)],
          ['Other spend', money(sm.otherSpend, cur)],
          ['Total spend', money(sm.fuelSpend + sm.otherSpend, cur)],
          ['Cost per km', isFinite(sm.totalPerKm) ? money(sm.totalPerKm, cur, 2) : '—'],
        ].map(([k, v], i) => (
          <View key={k} style={[s.kv, i > 0 && s.logRowBorder]}>
            <Text style={s.kvK}>{k}</Text>
            <Text style={[s.kvV, TAB, i === 6 && { color: C.accent }]}>{v}</Text>
          </View>
        ))}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ─── Entry editor ────────────────────────────────────────────────────────────
function EntryModal({ visible, entry, entries, vehicle, settings, onSave, onDelete, onClose }) {
  const df = settings.dateFmt;
  const cur = settings.currency;
  const editing = !!entry?.id;
  const fuelPrev = entries.filter((e) => e.kind === 'fuel').sort((a, b) => b.odo - a.odo);
  const lastOdo = Math.max(0, ...entries.filter((e) => isFinite(e.odo)).map((e) => e.odo));

  const [kind, setKind] = useState('fuel');
  const [date, setDate] = useState('');
  const [odo, setOdo] = useState('');
  const [litres, setLitres] = useState('');
  const [price, setPrice] = useState('');
  const [total, setTotal] = useState('');
  const [full, setFull] = useState(true);
  const [missed, setMissed] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!visible) return;
    const e = entry || {};
    setKind(e.kind || 'fuel');
    setDate(fmtDate(e.date || isoToday(), df));
    setOdo(e.odo != null && isFinite(e.odo) ? String(e.odo) : '');
    setLitres(e.litres != null ? String(e.litres) : '');
    const p = e.price ?? fuelPrev[0]?.price;
    setPrice(p != null ? String(p) : '');
    setTotal(e.kind === 'fuel' ? (e.litres * e.price).toFixed(2) : '');
    setFull(e.full ?? true);
    setMissed(!!e.missed);
    setAmount(e.amount != null ? String(e.amount) : '');
    setNote(e.note || '');
  }, [visible]); // eslint-disable-line

  // two-of-three: litres × price = total
  const onLitres = (v) => {
    setLitres(v);
    const l = num(v), p = num(price);
    setTotal(isFinite(l) && isFinite(p) ? (l * p).toFixed(2) : '');
  };
  const onPrice = (v) => {
    setPrice(v);
    const l = num(litres), p = num(v), t = num(total);
    if (isFinite(l) && isFinite(p)) setTotal((l * p).toFixed(2));
    else if (isFinite(t) && isFinite(p) && p > 0) setLitres((t / p).toFixed(2));
  };
  const onTotal = (v) => {
    setTotal(v);
    const t = num(v), p = num(price);
    setLitres(isFinite(t) && isFinite(p) && p > 0 ? (t / p).toFixed(2) : '');
  };

  const save = () => {
    const iso = parseDate(date, df);
    if (!iso) return Alert.alert('Date', `Use format ${DATEFMTS.find((d) => d[0] === df)[1]}.`);
    if (iso > isoToday()) return Alert.alert('Date', 'Date is in the future.');
    const o = num(odo);
    const base = { id: entry?.id || uid(), vid: vehicle.id, kind, date: iso };
    if (kind === 'fuel') {
      const l = num(litres), p = num(price);
      if (!(o > 0)) return Alert.alert('Odometer', 'Enter the odometer reading.');
      if (!(l > 0)) return Alert.alert('Fuel', 'Enter litres, or the amount paid.');
      if (!(p > 0)) return Alert.alert('Price', 'Enter price per litre.');
      const others = entries.filter((x) => x.kind === 'fuel' && x.id !== base.id);
      if (others.some((x) => x.odo === o)) return Alert.alert('Odometer', 'Another fill already has this reading.');
      const clash = others.find((x) => (x.date < iso && x.odo > o) || (x.date > iso && x.odo < o));
      if (clash)
        return Alert.alert(
          'Odometer out of order',
          `${fmtDate(clash.date, df)} shows ${grouped(clash.odo)} km. Check the date or reading.`,
        );
      onSave({ ...base, odo: o, litres: +l.toFixed(3), price: +p.toFixed(3), full, missed, note: note.trim() });
    } else {
      const a = num(amount);
      if (!(a > 0)) return Alert.alert('Amount', 'Enter the amount.');
      onSave({ ...base, odo: o > 0 ? o : null, amount: a, note: note.trim() || 'Other' });
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(entry.id) },
    ]);

  const shiftDay = (n) => {
    const iso = parseDate(date, df) || isoToday();
    const d = new Date(new Date(iso + 'T12:00:00').getTime() + n * DAY);
    const nd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (nd <= isoToday()) setDate(fmtDate(nd, df));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.screen, { paddingTop: TOP }]}>
        <View style={s.modalHead}>
          <TouchableOpacity onPress={onClose} hitSlop={12}><Ico d={I.close} /></TouchableOpacity>
          <Text style={s.modalTitle}>{editing ? 'Edit' : 'New entry'}</Text>
          <TouchableOpacity onPress={save} hitSlop={12}><Text style={s.saveTxt}>Save</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          {!editing ? (
            <View style={s.segment}>
              {[['fuel', 'Fuel'], ['expense', 'Other expense']].map(([k, l]) => (
                <TouchableOpacity key={k} style={[s.segBtn, kind === k && s.segOn]} onPress={() => setKind(k)}>
                  <Text style={[s.segTxt, kind === k && s.segTxtOn]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <View style={s.field}>
            <Label>Date</Label>
            <View style={s.fieldRow}>
              <TextInput value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation"
                style={s.input} selectionColor={C.accent} placeholderTextColor={C.faint} />
              <TouchableOpacity onPress={() => shiftDay(-1)} style={s.stepBtn}><Text style={s.stepTxt}>−1d</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setDate(fmtDate(isoToday(), df))} style={s.stepBtn}><Text style={s.stepTxt}>Today</Text></TouchableOpacity>
            </View>
          </View>

          {kind === 'fuel' ? (
            <>
              <Field label="Odometer" suffix="km" value={odo} onChangeText={setOdo} keyboardType="numeric"
                placeholder={lastOdo ? `Last ${grouped(lastOdo)}` : '0'} autoFocus={!editing}
                hint={isFinite(num(odo)) && lastOdo && num(odo) > lastOdo && !editing ? `+${grouped(num(odo) - lastOdo)} km since last entry` : null} />
              <Field label="Price per litre" suffix={cur} value={price} onChangeText={onPrice} keyboardType="decimal-pad" placeholder="0.00" />
              <View style={[s.row, { gap: 14 }]}>
                <View style={{ flex: 1 }}>
                  <Field label="Litres" suffix="l" value={litres} onChangeText={onLitres} keyboardType="decimal-pad" placeholder="0.00" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Amount paid" suffix={cur} value={total} onChangeText={onTotal} keyboardType="decimal-pad" placeholder="0" />
                </View>
              </View>
              <View style={[s.card, { paddingVertical: 4, marginTop: 6 }]}>
                <Toggle on={full} label="Filled to full tank" onPress={() => setFull(!full)} />
                <View style={s.hr} />
                <Toggle on={missed} label="I missed logging the previous fill" onPress={() => setMissed(!missed)} />
              </View>
              <Text style={[s.hint, { marginBottom: 20 }]}>Mileage is calculated between full-tank fills. Partial fills are added to the next full fill.</Text>
            </>
          ) : (
            <>
              <Field label="Amount" suffix={cur} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0" autoFocus={!editing} />
              <Label>Category</Label>
              <View style={[s.row, { flexWrap: 'wrap', gap: 8, marginBottom: 18 }]}>
                {EXP_CATS.map((c) => <Chip key={c} on={note === c} onPress={() => setNote(c)}>{c}</Chip>)}
              </View>
              <Field label="Odometer (optional)" suffix="km" value={odo} onChangeText={setOdo} keyboardType="numeric" placeholder="—" />
            </>
          )}

          <Field label="Note" value={EXP_CATS.includes(note) && kind === 'expense' ? '' : note}
            onChangeText={setNote} placeholder={kind === 'fuel' ? 'Optional' : 'Or type your own'} />

          {editing ? (
            <TouchableOpacity onPress={confirmDelete} style={s.dangerBtn}>
              <Ico d={I.trash} size={18} color={C.warn} />
              <Text style={s.dangerTxt}>Delete entry</Text>
            </TouchableOpacity>
          ) : null}
          <View style={{ height: 80 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────
function SettingsModal({ visible, state, setState, onClose }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('car');
  const [restore, setRestore] = useState('');
  const [showRestore, setShowRestore] = useState(false);
  const st = state.settings;
  const setSetting = (k, v) => setState((p) => ({ ...p, settings: { ...p.settings, [k]: v } }));

  const addVehicle = () => {
    if (!name.trim()) return;
    const v = { id: uid(), name: name.trim(), type };
    setState((p) => ({ ...p, vehicles: [...p.vehicles, v], activeId: v.id }));
    setName('');
  };
  const delVehicle = (v) => {
    const n = state.entries.filter((e) => e.vid === v.id).length;
    Alert.alert(`Delete ${v.name}?`, `${n} entries will be deleted too.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => setState((p) => {
          const vehicles = p.vehicles.filter((x) => x.id !== v.id);
          return {
            ...p, vehicles,
            entries: p.entries.filter((e) => e.vid !== v.id),
            activeId: p.activeId === v.id ? vehicles[0]?.id || null : p.activeId,
          };
        }),
      },
    ]);
  };
  const doRestore = () => {
    try {
      const d = JSON.parse(restore);
      if (!Array.isArray(d.vehicles) || !Array.isArray(d.entries)) throw new Error('bad');
      Alert.alert('Replace all data?', `${d.vehicles.length} vehicles, ${d.entries.length} entries.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace', style: 'destructive',
          onPress: () => {
            setState({ ...EMPTY, ...d, settings: { ...EMPTY.settings, ...d.settings } });
            setRestore(''); setShowRestore(false); onClose();
          },
        },
      ]);
    } catch {
      Alert.alert('Restore', 'That is not a valid Fuel Log backup.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[s.screen, { paddingTop: TOP }]}>
        <View style={s.modalHead}>
          <View style={{ width: 22 }} />
          <Text style={s.modalTitle}>Settings</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}><Ico d={I.close} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
          <Label>Vehicles</Label>
          <View style={s.listCard}>
            {state.vehicles.map((v, i) => (
              <View key={v.id} style={[s.logRow, i > 0 && s.logRowBorder]}>
                <Ico d={v.type === 'bike' ? I.bike : I.car} size={20} color={C.dim} />
                <TextInput
                  value={v.name} selectionColor={C.accent}
                  onChangeText={(t) => setState((p) => ({ ...p, vehicles: p.vehicles.map((x) => (x.id === v.id ? { ...x, name: t } : x)) }))}
                  style={[s.logMain, { flex: 1, marginLeft: 12, padding: 0 }]}
                />
                <TouchableOpacity onPress={() => delVehicle(v)} hitSlop={10}><Ico d={I.trash} size={18} color={C.faint} /></TouchableOpacity>
              </View>
            ))}
            <View style={[s.logRow, s.logRowBorder]}>
              <TextInput value={name} onChangeText={setName} placeholder="Add vehicle" placeholderTextColor={C.faint}
                selectionColor={C.accent} style={[s.logMain, { flex: 1, minWidth: 0, width: 0, padding: 0 }]} onSubmitEditing={addVehicle} />
              <Chip on={type === 'car'} onPress={() => setType('car')} style={s.chipSm}>Car</Chip>
              <Chip on={type === 'bike'} onPress={() => setType('bike')} style={[s.chipSm, { marginLeft: 6 }]}>2W</Chip>
              <TouchableOpacity onPress={addVehicle} hitSlop={10} style={{ marginLeft: 10 }}><Ico d={I.plus} color={C.accent} /></TouchableOpacity>
            </View>
          </View>

          <Label style={{ marginTop: 26 }}>Currency</Label>
          <View style={[s.row, { gap: 8 }]}>
            {CURRENCIES.map((c) => <Chip key={c} on={st.currency === c} onPress={() => setSetting('currency', c)}>{c}</Chip>)}
          </View>

          <Label style={{ marginTop: 26 }}>Date format</Label>
          <View style={[s.row, { gap: 8, flexWrap: 'wrap' }]}>
            {DATEFMTS.map(([k, l]) => <Chip key={k} on={st.dateFmt === k} onPress={() => setSetting('dateFmt', k)}>{l}</Chip>)}
          </View>

          <Label style={{ marginTop: 26 }}>Data</Label>
          <View style={s.listCard}>
            {[
              ['Export CSV', () => Share.share({ title: 'fuel-log.csv', message: toCSV(state) })],
              ['Backup (share JSON)', () => Share.share({ title: 'fuel-log-backup.json', message: JSON.stringify(state) })],
              ['Restore from backup', () => setShowRestore(!showRestore)],
            ].map(([l, fn], i) => (
              <TouchableOpacity key={l} onPress={fn} style={[s.logRow, i > 0 && s.logRowBorder]}>
                <Text style={[s.logMain, { flex: 1 }]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {showRestore ? (
            <View style={{ marginTop: 12 }}>
              <TextInput
                value={restore} onChangeText={setRestore} multiline placeholder="Paste backup JSON here"
                placeholderTextColor={C.faint} selectionColor={C.accent}
                style={[s.card, { color: C.text, minHeight: 120, textAlignVertical: 'top', fontSize: 13 }]}
              />
              <TouchableOpacity onPress={doRestore} style={s.primary}><Text style={s.primaryTxt}>Restore</Text></TouchableOpacity>
            </View>
          ) : null}
          <Text style={s.dimTxt}>All data stays on this phone. Back up now and then.</Text>

          <Text style={[s.dimSmall, { textAlign: 'center', marginTop: 40 }]}>Fuel Log v{__version__}</Text>
          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Vehicle picker ──────────────────────────────────────────────────────────
function VehiclePicker({ visible, state, onPick, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose}>
        <View style={s.sheet}>
          <Label>Vehicle</Label>
          {state.vehicles.map((v) => (
            <TouchableOpacity key={v.id} onPress={() => onPick(v.id)} style={s.sheetRow}>
              <Ico d={v.type === 'bike' ? I.bike : I.car} size={20} color={v.id === state.activeId ? C.accent : C.dim} />
              <Text style={[s.sheetTxt, v.id === state.activeId && { color: C.accent }]}>{v.name}</Text>
              {v.id === state.activeId ? <Ico d={I.check} size={18} color={C.accent} /> : null}
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(null);
  const [tab, setTab] = useState('home');
  const [editor, setEditor] = useState({ open: false, entry: null });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => setState(raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY))
      .catch(() => setState(EMPTY));
  }, []);
  useEffect(() => {
    if (state) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const vehicle = state?.vehicles.find((v) => v.id === state.activeId) || state?.vehicles[0];
  const entries = useMemo(
    () => (state && vehicle ? state.entries.filter((e) => e.vid === vehicle.id) : []),
    [state, vehicle],
  );
  const openEditor = useCallback((entry) => setEditor({ open: true, entry }), []);

  if (!state) return <View style={s.screen} />;
  if (!vehicle)
    return (
      <>
        <StatusBar style="light" />
        <Onboarding onDone={(v) => setState((p) => ({ ...p, vehicles: [v], activeId: v.id }))} />
      </>
    );

  const cur = state.settings.currency;
  const df = state.settings.dateFmt;
  const props = { entries, vehicle, cur, df, onEdit: openEditor };
  const titles = { home: 'Overview', log: 'Log', stats: 'Stats' };

  return (
    <View style={[s.screen, { paddingTop: TOP }]}>
      <StatusBar style="light" />
      <View style={s.header}>
        <TouchableOpacity
          style={s.vehicleBtn} activeOpacity={0.7}
          onPress={() => (state.vehicles.length > 1 ? setPickerOpen(true) : setSettingsOpen(true))}
        >
          <Ico d={vehicle.type === 'bike' ? I.bike : I.car} size={18} color={C.accent} />
          <Text style={s.vehicleTxt} numberOfLines={1}>{vehicle.name}</Text>
          {state.vehicles.length > 1 ? <Ico d={I.down} size={16} color={C.dim} /> : null}
        </TouchableOpacity>
      </View>
      <Text style={s.title}>{titles[tab]}</Text>

      <View style={{ flex: 1 }}>
        {tab === 'home' && <Home {...props} />}
        {tab === 'log' && <Log {...props} />}
        {tab === 'stats' && <Stats {...props} />}
      </View>

      <View style={s.tabbar}>
        {[['home', I.home, 'Overview'], ['log', I.list, 'Log'], ['add'], ['stats', I.chart, 'Stats'], ['set', I.gear, 'Settings']].map(([k, ic, l]) =>
          k === 'add' ? (
            <View key={k} style={s.tabBtn}>
              <TouchableOpacity style={s.fab} activeOpacity={0.85} onPress={() => openEditor(null)}>
                <Ico d={I.plus} size={26} color={C.bg} sw={2.4} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity key={k} style={s.tabBtn} activeOpacity={0.7}
              onPress={() => (k === 'set' ? setSettingsOpen(true) : setTab(k))}>
              <Ico d={ic} size={22} color={tab === k ? C.accent : C.faint} />
              <Text style={[s.tabTxt, tab === k && { color: C.accent }]}>{l}</Text>
            </TouchableOpacity>
          ),
        )}
      </View>

      <EntryModal
        visible={editor.open} entry={editor.entry} entries={entries} vehicle={vehicle} settings={state.settings}
        onClose={() => setEditor({ open: false, entry: null })}
        onSave={(e) => {
          setState((p) => ({ ...p, entries: [...p.entries.filter((x) => x.id !== e.id), e] }));
          setEditor({ open: false, entry: null });
        }}
        onDelete={(id) => {
          setState((p) => ({ ...p, entries: p.entries.filter((x) => x.id !== id) }));
          setEditor({ open: false, entry: null });
        }}
      />
      <SettingsModal visible={settingsOpen} state={state} setState={setState} onClose={() => setSettingsOpen(false)} />
      <VehiclePicker
        visible={pickerOpen} state={state} onClose={() => setPickerOpen(false)}
        onPick={(id) => { setState((p) => ({ ...p, activeId: id })); setPickerOpen(false); }}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  pad: { paddingHorizontal: 20, paddingTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 },
  vehicleBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.card, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14, maxWidth: W * 0.6 },
  vehicleTxt: { color: C.text, fontSize: 15, fontWeight: '500' },
  title: { color: C.text, fontSize: 34, fontWeight: '300', letterSpacing: -0.5, paddingHorizontal: 20, marginTop: 18, marginBottom: 14 },

  label: { color: C.dim, fontSize: 11, fontWeight: '600', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 },
  dimTxt: { color: C.dim, fontSize: 14, marginTop: 8, lineHeight: 20 },
  dimSmall: { color: C.dim, fontSize: 12.5 },
  hint: { color: C.faint, fontSize: 12.5, marginTop: 6, lineHeight: 18 },
  empty: { color: C.faint, fontSize: 13, paddingVertical: 50, textAlign: 'center' },

  heroBlock: { paddingTop: 6, paddingBottom: 26 },
  hero: { color: C.text, fontSize: 40, fontWeight: '200', marginTop: 18, letterSpacing: -0.5 },
  mega: { color: C.text, fontSize: 84, fontWeight: '200', letterSpacing: -3, lineHeight: 92 },
  megaUnit: { color: C.accent, fontSize: 20, fontWeight: '400', marginLeft: 10, marginTop: 34 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  stat: { width: (W - 40 - 10) / 2, backgroundColor: C.card, borderRadius: 18, padding: 16, paddingBottom: 18 },
  statVal: { color: C.text, fontSize: 24, fontWeight: '400', marginTop: 4 },
  statUnit: { color: C.dim, fontSize: 14 },

  card: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 10 },
  cardBig: { color: C.text, fontSize: 28, fontWeight: '300' },
  warnCard: { flexDirection: 'row', gap: 10, backgroundColor: '#2A1410', borderRadius: 14, padding: 14, marginBottom: 10, alignItems: 'flex-start' },
  warnTxt: { color: '#FFB4A2', fontSize: 13, lineHeight: 19, flex: 1 },

  listCard: { backgroundColor: C.card, borderRadius: 18, overflow: 'hidden' },
  monthHead: { color: C.text, fontSize: 15, fontWeight: '600' },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 12 },
  logRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  logMain: { color: C.text, fontSize: 16, fontWeight: '500' },
  logEff: { fontSize: 13, marginTop: 3, fontWeight: '500' },
  dot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  tag: { color: C.dim, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  flagTxt: { color: C.warn, fontSize: 12, marginTop: 4 },

  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  kvK: { color: C.dim, fontSize: 14 },
  kvV: { color: C.text, fontSize: 14.5, fontWeight: '500' },
  legend: { width: 8, height: 8, borderRadius: 2, marginRight: 5 },

  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipTxt: { color: C.dim, fontSize: 13.5, fontWeight: '500' },
  chipTxtOn: { color: C.bg, fontWeight: '600' },
  chipSm: { paddingVertical: 5, paddingHorizontal: 10 },

  fab: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', elevation: 6 },
  tabbar: { flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, backgroundColor: C.bg, paddingBottom: 10, paddingTop: 8 },
  tabBtn: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  tabTxt: { color: C.faint, fontSize: 10.5, fontWeight: '500' },

  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  modalTitle: { color: C.text, fontSize: 17, fontWeight: '600' },
  saveTxt: { color: C.accent, fontSize: 17, fontWeight: '600' },
  segment: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 14, padding: 4, marginBottom: 22 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  segOn: { backgroundColor: C.card2 },
  segTxt: { color: C.dim, fontSize: 14.5, fontWeight: '500' },
  segTxtOn: { color: C.text },

  field: { marginBottom: 18 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.line },
  input: { flex: 1, minWidth: 0, width: 0, color: C.text, fontSize: 22, fontWeight: '300', paddingVertical: 8 },
  bigInput: { flex: 0, width: '100%', fontSize: 30, borderBottomWidth: 1, borderBottomColor: C.line },
  suffix: { color: C.dim, fontSize: 15, marginLeft: 8 },
  stepBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: C.card, marginLeft: 6 },
  stepTxt: { color: C.dim, fontSize: 12.5, fontWeight: '500' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  toggleLabel: { color: C.text, fontSize: 15, flex: 1, paddingRight: 12 },
  toggle: { width: 46, height: 28, borderRadius: 14, backgroundColor: C.line, padding: 3 },
  toggleOn: { backgroundColor: C.accent },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.dim },
  knobOn: { backgroundColor: C.bg, transform: [{ translateX: 18 }] },
  hr: { height: StyleSheet.hairlineWidth, backgroundColor: C.line },

  primary: { backgroundColor: C.accent, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  primaryTxt: { color: C.bg, fontSize: 16, fontWeight: '700' },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, paddingVertical: 14, borderRadius: 14, backgroundColor: '#1F1210' },
  dangerTxt: { color: C.warn, fontSize: 15, fontWeight: '600' },

  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  sheetTxt: { color: C.text, fontSize: 17, flex: 1 },
});
