import { useEffect, useState } from "react";
import "./NewsNlpDashboard.css";

const API_BASE = "http://localhost:8000";

const EXAMPLES = [
  {
    title: "Lahore monsoon flooding",
    text: "Heavy rainfall lashed Lahore on Tuesday, causing widespread traffic disruption and flooding on several major roads. Citizens were stranded for hours as low-lying areas including Mall Road, Liberty Chowk, and Gulberg saw water levels rise above knee height. The Pakistan Meteorological Department had earlier warned of intense monsoon activity across Punjab. Provincial authorities urged residents to avoid unnecessary travel and stay indoors. Water and Sanitation Agency teams were deployed across the city to clear blocked drains, while traffic police diverted vehicles from the worst-affected routes. Schools in several districts announced an early closure to allow students to return home safely before nightfall.",
  },
  {
    title: "Tech earnings beat",
    text: "Shares of a major US technology company jumped more than eight percent in after-hours trading on Wednesday after the firm reported quarterly revenue that comfortably beat analyst expectations. The company posted earnings of $1.82 per share on revenue of $94.3 billion, driven by strong growth in its cloud computing division and a recovery in advertising spending. Executives raised their full-year guidance and announced an expanded share buyback program. The earnings report eased investor concerns about a broader slowdown in enterprise technology spending and lifted sentiment across the sector.",
  },
  {
    title: "Climate summit accord",
    text: "World leaders attending the United Nations climate summit on Friday agreed on a draft framework calling on countries to triple renewable energy capacity by 2030 and to phase down unabated coal use. The non-binding text, negotiated over twelve days in Dubai, also urges wealthier nations to scale up climate finance for developing economies most exposed to the effects of warming. Several small island states said the language fell short of their demand for a clear fossil fuel phase-out, while oil-producing countries welcomed the more measured wording. Final adoption is expected at a plenary session on Sunday.",
  },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button className="news-copy-btn" onClick={handle} title="Copy to clipboard">
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

export default function NewsNlpDashboard({ editorText = "" }) {
  const [text, setText] = useState(EXAMPLES[0].text);
  const [summaryLength, setSummaryLength] = useState("medium");
  const [headlineStrategy, setHeadlineStrategy] = useState("beam");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/news/health`)
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const handleUseEditor = () => {
    if (editorText && editorText.trim()) setText(editorText);
  };

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("Please paste a news article first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/news/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          summary_length: summaryLength,
          headline_strategy: headlineStrategy,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setResult(data);
      // prepend to history, cap at 5
      setHistory((prev) => [
        {
          ts: new Date().toLocaleTimeString(),
          inputPreview: text.slice(0, 80) + (text.length > 80 ? "…" : ""),
          summary: data.summary?.summary,
          headline: data.headline?.headline,
        },
        ...prev,
      ].slice(0, 5));
    } catch (e) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const inputWordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const inputCharCount = text.length;

  const summary = result?.summary;
  const headline = result?.headline;
  const summaryError = summary?.error;
  const headlineError = headline?.error;

  return (
    <div className="news-dashboard">
      <header className="news-header">
        <div>
          <h2>News Headline & Summary Generation</h2>
          <p className="news-sub">
            Paste a news article. Generates both a summary (t5-small) and a headline (t5-small, fine-tuned on tldr_news).
          </p>
        </div>
        {health && (
          <div className="news-health">
            <span className={`news-pill ${health.summarizer.status === "loaded" ? "ok" : health.summarizer.status === "error" ? "bad" : "warm"}`}>
              Summarizer: {health.summarizer.status}
            </span>
            <span className={`news-pill ${health.headliner.status === "loaded" ? "ok" : health.headliner.status === "error" ? "bad" : "warm"}`}>
              Headliner: {health.headliner.status}
            </span>
          </div>
        )}
      </header>

      <section className="news-input-section">
        <div className="news-input-row">
          <label className="news-label">News Article</label>
          <div className="news-counter">
            {inputWordCount} words · {inputCharCount} chars
          </div>
        </div>
        <textarea
          rows={9}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a full news article here…"
        />

        <div className="news-controls">
          <div className="news-control-group">
            <label className="news-control-label">Summary length</label>
            <div className="news-segment">
              {["short", "medium", "long"].map((opt) => (
                <button
                  key={opt}
                  className={summaryLength === opt ? "active" : ""}
                  onClick={() => setSummaryLength(opt)}
                  type="button"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="news-control-group">
            <label className="news-control-label">Headline style</label>
            <div className="news-segment">
              <button className={headlineStrategy === "beam" ? "active" : ""} onClick={() => setHeadlineStrategy("beam")} type="button">
                beam (deterministic)
              </button>
              <button className={headlineStrategy === "sampling" ? "active" : ""} onClick={() => setHeadlineStrategy("sampling")} type="button">
                sampling (varied)
              </button>
            </div>
          </div>

          <div className="news-buttons">
            <button className="news-btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? "Generating…" : "Generate Summary & Headline"}
            </button>
            <button className="news-btn-secondary" onClick={handleUseEditor} disabled={!editorText?.trim()}>
              Use Editor Text
            </button>
          </div>
        </div>

        <div className="news-examples">
          <span className="news-examples-label">Examples:</span>
          {EXAMPLES.map((ex, i) => (
            <button key={i} className="news-example-chip" onClick={() => setText(ex.text)} title={ex.title}>
              {ex.title}
            </button>
          ))}
        </div>

        {error && <div className="news-error">{error}</div>}
      </section>

      {loading && (
        <div className="news-loading">
          <div className="news-spinner" />
          <div>
            <strong>Generating…</strong>
            <p>First call downloads models (~500 MB total). After that, each generation takes 1-3 seconds on CPU.</p>
          </div>
        </div>
      )}

      {result && !loading && (
        <>
          {/* Headline panel */}
          <section className="news-panel news-panel-headline">
            <div className="news-panel-head">
              <div>
                <span className="news-panel-badge headline">Headline</span>
                <span className="news-panel-model">T5-small (JulesBelveze/t5-small-headline-generator)</span>
              </div>
              {headline?.headline && <CopyButton text={headline.headline} />}
            </div>
            {headlineError ? (
              <div className="news-panel-error">{headlineError}</div>
            ) : headline?.headline ? (
              <>
                <h3 className="news-headline-text">{headline.headline}</h3>
                <div className="news-meta-row">
                  <span>Strategy: <code>{headline.strategy}</code></span>
                  <span>Generated in {headline.timing_ms} ms</span>
                </div>
              </>
            ) : (
              <div className="news-empty">No headline generated.</div>
            )}
          </section>

          {/* Summary panel */}
          <section className="news-panel news-panel-summary">
            <div className="news-panel-head">
              <div>
                <span className="news-panel-badge summary">Summary</span>
                <span className="news-panel-model">T5-small (Falconsai/text_summarization)</span>
              </div>
              {summary?.summary && <CopyButton text={summary.summary} />}
            </div>
            {summaryError ? (
              <div className="news-panel-error">{summaryError}</div>
            ) : summary?.summary ? (
              <>
                <p className="news-summary-text">{summary.summary}</p>
                <div className="news-meta-row">
                  <span>Preset: <code>{summary.length_preset}</code></span>
                  <span>{summary.input_chars} → {summary.output_chars} chars</span>
                  <span>Compression: {(summary.compression_ratio * 100).toFixed(1)}%</span>
                  <span>Generated in {summary.timing_ms} ms</span>
                </div>
              </>
            ) : (
              <div className="news-empty">No summary generated.</div>
            )}
          </section>

          {/* Comparison strip */}
          {summary?.summary && headline?.headline && (
            <section className="news-compare-strip">
              <div className="news-compare-item">
                <span className="news-compare-label">Original</span>
                <span className="news-compare-value">{result.input_chars} chars</span>
              </div>
              <div className="news-compare-arrow">→</div>
              <div className="news-compare-item">
                <span className="news-compare-label">Summary</span>
                <span className="news-compare-value">{summary.output_chars} chars</span>
              </div>
              <div className="news-compare-arrow">→</div>
              <div className="news-compare-item">
                <span className="news-compare-label">Headline</span>
                <span className="news-compare-value">{headline.headline.length} chars</span>
              </div>
              <div className="news-compare-spacer" />
              <div className="news-compare-item">
                <span className="news-compare-label">Total time</span>
                <span className="news-compare-value">
                  {((summary.timing_ms || 0) + (headline.timing_ms || 0)).toFixed(0)} ms
                </span>
              </div>
            </section>
          )}
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <details className="news-history" open>
          <summary>Recent generations ({history.length})</summary>
          <ul>
            {history.map((h, i) => (
              <li key={i}>
                <div className="news-history-head">
                  <span className="news-history-ts">{h.ts}</span>
                  <span className="news-history-preview">{h.inputPreview}</span>
                </div>
                {h.headline && <div className="news-history-headline">{h.headline}</div>}
                {h.summary && <div className="news-history-summary">{h.summary}</div>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
