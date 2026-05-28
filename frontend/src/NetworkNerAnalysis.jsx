/**
 * NetworkNerAnalysis.jsx
 *
 * Renders the analysis section shown below the side-by-side comparison panels.
 * Contains five subsections:
 *   1. Per-entity-type breakdown table
 *   2. Coverage headline metric
 *   3. Approach comparison spec card
 *   4. Processing time bar
 *   5. Auto-generated observations panel
 */

import "./NetworkNerAnalysis.css";

const LABELS = [
  { key: "SOURCE_NODE",       label: "Source Node",       color: "#3b82f6" },
  { key: "DESTINATION_NODE",  label: "Destination Node",  color: "#10b981" },
  { key: "INTERMEDIATE_NODE", label: "Intermediate Node", color: "#f59e0b" },
  { key: "BANDWIDTH",         label: "Bandwidth",         color: "#8b5cf6" },
  { key: "PACKET_LOSS",       label: "Packet Loss",       color: "#ef4444" },
];

function countByLabel(entities = []) {
  const counts = Object.fromEntries(LABELS.map((l) => [l.key, 0]));
  for (const e of entities) {
    if (counts[e.label] !== undefined) counts[e.label] += 1;
  }
  return counts;
}

function pct(num, denom) {
  if (!denom) return 0;
  return Math.round((num / denom) * 1000) / 10;
}

function generateObservations(ruleEnts, modelEnts, ruleCounts, modelCounts, ruleMs, modelMs) {
  const obs = [];
  const ruleTotal = ruleEnts.length;
  const modelTotal = modelEnts.length;

  // Coverage observation
  if (modelTotal > ruleTotal) {
    const diff = modelTotal - ruleTotal;
    const ratio = ruleTotal === 0 ? "∞" : `${Math.round((modelTotal / ruleTotal) * 100)}%`;
    obs.push({
      kind: "advantage-model",
      text: `Model identified ${diff} more entities than the rule-based extractor (${ratio} of rule-based coverage).`,
    });
  } else if (ruleTotal > modelTotal) {
    obs.push({
      kind: "advantage-rule",
      text: `Rule-based extractor found ${ruleTotal - modelTotal} more entities than the model. This may indicate model overfitting or regex false positives.`,
    });
  } else if (ruleTotal === modelTotal && ruleTotal > 0) {
    obs.push({
      kind: "neutral",
      text: `Both approaches extracted the same number of entities (${ruleTotal}). Check the breakdown table for per-type agreement.`,
    });
  }

  // Largest gap per entity type
  let biggestGap = null;
  for (const l of LABELS) {
    const gap = modelCounts[l.key] - ruleCounts[l.key];
    if (biggestGap === null || Math.abs(gap) > Math.abs(biggestGap.gap)) {
      biggestGap = { label: l.label, gap, rule: ruleCounts[l.key], model: modelCounts[l.key] };
    }
  }
  if (biggestGap && biggestGap.gap !== 0) {
    const dir = biggestGap.gap > 0 ? "model" : "rule-based";
    obs.push({
      kind: biggestGap.gap > 0 ? "advantage-model" : "advantage-rule",
      text: `Largest gap is in ${biggestGap.label}: rule-based found ${biggestGap.rule}, model found ${biggestGap.model}. Advantage: ${dir}.`,
    });
  }

  // Multi-path observation
  if (ruleTotal <= 5 && modelTotal > 10) {
    obs.push({
      kind: "advantage-model",
      text: `Rule-based extractor appears to have processed only the first network path. Model extracted entities from the entire document, demonstrating sentence-level generalization.`,
    });
  }

  // Speed observation
  if (ruleMs != null && modelMs != null) {
    if (ruleMs < modelMs) {
      const factor = Math.round((modelMs / Math.max(ruleMs, 0.01)) * 10) / 10;
      obs.push({
        kind: "advantage-rule",
        text: `Rule-based extractor was ${factor}× faster (${ruleMs} ms vs ${modelMs} ms). Tradeoff: speed for coverage.`,
      });
    } else {
      obs.push({
        kind: "advantage-model",
        text: `Model matched or beat rule-based on speed (${modelMs} ms vs ${ruleMs} ms).`,
      });
    }
  }

  if (obs.length === 0) {
    obs.push({ kind: "neutral", text: "Both approaches produced identical output." });
  }

  return obs;
}

