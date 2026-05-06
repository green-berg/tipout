import { useState, useCallback } from "react";

const fmt = (val) => val.toLocaleString("en-US", { style: "currency", currency: "USD" });

const hoursLabel = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
};

// Convert 12-hour + AM/PM to total minutes since midnight
const to24Mins = (h, m, ampm) => {
  let hours = parseInt(h || 0);
  const minutes = parseInt(m || 0);
  if (ampm === "AM" && hours === 12) hours = 0;
  if (ampm === "PM" && hours !== 12) hours += 12;
  return hours * 60 + minutes;
};

const EMPTY = { name: "", startH: "", startM: "", startAmPm: "PM", endH: "", endM: "", endAmPm: "PM" };

export default function TipSplit() {
  const [staff, setStaff] = useState([{ ...EMPTY }, { ...EMPTY }]);
  const [totalTips, setTotalTips] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  const update = (i, field, val) => {
    setStaff((p) => { const n = [...p]; n[i] = { ...n[i], [field]: val }; return n; });
    setResults(null); setError("");
  };

  const calculate = useCallback(() => {
    setError("");
    const tips = parseFloat(totalTips);
    if (!tips || tips <= 0) { setError("Enter a valid tip pool total."); return; }
    const rows = [];
    for (let i = 0; i < staff.length; i++) {
      const s = staff[i];
      if (!s.name.trim()) { setError(`Person ${i + 1} needs a name.`); return; }
      if (!s.startH || !s.endH) { setError(`${s.name || `Person ${i+1}`}: enter start and end times.`); return; }
      const startMins = to24Mins(s.startH, s.startM, s.startAmPm);
      const endMins = to24Mins(s.endH, s.endM, s.endAmPm);
      let mins = endMins - startMins;
      if (mins <= 0) mins += 1440; // overnight shift
      if (mins <= 0 || mins > 1440) { setError(`${s.name}: check times.`); return; }
      rows.push({ name: s.name.trim(), mins, startH: s.startH, startM: s.startM, startAmPm: s.startAmPm, endH: s.endH, endM: s.endM, endAmPm: s.endAmPm });
    }
    const totalMins = rows.reduce((a, b) => a + b.mins, 0);
    const computed = rows.map((r) => ({
      ...r,
      exact: r.mins * tips / totalMins,
      floored: Math.floor(r.mins * tips / totalMins)
    }));
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
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
        input[type=number] { -moz-appearance: textfield; }
        .field:focus { outline: none; border-color: #b8860b !important; box-shadow: 0 0 0 3px rgba(184,134,11,0.15); }
        .go-btn { transition: transform 0.1s, background 0.15s; }
        .go-btn:active { transform: scale(0.97); }
        .ampm-btn { transition: all 0.15s; }
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
        </div>
      </div>

      <div style={{ padding: "24px 16px", maxWidth: 480, margin: "0 auto" }}>

        {/* Tip Pool Input */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "20px", marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <label style={{ display: "block", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9a8f7a", fontWeight: 600, marginBottom: 10 }}>Total Tips Collected</label>
          <div style={{ display: "flex", alignItems: "center", background: "#f5f0e8", borderRadius: 10, border: "2px solid #e8e0d0", overflow: "hidden" }}>
            <span style={{ padding: "0 14px", fontSize: 22, color: "#b8860b", fontWeight: 600, fontFamily: "'Fraunces', serif" }}>$</span>
            <input
              className="field"
              inputMode="decimal"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={totalTips}
              onChange={(e) => { setTotalTips(e.target.value); setResults(null); setError(""); }}
              style={{ flex: 1, background: "transparent", border: "none", padding: "16px 14px 16px 0", fontSize: 28, color: "#1a1814", fontWeight: 600, width: "100%", outline: "none" }}
            />
          </div>
        </div>

        {/* Staff Cards */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, padding: "0 2px" }}>
            <span style={{ fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9a8f7a", fontWeight: 600 }}>Staff · {staff.length} people</span>
            <button
              onClick={() => { setStaff((p) => [...p, { ...EMPTY }]); setResults(null); }}
              style={{ background: "#b8860b", color: "#fff", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", letterSpacing: "0.05em" }}
            >+ Add</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {staff.map((s, i) => (
              <div key={i} className="row-in" style={{ background: "#fff", borderRadius: 14, padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", border: "1.5px solid #ede7d9" }}>
                {/* Name row */}
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                  <input
                    className="field"
                    placeholder="Name"
                    value={s.name}
                    onChange={(e) => update(i, "name", e.target.value)}
                    style={{ flex: 1, background: "#f5f0e8", border: "2px solid #e8e0d0", borderRadius: 10, padding: "12px 14px", fontSize: 15, fontWeight: 500, color: "#1a1814" }}
                  />
                  {staff.length > 1 && (
                    <button
                      onClick={() => { setStaff((p) => p.filter((_, idx) => idx !== i)); setResults(null); }}
                      style={{ background: "#f5f0e8", border: "none", borderRadius: 10, width: 42, height: 42, fontSize: 18, color: "#c8a070", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >×</button>
                  )}
                </div>
                {/* Time row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 20px 1fr", gap: 8, alignItems: "end" }}>
                  <TimeBlock
                    label="Clock In"
                    h={s.startH} m={s.startM} ampm={s.startAmPm}
                    onH={(v) => update(i, "startH", v)}
                    onM={(v) => update(i, "startM", v)}
                    onAmPm={(v) => update(i, "startAmPm", v)}
                  />
                  <div style={{ textAlign: "center", color: "#c8a070", fontSize: 14, paddingBottom: 14 }}>→</div>
                  <TimeBlock
                    label="Clock Out"
                    h={s.endH} m={s.endM} ampm={s.endAmPm}
                    onH={(v) => update(i, "endH", v)}
                    onM={(v) => update(i, "endM", v)}
                    onAmPm={(v) => update(i, "endAmPm", v)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background: "#fff0f0", border: "1.5px solid #f0c0c0", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#c04040", marginBottom: 12 }}>
            {error}
          </div>
        )}

        {/* Calculate Button */}
        <button
          className="go-btn"
          onClick={calculate}
          style={{ width: "100%", background: "#1a1814", color: "#f5f0e8", border: "none", borderRadius: 14, padding: "18px", fontSize: 15, fontWeight: 600, cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 24 }}
        >Calculate Split</button>

        {/* Results */}
        {results && (
          <div className="pop">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: "#1a1814" }}>Results</span>
              <span style={{ flex: 1, height: 1, background: "#e8e0d0" }} />
              <span style={{ fontSize: 11, color: "#9a8f7a" }}>{hoursLabel(results.totalMins)} total</span>
            </div>

            {/* Result Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {results.computed.map((r, i) => (
                <div key={i} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 1px 6px rgba(0,0,0,0.05)", border: "1.5px solid #ede7d9" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1814", marginBottom: 3 }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "#9a8f7a", marginBottom: 2 }}>
                      {fmtTime(r.startH, r.startM, r.startAmPm)} → {fmtTime(r.endH, r.endM, r.endAmPm)}
                    </div>
                    <div style={{ fontSize: 12, color: "#b8a898" }}>{hoursLabel(r.mins)} · {fmt(r.exact)} exact</div>
                  </div>
                  <div style={{ fontSize: 28, fontFamily: "'Fraunces', serif", fontWeight: 700, color: "#b8860b", marginLeft: 12 }}>${r.floored}</div>
                </div>
              ))}
            </div>

            {/* Summary Bar */}
            <div style={{ background: "#1a1814", borderRadius: 14, padding: "18px 20px", display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: 0 }}>
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
          </div>
        )}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

function TimeBlock({ label, h, m, ampm, onH, onM, onAmPm }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "#9a8f7a", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {/* HH:MM */}
      <div style={{ display: "flex", alignItems: "center", background: "#f5f0e8", border: "2px solid #e8e0d0", borderRadius: 10, overflow: "hidden", marginBottom: 6 }}>
        <input
          className="field"
          inputMode="numeric"
          type="number"
          min="1" max="12"
          placeholder="HH"
          value={h}
          onChange={(e) => onH(e.target.value)}
          style={{ flex: 1, background: "transparent", border: "none", padding: "11px 4px 11px 8px", fontSize: 16, fontWeight: 500, color: "#1a1814", width: "45%", outline: "none", textAlign: "center" }}
        />
        <span style={{ color: "#c8a070", fontSize: 16, fontWeight: 300 }}>:</span>
        <input
          className="field"
          inputMode="numeric"
          type="number"
          min="0" max="59"
          placeholder="MM"
          value={m}
          onChange={(e) => onM(e.target.value)}
          style={{ flex: 1, background: "transparent", border: "none", padding: "11px 8px 11px 4px", fontSize: 16, fontWeight: 500, color: "#1a1814", width: "45%", outline: "none", textAlign: "center" }}
        />
      </div>
      {/* AM / PM toggle */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
        {["AM", "PM"].map((val) => (
          <button
            key={val}
            className="ampm-btn"
            onClick={() => onAmPm(val)}
            style={{
              border: "2px solid",
              borderColor: ampm === val ? "#b8860b" : "#e8e0d0",
              background: ampm === val ? "#b8860b" : "#f5f0e8",
              color: ampm === val ? "#fff" : "#9a8f7a",
              borderRadius: 8,
              padding: "8px 0",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.08em",
            }}
          >{val}</button>
        ))}
      </div>
    </div>
  );
}