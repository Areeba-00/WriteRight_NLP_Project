import { useEffect, useState } from "react";
import NetworkNerAnalysis from "./NetworkNerAnalysis";
import "./NetworkNerDashboard.css";

const API_BASE = "http://localhost:8000";

const LABEL_META = {
  SOURCE_NODE:       { color: "#3b82f6", short: "SRC" },
  DESTINATION_NODE:  { color: "#10b981", short: "DST" },
  INTERMEDIATE_NODE: { color: "#f59e0b", short: "MID" },
  BANDWIDTH:         { color: "#8b5cf6", short: "BW"  },
  PACKET_LOSS:       { color: "#ef4444", short: "PL"  },
};

const SLOT_LABELS = {
  source_node:       "Source Node",
  destination_node:  "Destination Node",
  intermediate_node: "Intermediate Node",
  bandwidth:         "Bandwidth",
  packet_loss:       "Packet Loss",
};

const EXAMPLES = [
  "Configure traffic from Router A to Router D through Router B with bandwidth 100 Mbps and packet loss below 2%.",
  "Send data from Node 1 to Node 5 via Node 3 with 50 Mbps bandwidth and 1% packet loss.",
  "Connect Host A to Server Beta with packet loss less than 0.5%.",
  "Route packets from Switch A to Server B via Firewall 1 at 1 Gbps with packet loss under 1%.",
];

function HighlightedText({ text, entities }) {
  if (!entities || entities.length === 0) return <span>{text}</span>;
  const sorted = [...entities].sort((a, b) => a.start - b.start);
  const out = [];
  let cursor = 0;
  sorted.forEach((ent, i) => {
    if (ent.start > cursor) {
      out.push(<span key={`t-${i}`}>{text.slice(cursor, ent.start)}</span>);
    }
    const meta = LABEL_META[ent.label] ?? { color: "#666", short: "?" };
    out.push(
      <span
        key={`e-${i}`}
        className="ner-ent"
        style={{ backgroundColor: `${meta.color}22`, borderBottom: `2px solid ${meta.color}` }}
        title={ent.label}
      >
        {text.slice(ent.start, ent.end)}
        <sup className="ner-tag" style={{ color: meta.color }}>{meta.short}</sup>
      </span>
    );
    cursor = ent.end;
  });
  if (cursor < text.length) out.push(<span key="t-tail">{text.slice(cursor)}</span>);
  return <>{out}</>;
}

