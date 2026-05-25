import React, { useState } from 'react';
import axios from 'axios';
import './NetworkNerDashboard.css';

const API = "http://localhost:8000";

// Five entity labels and their accent colors for the highlighted-text view.
const LABEL_META = {
  SOURCE_NODE:        { display: "Source Node",       color: "#1a6b5a" },
  DESTINATION_NODE:   { display: "Destination Node",  color: "#b85c00" },
  INTERMEDIATE_NODE:  { display: "Intermediate Node", color: "#5b3aa6" },
  BANDWIDTH:          { display: "Bandwidth",         color: "#2a6db0" },
  PACKET_LOSS:        { display: "Packet Loss",       color: "#a8324f" },
};

const SLOT_ORDER = [
  ["source_node",       "Source Node"],
  ["destination_node",  "Destination Node"],
  ["intermediate_node", "Intermediate Node"],
  ["bandwidth",         "Bandwidth"],
  ["packet_loss",       "Packet Loss"],
];

const SAMPLE = "Configure traffic from Router A to Router D through Router B with bandwidth 100 Mbps and packet loss below 2%.";

export default function NetworkNerDashboard({ editorText }) {
  const [text, setText] = useState(SAMPLE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleUseEditor = () => {
    if (editorText && editorText.trim()) setText(editorText);
  };

  const handleExtract = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data } = await axios.post(`${API}/extract-network-intent`, {
        text,
        use_model: true,
      });
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("Failed to extract entities. Ensure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  // Build the highlighted-text view from the entity char spans.
  const renderHighlighted = () => {
    if (!result || !result.entities || result.entities.length === 0) {
      return <span>{text}</span>;
    }
    const sorted = [...result.entities].sort((a, b) => a.start - b.start);
    const out = [];
    let cursor = 0;
    sorted.forEach((ent, idx) => {
      if (ent.start > cursor) {
        out.push(<span key={`t-${idx}`}>{result.text.slice(cursor, ent.start)}</span>);
      }
      const meta = LABEL_META[ent.label] ?? { color: "#666" };
      out.push(
        <span
          key={`e-${idx}`}
          className="nner-highlight"
          style={{
            backgroundColor: `${meta.color}22`,
            borderBottom: `2px solid ${meta.color}`,
          }}
          title={ent.label}
        >
          {result.text.slice(ent.start, ent.end)}
        </span>
      );
      cursor = ent.end;
    });
    if (cursor < result.text.length) {
      out.push(<span key="t-tail">{result.text.slice(cursor)}</span>);
    }
    return out;
  };

  return (
    <div className="nner-dashboard">
      <div className="nner-header">
        <h2 className="nner-title">Network Intent Extraction</h2>
        <p className="nner-subtitle">
          Convert network configuration text into structured entities
        </p>
      </div>

      <div className="nner-body">
        {/* Input section */}
        <div className="nner-input-card">
          <div className="nner-input-label">Network Configuration Text</div>
          <textarea
            className="nner-textarea"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Configure path from Router A to Router C via Router B with 100 Mbps bandwidth..."
          />
          <div className="nner-button-row">
            <button
              className="nner-secondary-btn"
              onClick={handleUseEditor}
              disabled={!editorText || !editorText.trim()}
            >
              ← Use Editor Text
            </button>
            <button
              className={`nner-extract-btn ${loading ? 'scanning' : ''}`}
              onClick={handleExtract}
              disabled={loading || !text.trim()}
            >
              {loading ? (
                <><span className="nner-spinner"></span> Extracting...</>
              ) : (
                "Extract Entities"
              )}
            </button>
          </div>
          {error && <div className="nner-error">{error}</div>}
        </div>

        {/* Results */}
        {result && (
          <>
            {/* Status badge */}
            <div className="nner-status-row">
              <span className="nner-status-label">Mode:</span>
              <span className={`nner-status-pill ${result.model_used ? 'hybrid' : 'rules'}`}>
                {result.model_used ? 'Hybrid (rules + fine-tuned model)' : 'Rule-based only'}
              </span>
              <span className="nner-status-label" style={{ marginLeft: 12 }}>
                Entities found:
              </span>
              <span className="nner-status-value">{result.entities.length}</span>
            </div>

            {/* Highlighted text */}
            <div className="nner-section">
              <div className="nner-section-title">Highlighted Text</div>
              <div className="nner-highlight-box">{renderHighlighted()}</div>
            </div>

            {/* Structured output table */}
            <div className="nner-section">
              <div className="nner-section-title">Structured Output</div>
              <table className="nner-table">
                <thead>
                  <tr>
                    <th>Entity</th>
                    <th>Extracted Value</th>
                  </tr>
                </thead>
                <tbody>
                  {SLOT_ORDER.map(([key, label]) => {
                    const value = result.structured[key];
                    const empty = value === "Not mentioned";
                    return (
                      <tr key={key}>
                        <td className="nner-td-label">{label}</td>
                        <td className={`nner-td-value ${empty ? 'empty' : ''}`}>
                          {value}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Entity chips with provenance */}
            <div className="nner-section">
              <div className="nner-section-title">Entity Chips</div>
              <div className="nner-chip-row">
                {result.entities.map((ent, i) => {
                  const meta = LABEL_META[ent.label] ?? { color: "#666", display: ent.label };
                  return (
                    <span
                      key={i}
                      className="nner-chip"
                      style={{
                        backgroundColor: `${meta.color}15`,
                        borderColor: meta.color,
                        color: meta.color,
                      }}
                    >
                      <strong>{meta.display}:</strong> {ent.value}
                      <span className="nner-chip-source">{ent.source}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {!result && !loading && (
          <div className="nner-empty-state">
            <div className="nner-empty-icon">🌐</div>
            <p>Enter network configuration text and click <strong>Extract Entities</strong>.</p>
            <p className="nner-empty-hint">
              The module identifies source, destination, and intermediate nodes
              along with bandwidth and packet loss specifications.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
