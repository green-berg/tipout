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
const ITEM_H = 44;
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

// Drum roll picker column
function PickerColumn({ items, value, onChange, width }) {
  const ref = useRef(null);
  const idx = items.indexOf(String(value));
  const startY = useRef(0);
  const startScroll = useRef(0);
  const isDragging = useRef(false);
  const velocity = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const animFrame = useRef(null);

  // Sync scroll position to value
  useEffect(() => {
    if (ref.current && !isDragging.current) {
      ref.current.scrollTop = idx * ITEM_H;
    }
  }, [idx]);

  const snapToNearest = () => {
    if (!ref.current) return;
    const rawIdx = ref.current.scrollTop / ITEM_H;
    const snapped = Math.round(rawIdx);
    const clamped = Math.max(0, Math.min(items.length - 1, snapped));
    ref.current.scrollTop = clamped * ITEM_H;
    onChange(items[clamped]);
  };

  const applyMomentum = () => {
    if (!ref.current) return;
    if (Math.abs(velocity.current) < 0.5) { snapToNearest(); return; }
    ref.current.scrollTop += velocity.current;
    velocity.current *= 0.92;
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
    if (dt > 0) velocity.current = (lastY.current - e.touches[0].clientY) / dt * 16;
    lastY.current = e.touches[0].clientY;
    lastTime.current = now;
  };

  const onTouchEnd = () => {
    isDragging.current = false;
    animFrame.current = requestAnimationFrame(applyMomentum);
  };

  const onScroll = () => {
    if (!isDragging.current) snapToNearest();
  };

  return (
    <div style={{ position: "relative", width, height: ITEM_H * 5, overflow: "hidden", cursor: "grab" }}>
      {/* Selection highlight */}
      <div style={{
        position: "absolute", top: "50%", left: 0, right: 0,
        height: ITEM_H, transform: "translateY(-50%)",
        borderTop: "1px solid #c8a070", borderBottom: "1px solid #c8a070",
        pointerEvents: "none", zIndex: 2
      }} />
      {/* Top/bottom fade */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: ITEM_H * 2, background: "linear-gradient(to bottom, rgba(245,240,232,0.95), rgba(245,240,232,0))", pointerEvents: "none", zIndex: 2 }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: ITEM_H * 2, background: "linear-gradient(to top, rgba(245,240,232,0.95), rgba(245,240,232,0))", pointerEvents: "none", zIndex: 2 }} />
      {/* Scrollable list */}
      <div
        ref={ref}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onScroll={onScroll}
        style={{
          height: "100%", overflowY: "scroll", scrollbarWidth: "none",
          paddingTop: ITEM_H * 2, paddingBottom: ITEM_H * 2,
          WebkitOverflowScrolling: "touch",
        }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
        {items.map((item) => (
          <div key={item} style={{
            height: ITEM_H, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: String(value) === item ? 600 : 400,
            color: String(value) === item ? "#1a1814" : "#9a8f7a",
            fontFamily: "'DM Sans', sans-serif", userSelect: "none",
          }}>{item}</div>
        ))}
      </div>
    </div>
  );
}