function StructuredTable({ structured, diffSlots = new Set() }) {
  return (
    <table className="ner-table">
      <tbody>
        {Object.entries(SLOT_LABELS).map(([slot, label]) => {
          const value = structured?.[slot];
          const isDiff = diffSlots.has(slot);
          return (
            <tr key={slot} className={isDiff ? "ner-row-diff" : ""}>
              <td className="ner-slot-label">{label}</td>
              <td className="ner-slot-value">
                {value ? value : <span className="ner-empty">- not found -</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function NetworkNerDashboard({ editorText = "" }) {
  const [text, setText] = useState(EXAMPLES[0]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/network-ner/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ rule_based: "ok", model_based: "unknown" }));
  }, []);

  const handleUseEditor = () => {
    if (editorText && editorText.trim()) setText(editorText);
  };

  const handleExtract = async () => {
    if (!text.trim()) { setError("Please enter some network configuration text."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`${API_BASE}/extract-network-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      setResult(await res.json());
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const diffSlots = new Set(
    result?.agreement?.differences?.map((d) => d.slot) ?? []
  );

  const modelAvailable = result?.model_based != null;

  return (
    <div className="ner-dashboard">
      <header className="ner-header">
        <div>
          <h2>Network Intent Extraction</h2>
          <p className="ner-sub">
            Side-by-side comparison: rule-based regex vs fine-tuned spaCy NER model.
          </p>
        </div>
        {health && (
          <div className="ner-health">
            <span className={`ner-pill ${health.rule_based === "ok" ? "ok" : "bad"}`}>
              Rule-based: {health.rule_based}
            </span>
            <span className={`ner-pill ${health.model_based === "ok" ? "ok" : "bad"}`}>
              Model: {health.model_based}
            </span>
          </div>
        )}
      </header>

      <section className="ner-input-section">
        <label className="ner-label">Network Configuration Text</label>
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Configure traffic from Router A to Router D via Router B with 100 Mbps bandwidth and packet loss below 2%."
        />
        <div className="ner-controls">
          <button className="ner-btn-primary" onClick={handleExtract} disabled={loading}>
            {loading ? "Extracting…" : "Extract Intent"}
          </button>
          <button className="ner-btn-secondary" onClick={handleUseEditor} disabled={!editorText?.trim()}>
            Use Editor Text
          </button>
          <div className="ner-examples">
            <span className="ner-examples-label">Examples:</span>
            {EXAMPLES.map((ex, i) => (
              <button key={i} className="ner-example-chip" onClick={() => setText(ex)} title={ex}>
                #{i + 1}
              </button>
            ))}
          </div>
        </div>
        {error && <div className="ner-error">{error}</div>}
      </section>

      {result && (
        <>
          {/* Agreement summary banner */}
          <section className="ner-agreement">
            {result.agreement.available ? (
              <>
                <div className="ner-agreement-headline">
                  <span className="ner-agreement-score">
                    {result.agreement.matches} / {result.agreement.total}
                  </span>
                  <span className="ner-agreement-text">
                    slots agree between rule-based and model-based extraction
                  </span>
                </div>
                {result.agreement.differences.length > 0 && (
                  <ul className="ner-diff-list">
                    {result.agreement.differences.map((d, i) => (
                      <li key={i}>
                        <strong>{SLOT_LABELS[d.slot]}:</strong>{" "}
                        <span className="ner-diff-rule">Rule: {d.rule_based ?? "-"}</span>{" "}
                        <span className="ner-diff-model">Model: {d.model_based ?? "-"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="ner-agreement-unavailable">
                Model unavailable - showing rule-based results only.
                {result.agreement.reason && <div className="ner-reason">{result.agreement.reason}</div>}
              </div>
            )}
          </section>

          {/* Side-by-side panels */}
          <section className="ner-compare-grid">
            {/* Rule-based panel */}
            <div className="ner-panel">
              <h3 className="ner-panel-title">
                <span className="ner-panel-badge rule">Stage 1</span>
                Rule-Based (Regex)
              </h3>
              <div className="ner-text-block">
                <HighlightedText text={result.text} entities={result.rule_based.entities} />
              </div>
              <StructuredTable structured={result.rule_based.structured} diffSlots={diffSlots} />
              <div className="ner-meta">
                {result.rule_based.entities.length} entities extracted
              </div>
            </div>

            {/* Model-based panel */}
            <div className="ner-panel">
              <h3 className="ner-panel-title">
                <span className="ner-panel-badge model">Stage 2</span>
                Fine-Tuned spaCy Model
              </h3>
              {modelAvailable ? (
                <>
                  <div className="ner-text-block">
                    <HighlightedText text={result.text} entities={result.model_based.entities} />
                  </div>
                  <StructuredTable structured={result.model_based.structured} diffSlots={diffSlots} />
                  <div className="ner-meta">
                    {result.model_based.entities.length} entities extracted
                  </div>
                </>
              ) : (
                <div className="ner-unavailable">
                  <p>Model not loaded.</p>
                  <p className="ner-reason">{result.agreement.reason}</p>
                  <p className="ner-hint">
                    To enable: <code>pip install spacy==3.7.5</code> then{" "}
                    <code>python training/train_ner.py</code>.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Legend */}
          <section className="ner-legend">
            {Object.entries(LABEL_META).map(([label, meta]) => (
              <span key={label} className="ner-legend-item">
                <span className="ner-legend-swatch" style={{ backgroundColor: meta.color }} />
                {label.replace("_", " ")}
              </span>
            ))}
          </section>

          {/* Analysis section (per-entity breakdown, coverage, comparison, timing, observations) */}
          <NetworkNerAnalysis result={result} />
        </>
      )}
    </div>
  );
}
