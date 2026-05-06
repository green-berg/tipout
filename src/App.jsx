import { useState, useCallback, useEffect, useRef } from "react";

const fmt = (val) => val.toLocaleString("en-US", { style: "currency", currency: "USD" });
const hoursLabel = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
};
const to24Mins = (h, m, ampm) => {
  let hours = parseInt(h || 12);
  const minutes = parseInt(m || 0);
  if (ampm === "AM" && hours === 12) hours = 0;
  if (ampm === "PM" && hours !== 12) hours += 12;
  return hours * 60 + minutes;
};

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const AMPM = ["AM", "PM"];
const ITEM_H = 28;
const VISIBLE = 3;
const LOOPS = 20; // number of times we repeat the list for infinite feel

const EMPTY = { name: "", startH: "5", startM: "00", startAmPm: "PM", endH: "10", endM: "00", endAmPm: "PM" };
const DEFAULT_STAFF = [{ ...EMPTY }, { ...EMPTY }];
const STORAGE_KEY = "tipsplit_session";
const RESET_AFTER_MS = 10 * 60 * 1000;

const loadSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { timestamp, staff, totalTips } = JSON.parse(raw);
    if (Date.now() - timestamp > RESET_AFTER_MS) { localStorage.removeItem(STORAGE_KEY); return null; }
    return { staff, totalTips };
  } catch { return null; }
};
const saveSession = (staff, totalTips) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now(), staff, totalTips })); } catch {}
};
const clearSession = () => { try { localStorage.removeItem(STORAGE_KEY); } catch {} };

function PickerColumn({ items, value, onChange, width, loop = false }) {
  const ref = useRef(null);
  const isDragging = useRef(false);
  const velocity = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const startY = useRef(0);
  const startScroll = useRef(0);
  const animFrame = useRef(null);
  const initialized = useRef(false);

  const repeated = loop ? Array.from({ length: LOOPS }, () => items).flat() : items;
  const totalItems = repeated.length;

  // For looping: start in the middle of the repeated list
  const getInitialScroll = (val) => {
    const baseIdx = items.indexOf(String(val));
    const safeIdx = baseIdx < 0 ? 0 : baseIdx;
    if (loop) {
      // Start near the middle loop
      const middleLoop = Math.floor(LOOPS / 2);
      return (middleLoop * items.length + safeIdx) * ITEM_H;
    }
    return safeIdx * ITEM_H;
  };

  useEffect(() => {
    if (ref.current && !initialized.current) {
      ref.current.scrollTop = getInitialScroll(value);
      initialized.current = true;
    }
  }, []);

  // When value changes externally, sync scroll without animation
  const prevValue = useRef(value);
  useEffect(() => {
    if (value !== prevValue.current && ref.current && !isDragging.current) {
      ref.current.scrollTop = getInitialScroll(value);
      prevValue.current = value;
    }
  }, [value]);

  const getCurrentValue = () => {
    if (!ref.current) return value;
    const rawIdx = Math.round(ref.current.scrollTop / ITEM_H);
    const clamped = Math.max(0, Math.min(totalItems - 1, rawIdx));
    return repeated[clamped];
  };

  const snapToNearest = () => {
    if (!ref.current) return;
    const rawIdx = ref.current.scrollTop / ITEM_H;
    const snapped = Math.max(0, Math.min(totalItems - 1, Math.round(rawIdx)));
    ref.current.scrollTop = snapped * ITEM_H;
    const newVal = repeated[snapped];
    onChange(newVal);

    // Re-center if near the edges (looping only)
    if (loop) {
      const itemsLen = items.length;
      const currentIdx = items.indexOf(String(newVal));
      const middleLoop = Math.floor(LOOPS / 2);
      const middleScroll = (middleLoop * itemsLen + currentIdx) * ITEM_H;
      // Silently jump to middle if too close to edges
      if (snapped < itemsLen * 2 || snapped > totalItems - itemsLen * 2) {
        ref.current.scrollTop = middleScroll;
      }
    }
  };

  const applyMomentum = () => {
    if (!ref.current) return;
    if (Math.abs(velocity.current) < 0.5) { snapToNearest(); return; }
    ref.current.scrollTop += velocity.current;
    velocity.current *= 0.9;
    animFrame.current = requestAnimationFrame(applyMomentum);
  };

  const onTouchStart = (e) => {
    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    startScroll.current = ref.current.scrollTop;
    lastY.current = e.touches[0].clientY;
    lastTime.current = Date.now();
    velocity.current = 0;
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
  };

  const onTouchMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const dy = startY.current - e.touches[0].clientY;
    ref.current.scrollTop = startScroll.current + dy;
    const now = Date.now();
    const dt = now - lastTime.current;
    if (dt > 0) velocity.current = (lastY.current - e.touches[0].clientY) / dt * 14;
    lastY.current = e.touches[0].clientY;
    lastTime.current = now;
  };

  const onTouchEnd = () => {
    isDragging.current = false;
    animFrame.current = requestAnimationFrame(applyMomentum);
  };

  const totalH = ITEM_H * VISIBLE;

  return (
    <div style={{ position: "relative", width, height: totalH, overflow: "hidden", flexShrink: 0 }}>
      <div style={{
        position: "absolute", top: "50%", left: 0, right: 0,
        height: ITEM_H, transform: "translateY(-50%)",
        borderTop: "1px solid #c8a070", borderBottom: "1px solid #c8a070",
        pointerEvents: "none", zIndex: 2
      }} />
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: ITEM_H, background: "linear-gradient(to bottom, rgba(245,240,232,0.95), rgba(245,240,232,0))", pointerEvents: "none", zIndex: 2 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: ITEM_H, background: "linear-gradient(to top, rgba(245,240,232,0.95), rgba(245,240,232,0))", pointerEvents: "none", zIndex: 2 }} />
      <div
        ref={ref}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          height: "100%", overflowY: "scroll", scrollbarWidth: "none",
          paddingTop: ITEM_H, paddingBottom: ITEM_H,
          WebkitOverflowScrolling: "touch",
        }}
      >
        <style>{`div::-webkit-scrollbar{display:none}`}</style>
        {repeated.map((item, i) => (
          <div key={i} style={{
            height: ITEM_H, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14,
            fontWeight: String(value) === item ? 700 : 400,
            color: String(value) === item ? "#1a1814" : "#b8a898",
            fontFamily: "'DM Sans', sans-serif",
            userSelect: "none",
          }}>{item}</div>
        ))}
      </div>
    </div>
  );
}