// Full time picker (H : MM AM/PM)
function TimePicker({ label, h, m, ampm, onH, onM, onAmPm }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9a8f7a", fontWeight: 600, marginBottom: 8, textAlign: "center" }}>{label}</div>
      <div style={{ background: "#f5f0e8", borderRadius: 14, border: "2px solid #e8e0d0", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", gap: 0 }}>
        <PickerColumn items={HOURS} value={h || "5"} onChange={onH} width={56} />
        <div style={{ fontSize: 22, fontWeight: 600, color: "#c8a070", paddingBottom: 2, flexShrink: 0 }}>:</div>
        <PickerColumn items={MINUTES} value={m || "00"} onChange={onM} width={56} />
        <div style={{ width: 1, height: ITEM_H * 3, background: "#e8e0d0", flexShrink: 0, margin: "0 4px" }} />
        <PickerColumn items={AMPM} value={ampm} onChange={onAmPm} width={52} />
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
    const computed = rows.map((r) => ({ ...r, exact: r.mins * tips / totalMins, floored: Math.floor(r.mins * tips / totalMins) }));
    const distributed = computed.reduce((a, b) => a + b.floored, 0);
    setResults({ computed, distributed, remainder: tips - distributed, totalMins });
  }, [staff, totalTips]);

  const fmtTime = (h, m, ampm) => `${h || "–"}:${(m || "00").toString().padStart(2, "0")} ${ampm}`;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f0e8", fontFamily: "'DM Sans', sans-serif", color: "#1a1814" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Fraunces:ital,wght@0,700;0,900;1,700&display=swap');
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
      <div style={{ background: "#1a1814", padding: "24px 20px 20px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 900, color: "#f5f0e8", letterSpacing: "-0.5px" }}>TipSplit</span>
            <span style={{ fontSize: 11, color: "#b8860b", letterSpacing: "0.2em", textTransform: "uppercase", marginLeft: 10, fontWeight: 500 }}>Pool Calculator</span>
          </div>
          <button onClick={reset} style={{ background: "none", border: "1px solid #3e3a32", color: "#7a7163", borderRadius: 8, padding: "6px 12px", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Reset</button>
        </div>
      </div>

      <div style={{ padding: "24px 16px", maxWidth: 480, margin: "0 auto" }}>

        {/* Tip Pool */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <label style={{ display: "block", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9a8f7a", fontWeight: 600, marginBottom: 10 }}>Total Tips Collected</label>
          <div style={{ display: "flex", alignItems: "center", background: "#f5f0e8", borderRadius: 10, border: "2px solid #e8e0d0", overflow: "hidden" }}>
            <span style={{ padding: "0 14px", fontSize: 22, color: "#b8860b", fontWeight: 600, fontFamily: "'Fraunces', serif" }}>$</span>
            <input className="field" inputMode="decimal" type="number" min="0" step="0.01" placeholder="0.00" value={totalTips}
              onChange={(e) => { setTotalTips(e.target.value); setResults(null); setError(""); }}
              style={{ flex: 1, background: "transparent", border: "none", padding: "16px 14px 16px 0", fontSize: 28, color: "#1a1814", fontWeight: 600, width: "100%", outline: "none" }} />
          </div>
        </div>

        {/* Staff */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 2px" }}>
            <span style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9a8f7a", fontWeight: 600 }}>Staff · {staff.length} people</span>
            <button onClick={() => { setStaff((p) => [...p, { ...EMPTY }]); setResults(null); }}
              style={{ background: "#b8860b", color: "#fff", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", letterSpacing: "0.05em" }}>+ Add</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {staff.map((s, i) => (
              <div key={i} className="row-in" style={{ background: "#fff", borderRadius: 14, padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1.5px solid #ede7d9" }}>
                {/* Name */}
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
                  <input className="field" placeholder="Name" value={s.name} onChange={(e) => update(i, "name", e.target.value)}
                    style={{ flex: 1, background: "#f5f0e8", border: "2px solid #e8e0d0", borderRadius: 10, padding: "12px 14px", fontSize: 15, fontWeight: 500, color: "#1a1814" }} />
                  {staff.length > 1 && (
                    <button onClick={() => { setStaff((p) => p.filter((_, idx) => idx !== i)); setResults(null); }}
                      style={{ background: "#f5f0e8", border: "none", borderRadius: 10, width: 42, height: 42, fontSize: 18, color: "#c8a070", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  )}
                </div>
                {/* Pickers */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr", gap: 8, alignItems: "center" }}>
                  <TimePicker label="Clock In" h={s.startH} m={s.startM} ampm={s.startAmPm}
                    onH={(v) => update(i, "startH", v)} onM={(v) => update(i, "startM", v)} onAmPm={(v) => update(i, "startAmPm", v)} />
                  <div style={{ textAlign: "center", color: "#c8a070", fontSize: 16, marginTop: 20 }}>→</div>
                  <TimePicker label="Clock Out" h={s.endH} m={s.endM} ampm={s.endAmPm}
                    onH={(v) => update(i, "endH", v)} onM={(v) => update(i, "endM", v)} onAmPm={(v) => update(i, "endAmPm", v)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ background: "#fff0f0", border: "1.5px solid #f0c0c0", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#c04040", marginBottom: 12 }}>{error}</div>
        )}

        <button className="go-btn" onClick={calculate}
          style={{ width: "100%", background: "#1a1814", color: "#f5f0e8", border: "none", borderRadius: 14, padding: "18px", fontSize: 15, fontWeight: 600, cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 24, transition: "transform 0.1s" }}>
          Calculate Split
        </button>

        {results && (
          <div className="pop">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: "#1a1814" }}>Results</span>
              <span style={{ flex: 1, height: 1, background: "#e8e0d0" }} />
              <span style={{ fontSize: 11, color: "#9a8f7a" }}>{hoursLabel(results.totalMins)} total</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {results.computed.map((r, i) => (
                <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", border: "1.5px solid #ede7d9" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1814", marginBottom: 3 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "#9a8f7a", marginBottom: 2 }}>{fmtTime(r.startH, r.startM, r.startAmPm)} → {fmtTime(r.endH, r.endM, r.endAmPm)}</div>
                    <div style={{ fontSize: 12, color: "#b8a898" }}>{hoursLabel(r.mins)} · {fmt(r.exact)} exact</div>
                  </div>
                  <div style={{ fontSize: 28, fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#b8860b", marginLeft: 12 }}>${r.floored}</div>
                </div>
              ))}
            </div>
            <div style={{ background: "#1a1814", borderRadius: 14, padding: "18px 20px", display: "grid", gridTemplateColumns: "1fr 1px 1fr", marginBottom: 16 }}>
              <div style={{ textAlign: "center", paddingRight: 16 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", marginBottom: 6 }}>Distributed</div>
                <div style={{ fontSize: 26, fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#f5f0e8" }}>${results.distributed}</div>
              </div>
              <div style={{ background: "#2e2a22", width: 1 }} />
              <div style={{ textAlign: "center", paddingLeft: 16 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6a6050", marginBottom: 6 }}>Remainder</div>
                <div style={{ fontSize: 26, fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#b8860b" }}>{fmt(results.remainder)}</div>
              </div>
            </div>
            <button onClick={reset} style={{ width: "100%", background: "none", border: "1.5px solid #e8e0d0", color: "#9a8f7a", borderRadius: 14, padding: "14px", fontSize: 13, fontWeight: 600, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
              Start New Event
            </button>
          </div>
        )}
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}