export default function NetworkNerAnalysis({ result }) {
  if (!result) return null;
  const ruleEnts = result.rule_based?.entities ?? [];
  const modelEnts = result.model_based?.entities ?? [];
  const modelAvailable = result.model_based != null;
  const ruleMs = result.rule_based?.timing_ms;
  const modelMs = result.model_based?.timing_ms;

  const ruleCounts = countByLabel(ruleEnts);
  const modelCounts = countByLabel(modelEnts);

  const ruleTotal = ruleEnts.length;
  const modelTotal = modelEnts.length;
  const combinedTotal = Math.max(ruleTotal, modelTotal);
  const rulePct = pct(ruleTotal, combinedTotal);
  const modelPct = pct(modelTotal, combinedTotal);

  const observations = modelAvailable
    ? generateObservations(ruleEnts, modelEnts, ruleCounts, modelCounts, ruleMs, modelMs)
    : [];

  // Max value across the bar chart for scaling
  const maxCount = Math.max(
    1,
    ...LABELS.map((l) => Math.max(ruleCounts[l.key], modelCounts[l.key]))
  );

  return (
    <section className="ner-analysis">
      <h3 className="ner-analysis-heading">Comparative Analysis</h3>

      {/* ===== Section 2: Coverage headline ===== */}
      <div className="ner-analysis-row">
        <div className="ner-coverage-card">
          <div className="ner-coverage-label">Rule-Based Coverage</div>
          <div className="ner-coverage-value">
            {ruleTotal} / {combinedTotal}
            <span className="ner-coverage-pct">({rulePct}%)</span>
          </div>
          <div className="ner-coverage-bar">
            <div className="ner-coverage-fill rule" style={{ width: `${rulePct}%` }} />
          </div>
        </div>
        <div className="ner-coverage-card">
          <div className="ner-coverage-label">Model Coverage</div>
          <div className="ner-coverage-value">
            {modelTotal} / {combinedTotal}
            <span className="ner-coverage-pct">({modelPct}%)</span>
          </div>
          <div className="ner-coverage-bar">
            <div className="ner-coverage-fill model" style={{ width: `${modelPct}%` }} />
          </div>
        </div>
      </div>

      {/* ===== Section 1: Per-entity breakdown table ===== */}
      <div className="ner-analysis-block">
        <h4 className="ner-analysis-subheading">Per-Entity-Type Breakdown</h4>
        <table className="ner-breakdown-table">
          <thead>
            <tr>
              <th>Entity Type</th>
              <th className="ner-num-cell">Rule-Based</th>
              <th className="ner-num-cell">Model</th>
              <th>Distribution</th>
              <th className="ner-num-cell">Δ</th>
            </tr>
          </thead>
          <tbody>
            {LABELS.map((l) => {
              const r = ruleCounts[l.key];
              const m = modelCounts[l.key];
              const delta = m - r;
              const ruleW = (r / maxCount) * 100;
              const modelW = (m / maxCount) * 100;
              return (
                <tr key={l.key}>
                  <td>
                    <span className="ner-bk-swatch" style={{ backgroundColor: l.color }} />
                    {l.label}
                  </td>
                  <td className="ner-num-cell">{r}</td>
                  <td className="ner-num-cell">{m}</td>
                  <td className="ner-dist-cell">
                    <div className="ner-dist-row">
                      <span className="ner-dist-tag rule">R</span>
                      <div className="ner-dist-bar">
                        <div className="ner-dist-fill rule" style={{ width: `${ruleW}%` }} />
                      </div>
                    </div>
                    <div className="ner-dist-row">
                      <span className="ner-dist-tag model">M</span>
                      <div className="ner-dist-bar">
                        <div className="ner-dist-fill model" style={{ width: `${modelW}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className={`ner-num-cell ner-delta ${delta > 0 ? "pos" : delta < 0 ? "neg" : ""}`}>
                    {delta > 0 ? `+${delta}` : delta}
                  </td>
                </tr>
              );
            })}
            <tr className="ner-totals-row">
              <td><strong>Total</strong></td>
              <td className="ner-num-cell"><strong>{ruleTotal}</strong></td>
              <td className="ner-num-cell"><strong>{modelTotal}</strong></td>
              <td />
              <td className={`ner-num-cell ner-delta ${modelTotal - ruleTotal > 0 ? "pos" : modelTotal - ruleTotal < 0 ? "neg" : ""}`}>
                <strong>{modelTotal - ruleTotal > 0 ? `+${modelTotal - ruleTotal}` : modelTotal - ruleTotal}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ===== Section 4: Processing time ===== */}
      {(ruleMs != null || modelMs != null) && (
        <div className="ner-analysis-block">
          <h4 className="ner-analysis-subheading">Processing Time</h4>
          <div className="ner-timing">
            <div className="ner-timing-row">
              <span className="ner-timing-label">Rule-Based</span>
              <div className="ner-timing-bar-wrap">
                <div
                  className="ner-timing-bar rule"
                  style={{ width: `${Math.min(100, (ruleMs / Math.max(ruleMs, modelMs, 1)) * 100)}%` }}
                />
              </div>
              <span className="ner-timing-value">{ruleMs} ms</span>
            </div>
            {modelMs != null && (
              <div className="ner-timing-row">
                <span className="ner-timing-label">Model</span>
                <div className="ner-timing-bar-wrap">
                  <div
                    className="ner-timing-bar model"
                    style={{ width: `${Math.min(100, (modelMs / Math.max(ruleMs, modelMs, 1)) * 100)}%` }}
                  />
                </div>
                <span className="ner-timing-value">{modelMs} ms</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Section 3: Approach comparison card ===== */}
      <div className="ner-analysis-block">
        <h4 className="ner-analysis-subheading">Approach Comparison</h4>
        <table className="ner-approach-table">
          <thead>
            <tr>
              <th>Criterion</th>
              <th>Rule-Based (Regex)</th>
              <th>Fine-Tuned spaCy Model</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Method</td><td>Hand-crafted regex patterns</td><td>spaCy NER (transition-based CNN)</td></tr>
            <tr><td>Training data</td><td>None required</td><td>80 labeled sentences</td></tr>
            <tr><td>Generalizes to new phrasing</td><td><span className="ner-cross">✗</span> Pattern-bound</td><td><span className="ner-check">✓</span> Learns features</td></tr>
            <tr><td>Multi-sentence input</td><td><span className="ner-cross">✗</span> First match only</td><td><span className="ner-check">✓</span> Full document</td></tr>
            <tr><td>Held-out eval F1</td><td>N/A (no eval set)</td><td>0.983 (micro avg)</td></tr>
            <tr><td>Inference cost</td><td>Sub-millisecond</td><td>~50 ms (CPU)</td></tr>
            <tr><td>Maintenance</td><td>Manual pattern updates</td><td>Retrain on new examples</td></tr>
            <tr><td>Best use case</td><td>Strict, controlled vocabularies</td><td>Open-ended user input</td></tr>
          </tbody>
        </table>
      </div>

      {/* ===== Section 5: Auto-generated observations ===== */}
      {modelAvailable && observations.length > 0 && (
        <div className="ner-analysis-block">
          <h4 className="ner-analysis-subheading">Key Observations</h4>
          <ul className="ner-observations">
            {observations.map((o, i) => (
              <li key={i} className={`ner-obs ner-obs-${o.kind}`}>
                <span className="ner-obs-icon">
                  {o.kind === "advantage-model" ? "→" : o.kind === "advantage-rule" ? "←" : "•"}
                </span>
                <span>{o.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