function TimePicker({ label, h, m, ampm, onH, onM, onAmPm }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9a8f7a", fontWeight: 600, marginBottom: 4, textAlign: "center" }}>{label}</div>
      <div style={{ background: "#f5f0e8", borderRadius: 10, border: "1.5px solid #e8e0d0", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", gap: 2 }}>
        <PickerColumn items={HOURS} value={h || "5"} onChange={onH} width={30} loop={true} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#c8a070", flexShrink: 0, marginBottom: 1 }}>:</div>
        <PickerColumn items={MINUTES} value={m || "00"} onChange={onM} width={30} loop={true} />
        <div style={{ width: 1, height: ITEM_H * 2, background: "#e8e0d0", flexShrink: 0, margin: "0 2px" }} />
        <PickerColumn items={AMPM} value={ampm} onChange={onAmPm} width={32} loop={false} />
      </div>
    </div>
  );
}

export default function TipSplit() {
  const saved = loadSession();
  const [staff, setStaff] = useState(saved?.staff || DEFAULT_STAFF.map(e => ({ ...e })));
  const [totalTips, setTotalTips] = useState(saved?.totalTips || "");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { saveSession(staff, totalTips); }, [staff, totalTips]);
  useEffect(() => {
    const fn = () => { if (document.visibilityState === "hidden") saveSession(staff, totalTips); };
    document.addEventListener("visibilitychange", fn);
    return () => document.removeEventListener("visibilitychange", fn);
  }, [staff, totalTips]);

  const update = (i, field, val) => {
    setStaff((p) => { const n = [...p]; n[i] = { ...n[i], [field]: val }; return n; });
    setResults(null); setError("");
  };

  const reset = () => {
    setStaff(DEFAULT_STAFF.map(e => ({ ...e })));
    setTotalTips(""); setResults(null); setError(""); clearSession();
  };

  const calculate = useCallback(() => {
    setError("");
    const tips = parseFloat(totalTips);
    if (!tips || tips <= 0) { setError("Enter a valid tip pool total."); return; }
    const rows = [];
    for (let i = 0; i < staff.length; i++) {
      const s = staff[i];
      if (!s.name.trim()) { setError(`Person ${i + 1} needs a name.`); return; }
      const startMins = to24Mins(s.startH, s.startM, s.startAmPm);
      const endMins = to24Mins(s.endH, s.endM, s.endAmPm);
      let mins = endMins - startMins;
      if (mins <= 0) mins += 1440;
      if (mins <= 0 || mins > 1440) { setError(`${s.name}: check times.`); return; }
      rows.push({ name: s.name.trim(), mins, startH: s.startH, startM: s.startM, startAmPm: s.startAmPm, endH: s.endH, endM: s.endM, endAmPm: s.endAmPm });
    }
    const totalMins = rows.reduce((a, b) => a + b.mins, 0);
    let computed = rows.map((r) => ({ ...r, exact: r.mins * tips / totalMins, rounded: Math.round(r.mins * tips / totalMins) }));
    // If standard rounding causes total to exceed pool, nudge highest earner(s) down by $1 until balanced
    let distributed = computed.reduce((a, b) => a + b.rounded, 0);
    while (distributed > tips) {
      const maxIdx = computed.reduce((bestI, r, i, arr) => r.rounded > arr[bestI].rounded ? i : bestI, 0);
      computed = computed.map((r, i) => i === maxIdx ? { ...r, rounded: r.rounded - 1 } : r);
      distributed -= 1;
    }
    setResults({ computed, distributed, remainder: tips - distributed, totalMins });
  }, [staff, totalTips]);

  const fmtTime = (h, m, ampm) => `${h || "–"}:${(m || "00").toString().padStart(2, "0")} ${ampm}`;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f0e8", fontFamily: "'DM Sans', sans-serif", color: "#1a1814" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Fraunces:ital,wght@0,700;0,900;1,700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input, button { font-family: 'DM Sans', sans-serif; -webkit-tap-highlight-color: transparent; }
        input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
        .field:focus { outline: none; border-color: #b8860b !important; box-shadow: 0 0 0 3px rgba(184,134,11,0.15); }
        .go-btn:active { transform: scale(0.97); }
        @keyframes pop { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .pop { animation: pop 0.3s cubic-bezier(.34,1.56,.64,1) forwards; }
        @keyframes rowIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
        .row-in { animation: rowIn 0.2s ease forwards; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#1a1814", padding: "20px 20px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 900, color: "#f5f0e8", letterSpacing: "-0.5px" }}>TipSplit</span>
            <span style={{ fontSize: 10, color: "#b8860b", letterSpacing: "0.2em", textTransform: "uppercase", marginLeft: 10, fontWeight: 500 }}>Pool Calculator</span>
          </div>
          <button onClick={reset} style={{ background: "none", border: "1px solid #3e3a32", color: "#7a7163", borderRadius: 8, padding: "5px 10px", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Reset</button>
        </div>
      </div>

      <div style={{ padding: "16px 14px", maxWidth: 480, margin: "0 auto" }}>

        {/* Tip Pool */}
        <div style={{ background: "#fff", borderRadius: 14, padding: "16px", marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <label style={{ display: "block", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9a8f7a", fontWeight: 600, marginBottom: 8 }}>Total Cash Tips Collected</label>
          <div style={{ display: "flex", alignItems: "center", background: "#f5f0e8", borderRadius: 10, border: "2px solid #e8e0d0", overflow: "hidden" }}>
            <span style={{ padding: "0 12px", fontSize: 20, color: "#b8860b", fontWeight: 600, fontFamily: "'Fraunces', serif" }}>$</span>
            <input className="field" inputMode="decimal" type="number" min="0" step="0.01" placeholder="0.00" value={totalTips}
              onChange={(e) => { setTotalTips(e.target.value); setResults(null); setError(""); }}
              style={{ flex: 1, background: "transparent", border: "none", padding: "12px 12px 12px 0", fontSize: 26, color: "#1a1814", fontWeight: 600, width: "100%", outline: "none" }} />
          </div>
        </div>

        {/* Staff */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, padding: "0 2px" }}>
            <span style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9a8f7a", fontWeight: 600 }}>Staff · {staff.length} people</span>
            <button onClick={() => { setStaff((p) => [...p, { ...EMPTY }]); setResults(null); }}
              style={{ background: "#b8860b", color: "#fff", border: "none", borderRadius: 20, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", letterSpacing: "0.05em" }}>+ Add</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {staff.map((s, i) => (
              <div key={i} className="row-in" style={{ background: "#fff", borderRadius: 12, padding: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1.5px solid #ede7d9" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <input className="field" placeholder="Name" value={s.name} onChange={(e) => update(i, "name", e.target.value)}
                    style={{ flex: 1, background: "#f5f0e8", border: "2px solid #e8e0d0", borderRadius: 8, padding: "9px 12px", fontSize: 14, fontWeight: 500, color: "#1a1814" }} />
                  {staff.length > 1 && (
                    <button onClick={() => { setStaff((p) => p.filter((_, idx) => idx !== i)); setResults(null); }}
                      style={{ background: "#f5f0e8", border: "none", borderRadius: 8, width: 36, height: 36, fontSize: 16, color: "#c8a070", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 16px 1fr", gap: 6, alignItems: "center" }}>
                  <TimePicker label="Clock In" h={s.startH} m={s.startM} ampm={s.startAmPm}
                    onH={(v) => update(i, "startH", v)} onM={(v) => update(i, "startM", v)} onAmPm={(v) => update(i, "startAmPm", v)} />
                  <div style={{ textAlign: "center", color: "#c8a070", fontSize: 12, marginTop: 14 }}>→</div>
                  <TimePicker label="Clock Out" h={s.endH} m={s.endM} ampm={s.endAmPm}
                    onH={(v) => update(i, "endH", v)} onM={(v) => update(i, "endM", v)} onAmPm={(v) => update(i, "endAmPm", v)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ background: "#fff0f0", border: "1.5px solid #f0c0c0", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#c04040", marginBottom: 10 }}>{error}</div>
        )}

        <button className="go-btn" onClick={calculate}
          style={{ width: "100%", background: "#1a1814", color: "#f5f0e8", border: "none", borderRadius: 12, padding: "16px", fontSize: 14, fontWeight: 600, cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 20, transition: "transform 0.1s" }}>
          Calculate Split
        </button>

        {results && (
          <div className="pop">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: "#1a1814" }}>Results</span>
              <span style={{ flex: 1, height: 1, background: "#e8e0d0" }} />
              <span style={{ fontSize: 10, color: "#9a8f7a" }}>{hoursLabel(results.totalMins)} total</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {results.computed.map((r, i) => (
                <div key={i} style={{ background: "#fff", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", border: "1.5px solid #ede7d9" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1814", marginBottom: 2 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: "#9a8f7a", marginBottom: 1 }}>{fmtTime(r.startH, r.startM, r.startAmPm)} → {fmtTime(r.endH, r.endM, r.endAmPm)}</div>
                    <div style={{ fontSize: 11, color: "#b8a898" }}>{hoursLabel(r.mins)} · {fmt(r.exact)} exact</div>
                  </div>
                  <div style={{ fontSize: 26, fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#b8860b", marginLeft: 12 }}>${r.rounded}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#1a1814", borderRadius: 12, padding: "16px 18px", display: "grid", gridTemplateColumns: "1fr 1px 1fr", marginBottom: 12 }}>
              <div style={{ textAlign: "center", paddingRight: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", marginBottom: 4 }}>Distributed</div>
                <div style={{ fontSize: 24, fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#f5f0e8" }}>${results.distributed}</div>
              </div>
              <div style={{ background: "#2e2a22", width: 1 }} />
              <div style={{ textAlign: "center", paddingLeft: 14 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", marginBottom: 4 }}>Remainder</div>
                <div style={{ fontSize: 24, fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#b8860b" }}>{fmt(results.remainder)}</div>
              </div>
            </div>
            <button onClick={reset} style={{ width: "100%", background: "none", border: "1.5px solid #e8e0d0", color: "#9a8f7a", borderRadius: 12, padding: "12px", fontSize: 12, fontWeight: 600, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
              Start New Event
            </button>
          </div>
        )}
        <div style={{ height: 32 }} />
      </div>
    </div>
  );
}