import { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import "./App.css";
import DeliverabilityDashboard from "./DeliverabilityDashboard";
import NetworkNerDashboard from "./NetworkNerDashboard";
import TranslationDashboard from "./TranslationDashboard";

const API = "http://localhost:8000";

// ─── Escape HTML ──────────────────────────────────────────────────────────────
function escHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Build highlighted HTML ───────────────────────────────────────────────────
function buildHighlightedHTML(text, errors) {
  if (!text) return "";
  if (!errors || errors.length === 0)
    return escHtml(text).replace(/\n/g, "<br/>");

  const sorted = [...errors].sort((a, b) => a.start - b.start);
  let html = "";
  let pos = 0;

  for (const err of sorted) {
    if (err.start < pos) continue;
    html += escHtml(text.slice(pos, err.start)).replace(/\n/g, "<br/>");
    const cls =
      err.type === "spelling"
        ? "err-spell"
        : err.type === "grammar"
          ? "err-grammar"
          : err.type === "spam"
            ? "err-spam"
            : "err-context";
    const word = text.slice(err.start, err.end);
    html += `<span class="${cls}" data-msg="${escHtml(err.message)}" data-sugg="${escHtml((err.suggestions || []).join(","))}" data-start="${err.start}" data-end="${err.end}">${escHtml(word)}</span>`;
    pos = err.end;
  }
  html += escHtml(text.slice(pos)).replace(/\n/g, "<br/>");
  return html;
}

// ─── Caret helpers ────────────────────────────────────────────────────────────
function getCaretCharOffset(el) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return 0;
  const range = sel.getRangeAt(0);
  const preRange = range.cloneRange();
  preRange.selectNodeContents(el);
  preRange.setEnd(range.endContainer, range.endOffset);
  return preRange.toString().length;
}

function setCaretCharOffset(el, offset) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  let remaining = offset;
  let node;
  while ((node = walker.nextNode())) {
    if (remaining <= node.textContent.length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }
    remaining -= node.textContent.length;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ x, y, message, suggestions, type, onClose }) {
  const colors = {
    spelling: {
      bg: "#fff5f5",
      border: "#e53e3e",
      label: "🔴 Spelling Error",
      color: "#c53030",
    },
    grammar: {
      bg: "#ebf8ff",
      border: "#3182ce",
      label: "🔵 Grammar Error",
      color: "#2b6cb0",
    },
    contextual: {
      bg: "#f0fff4",
      border: "#38a169",
      label: "🟢 Contextual Hint",
      color: "#276749",
    },
    spam: {
      bg: "rgba(79, 70, 229, 0.1)",
      border: "#4F46E5",
      label: "🚨 Spam Risk",
      color: "#4F46E5",
    },
  };
  const c = colors[type] || colors.spelling;
  const suggs = suggestions ? suggestions.filter(Boolean) : [];
  return (
    <div
      className="tooltip-popup"
      style={{ left: x, top: y, borderColor: c.border, background: c.bg }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="tooltip-label" style={{ color: c.color }}>
        {c.label}
      </div>
      <p className="tooltip-msg">{message}</p>
      {suggs.length > 0 && (
        <div className="tooltip-suggs">
          <span className="sugg-label">Suggestions:</span>
          {suggs.map((s, i) => (
            <span
              key={i}
              className="sugg-chip"
              style={{ borderColor: c.border, color: c.color }}
            >
              {s}
            </span>
          ))}
        </div>
      )}
      <button className="tooltip-close" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}

// ─── Error Sidebar ────────────────────────────────────────────────────────────
function ErrorSidebar({ errors }) {
  const spellCount = errors.filter((e) => e.type === "spelling").length;
  const grammarCount = errors.filter((e) => e.type === "grammar").length;
  const contextCount = errors.filter((e) => e.type === "contextual").length;
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Editor Review</span>
        <div className="sidebar-counts">
          {spellCount > 0 && (
            <span className="count-badge spell">{spellCount} spelling</span>
          )}
          {grammarCount > 0 && (
            <span className="count-badge grammar">{grammarCount} grammar</span>
          )}
          {contextCount > 0 && (
            <span className="count-badge context">
              {contextCount} contextual
            </span>
          )}
          {errors.length === 0 && (
            <span className="count-badge ok">✓ No issues</span>
          )}
        </div>
      </div>
      <div className="sidebar-legend">
        <div className="legend-item">
          <span className="legend-line spell-line" /> Spelling
        </div>
        <div className="legend-item">
          <span className="legend-line grammar-line" /> Grammar
        </div>
        <div className="legend-item">
          <span className="legend-line context-line" /> Contextual
        </div>
      </div>
      <div className="error-list">
        {errors.length === 0 ? (
          <div className="no-errors">
            <div className="no-errors-icon">✓</div>
            <p>Your document looks great!</p>
          </div>
        ) : (
          errors.map((err, i) => (
            <div
              key={i}
              className={`error-item ${err.type}`}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <div className="error-item-header">
                <span className={`error-dot ${err.type}`} />
                <span className="error-word">"{err.word}"</span>
                <span className={`error-type-tag ${err.type}`}>{err.type}</span>
              </div>
              <p className="error-msg">{err.message}</p>
              {err.suggestions?.length > 0 && (
                <div className="error-suggs">
                  {err.suggestions.slice(0, 3).map((s, j) => (
                    <span key={j} className={`sugg-tag ${err.type}`}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

// ─── Lab 5 Panel ─────────────────────────────────────────────────────────────
function LabPanel({ editorText }) {
  const [activeTab, setActiveTab] = useState("ngram");
  // N-gram tab state
  const [ngramCorpus, setNgramCorpus] = useState("");
  const [ngramResult, setNgramResult] = useState(null);
  const [ngramLoading, setNgramLoading] = useState(false);
  const [ngramN, setNgramN] = useState(2);
  // Perplexity tab state
  const [ppCorpus, setPpCorpus] = useState("");
  const [ppSentence, setPpSentence] = useState("");
  const [ppResult, setPpResult] = useState(null);
  const [ppLoading, setPpLoading] = useState(false);
  // Completion tab state
  const [compCorpus, setCompCorpus] = useState("");
  const [compPrefix, setCompPrefix] = useState("");
  const [compResult, setCompResult] = useState(null);
  const [compLoading, setCompLoading] = useState(false);

  // "Use editor text" helpers
  const useEditor = (setter) => {
    if (editorText) setter(editorText);
  };

  // ── N-gram analysis ────────────────────────────────────────────────────────
  async function runNgram() {
    if (!ngramCorpus.trim()) return;
    setNgramLoading(true);
    setNgramResult(null);
    try {
      const { data } = await axios.post(`${API}/ngram`, {
        text: ngramCorpus,
        n: ngramN,
      });
      setNgramResult(data);
    } catch {
      /* ignore */
    } finally {
      setNgramLoading(false);
    }
  }

  // ── Perplexity ─────────────────────────────────────────────────────────────
  async function runPerplexity() {
    if (!ppCorpus.trim() || !ppSentence.trim()) return;
    setPpLoading(true);
    setPpResult(null);
    try {
      const { data } = await axios.post(`${API}/perplexity`, {
        text: ppCorpus,
        test_sentence: ppSentence,
      });
      setPpResult(data);
    } catch {
      /* ignore */
    } finally {
      setPpLoading(false);
    }
  }

  // ── Sentence completion ────────────────────────────────────────────────────
  async function runCompletion() {
    if (!compCorpus.trim() || !compPrefix.trim()) return;
    setCompLoading(true);
    setCompResult(null);
    try {
      const { data } = await axios.post(`${API}/complete`, {
        text: compCorpus,
        prefix: compPrefix,
        n_suggestions: 6,
      });
      setCompResult(data);
    } catch {
      /* ignore */
    } finally {
      setCompLoading(false);
    }
  }

  // ── Perplexity bar fill % ──────────────────────────────────────────────────
  function ppBarPct(val) {
    if (val < 0) return 100;
    if (val < 2) return 20;
    if (val < 5) return 40;
    if (val < 20) return 65;
    return 100;
  }
  function ppBarClass(val) {
    if (val < 0) return "high";
    if (val < 3) return "low";
    if (val < 15) return "med";
    return "high";
  }
  function ppLabel(val) {
    if (val < 0) return "∞ (unseen)";
    return val.toFixed(3);
  }

  return (
    <div className="lab-panel">
      {/* Header */}
      <div className="lab-panel-header">
        <span className="lab-panel-icon">🔬</span>
        <div>
          <div className="lab-panel-title">NLP Lab 5 — Language Models</div>
          <div className="lab-panel-sub">
            N-gram · Perplexity · Sentence Completion
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="lab-tabs">
        {[
          { id: "ngram", label: "N-Gram" },
          { id: "perplexity", label: "Perplexity" },
          { id: "complete", label: "Completion" },
        ].map((t) => (
          <button
            key={t.id}
            className={`lab-tab-btn ${activeTab === t.id ? "active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="lab-body">
        {/* ── N-GRAM TAB ─────────────────────────────────────── */}
        {activeTab === "ngram" && (
          <>
            <div className="lab-info">
              <strong>Lab 5-B:</strong> Build Unigram, Bigram, and Trigram
              models. Enter corpus text, click Analyze to see top N-grams and
              counts.
            </div>

            <div className="lab-section">
              <div className="lab-section-title">Corpus Input</div>
              <div className="lab-section-body">
                <div className="lab-row">
                  <label className="lab-label">Corpus Text</label>
                  <textarea
                    className="lab-textarea"
                    rows={4}
                    placeholder="Enter or paste corpus text…"
                    value={ngramCorpus}
                    onChange={(e) => setNgramCorpus(e.target.value)}
                  />
                  <button
                    className="lab-btn"
                    style={{ marginTop: 4, background: "#888" }}
                    onClick={() => useEditor(setNgramCorpus)}
                  >
                    ← Use Editor Text
                  </button>
                </div>
                <div className="lab-row">
                  <label className="lab-label">Focus N</label>
                  <select
                    className="lab-input"
                    value={ngramN}
                    onChange={(e) => setNgramN(Number(e.target.value))}
                  >
                    <option value={1}>Unigram (1)</option>
                    <option value={2}>Bigram (2)</option>
                    <option value={3}>Trigram (3)</option>
                  </select>
                </div>
                <button
                  className="lab-btn"
                  onClick={runNgram}
                  disabled={ngramLoading || !ngramCorpus.trim()}
                >
                  {ngramLoading ? "⟳ Analyzing…" : "▶ Analyze N-grams"}
                </button>
              </div>
            </div>

            {ngramLoading && (
              <div className="lab-loading">⟳ Building N-gram model…</div>
            )}

            {ngramResult && (
              <>
                <div className="lab-section">
                  <div className="lab-section-title">Corpus Stats</div>
                  <div className="lab-section-body">
                    <div className="lab-result-row">
                      <span className="lab-result-label">Total Tokens</span>
                      <span className="lab-result-value">
                        {ngramResult.total_tokens}
                      </span>
                    </div>
                    <div className="lab-result-row">
                      <span className="lab-result-label">
                        Vocabulary Size (V)
                      </span>
                      <span className="lab-result-value">
                        {ngramResult.vocab_size}
                      </span>
                    </div>
                    <div className="lab-result-row">
                      <span className="lab-result-label">Unique Bigrams</span>
                      <span className="lab-result-value">
                        {Object.keys(ngramResult.bigrams).length}
                      </span>
                    </div>
                    <div className="lab-result-row">
                      <span className="lab-result-label">Unique Trigrams</span>
                      <span className="lab-result-value">
                        {Object.keys(ngramResult.trigrams).length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="lab-section">
                  <div className="lab-section-title">Top Unigrams</div>
                  <div className="lab-section-body">
                    <div className="ngram-list">
                      {ngramResult.top_unigrams.map((item, i) => (
                        <span key={i} className="ngram-chip">
                          {item.ngram}{" "}
                          <span className="ngram-chip-count">{item.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="lab-section">
                  <div className="lab-section-title">Top Bigrams</div>
                  <div className="lab-section-body">
                    <div className="ngram-list">
                      {ngramResult.top_bigrams.map((item, i) => (
                        <span key={i} className="ngram-chip">
                          {item.ngram}{" "}
                          <span className="ngram-chip-count">{item.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="lab-section">
                  <div className="lab-section-title">Top Trigrams</div>
                  <div className="lab-section-body">
                    <div className="ngram-list">
                      {ngramResult.top_trigrams.map((item, i) => (
                        <span key={i} className="ngram-chip">
                          {item.ngram}{" "}
                          <span className="ngram-chip-count">{item.count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── PERPLEXITY TAB ─────────────────────────────────── */}
        {activeTab === "perplexity" && (
          <>
            <div className="lab-info">
              <strong>Lab 5-B:</strong> Perplexity measures how "confused" the
              model is. <strong>Lower = better.</strong> Infinite perplexity
              means unseen word sequence (zero probability under MLE).
            </div>

            <div className="lab-section">
              <div className="lab-section-title">Input</div>
              <div className="lab-section-body">
                <div className="lab-row">
                  <label className="lab-label">Training Corpus</label>
                  <textarea
                    className="lab-textarea"
                    rows={3}
                    placeholder="Enter training corpus…"
                    value={ppCorpus}
                    onChange={(e) => setPpCorpus(e.target.value)}
                  />
                  <button
                    className="lab-btn"
                    style={{ marginTop: 4, background: "#888" }}
                    onClick={() => useEditor(setPpCorpus)}
                  >
                    ← Use Editor Text
                  </button>
                </div>
                <div className="lab-row">
                  <label className="lab-label">Test Sentence</label>
                  <input
                    className="lab-input"
                    placeholder="e.g. I am Sam"
                    value={ppSentence}
                    onChange={(e) => setPpSentence(e.target.value)}
                  />
                </div>
                <button
                  className="lab-btn"
                  onClick={runPerplexity}
                  disabled={ppLoading || !ppCorpus.trim() || !ppSentence.trim()}
                >
                  {ppLoading ? "⟳ Computing…" : "▶ Compute Perplexity"}
                </button>
              </div>
            </div>

            {ppLoading && (
              <div className="lab-loading">⟳ Computing perplexity…</div>
            )}

            {ppResult && (
              <>
                <div className="lab-section">
                  <div className="lab-section-title">Model Info</div>
                  <div className="lab-section-body">
                    <div className="lab-result-row">
                      <span className="lab-result-label">Corpus Tokens</span>
                      <span className="lab-result-value">
                        {ppResult.model_tokens}
                      </span>
                    </div>
                    <div className="lab-result-row">
                      <span className="lab-result-label">Vocabulary (V)</span>
                      <span className="lab-result-value">
                        {ppResult.vocab_size}
                      </span>
                    </div>
                    <div className="lab-result-row">
                      <span className="lab-result-label">
                        Sentence Prob (MLE)
                      </span>
                      <span
                        className={`lab-result-value ${ppResult.sentence_prob_mle === 0 ? "warn" : "ok"}`}
                      >
                        {ppResult.sentence_prob_mle === 0
                          ? "0 (OOV)"
                          : ppResult.sentence_prob_mle.toExponential(3)}
                      </span>
                    </div>
                    <div className="lab-result-row">
                      <span className="lab-result-label">Log Prob (MLE)</span>
                      <span className="lab-result-value">
                        {ppResult.log_prob_mle === -999
                          ? "-∞"
                          : ppResult.log_prob_mle.toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="lab-section">
                  <div className="lab-section-title">Perplexity Comparison</div>
                  <div className="lab-section-body">
                    {[
                      {
                        label: "MLE (no smoothing)",
                        val: ppResult.perplexity_mle,
                      },
                      {
                        label: "Laplace Smoothing",
                        val: ppResult.perplexity_laplace,
                      },
                      {
                        label: "Backoff Model",
                        val: ppResult.perplexity_backoff,
                      },
                    ].map(({ label, val }) => (
                      <div key={label} className="pp-bar-wrap">
                        <div className="pp-bar-label">
                          <span>{label}</span>
                          <span
                            style={{ fontWeight: 700, fontFamily: "monospace" }}
                          >
                            {ppLabel(val)}
                          </span>
                        </div>
                        <div className="pp-bar-track">
                          <div
                            className={`pp-bar-fill ${ppBarClass(val)}`}
                            style={{ width: `${ppBarPct(val)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="lab-info" style={{ marginTop: 6 }}>
                      MLE gives ∞ for unseen sequences. Laplace adds +1 to all
                      counts. Backoff falls back to unigram when bigram unseen.
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── COMPLETION TAB ──────────────────────────────────── */}
        {activeTab === "complete" && (
          <>
            <div className="lab-info">
              <strong>Lab 5-A:</strong> Spell-correct the prefix, then predict
              next words using a Bigram language model trained on your corpus.
            </div>

            <div className="lab-section">
              <div className="lab-section-title">Input</div>
              <div className="lab-section-body">
                <div className="lab-row">
                  <label className="lab-label">Training Corpus</label>
                  <textarea
                    className="lab-textarea"
                    rows={3}
                    placeholder="Enter training corpus…"
                    value={compCorpus}
                    onChange={(e) => setCompCorpus(e.target.value)}
                  />
                  <button
                    className="lab-btn"
                    style={{ marginTop: 4, background: "#888" }}
                    onClick={() => useEditor(setCompCorpus)}
                  >
                    ← Use Editor Text
                  </button>
                </div>
                <div className="lab-row">
                  <label className="lab-label">Sentence Prefix (partial)</label>
                  <input
                    className="lab-input"
                    placeholder="e.g. I am goin"
                    value={compPrefix}
                    onChange={(e) => setCompPrefix(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") runCompletion();
                    }}
                  />
                </div>
                <button
                  className="lab-btn"
                  onClick={runCompletion}
                  disabled={
                    compLoading || !compCorpus.trim() || !compPrefix.trim()
                  }
                >
                  {compLoading ? "⟳ Predicting…" : "▶ Complete Sentence"}
                </button>
              </div>
            </div>

            {compLoading && (
              <div className="lab-loading">⟳ Running bigram model…</div>
            )}

            {compResult && (
              <div className="lab-section">
                <div className="lab-section-title">
                  {compResult.bigram_used
                    ? "🔗 Bigram Predictions"
                    : "📊 Frequency Fallback"}
                </div>
                <div className="lab-section-body">
                  <div className="lab-label" style={{ marginBottom: 6 }}>
                    Corrected prefix:
                  </div>
                  <div className="completion-prefix">
                    "{compResult.corrected_prefix} ___"
                  </div>
                  <div className="lab-label" style={{ marginBottom: 6 }}>
                    Next word suggestions:
                  </div>
                  <div className="completion-suggestions">
                    {compResult.suggestions.map((word, i) => (
                      <div key={i} className="completion-suggestion">
                        <span className="completion-rank">{i + 1}</span>
                        <span className="completion-word">{word}</span>
                        <span className="completion-sub">
                          {compResult.bigram_used ? "bigram" : "freq"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {!compResult.bigram_used && (
                    <div className="lab-info" style={{ marginTop: 8 }}>
                      Last word not found in corpus bigrams — showing most
                      frequent words as fallback.
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [errors, setErrors] = useState([]);
  const [spamErrors, setSpamErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const [apiStatus, setApiStatus] = useState("checking");
  const [activeRibbonTab, setActiveRibbonTab] = useState("Home");
  const [editorText, setEditorText] = useState("");

  const editorRef = useRef(null);
  const debounceRef = useRef(null);
  const errorsRef = useRef([]);
  const spamErrorsRef = useRef([]);
  const plainTextRef = useRef("");

  useEffect(() => {
    axios
      .get(`${API}/health`)
      .then(() => setApiStatus("ok"))
      .catch(() => setApiStatus("error"));
  }, []);

  function getPlainText(el) {
    let text = "";
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
      else if (node.nodeName === "BR") text += "\n";
      else for (const child of node.childNodes) walk(child);
    };
    walk(el);
    return text;
  }

  function updateCounts(text) {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setWordCount(words);
    setCharCount(text.length);
  }

  function applyHighlights(text, errs) {
    const el = editorRef.current;
    if (!el) return;
    const caretPos = getCaretCharOffset(el);
    el.innerHTML = buildHighlightedHTML(text, errs);
    try {
      setCaretCharOffset(el, caretPos);
    } catch (_) {}
  }

  async function checkText(text) {
    if (!text.trim()) {
      setErrors([]);
      errorsRef.current = [];
      applyHighlights(text, spamErrorsRef.current);
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/check`, { text });
      setErrors(data);
      errorsRef.current = data;
      applyHighlights(text, [...data, ...spamErrorsRef.current]);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  function handleInput() {
    const el = editorRef.current;
    if (!el) return;
    const text = getPlainText(el);
    plainTextRef.current = text;
    setEditorText(text);
    updateCounts(text);
    setTooltip(null);
    setSpamErrors([]);
    spamErrorsRef.current = [];
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => checkText(text), 600);
  }

  function handleEditorClick(e) {
    const span = e.target.closest("[data-msg]");
    if (!span) {
      setTooltip(null);
      return;
    }
    const rect = span.getBoundingClientRect();
    const editorRect = editorRef.current.parentElement.getBoundingClientRect();
    setTooltip({
      x: rect.left - editorRect.left,
      y: rect.bottom - editorRect.top + 6,
      message: span.dataset.msg,
      suggestions: (span.dataset.sugg || "").split(",").filter(Boolean),
      type: span.classList.contains("err-spell")
        ? "spelling"
        : span.classList.contains("err-grammar")
          ? "grammar"
          : span.classList.contains("err-spam")
            ? "spam"
            : "contextual",
    });
  }

  function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }

  function handleKeyDown(e) {
    if (e.key === "Tab") {
      e.preventDefault();
      document.execCommand("insertText", false, "    ");
    }
  }

  const RIBBON_TABS = [
    "Home",
    "Insert",
    "View",
    "Review",
    "🔬 Lab 5",
    "🚀 Deliverability",
    "🌐 Network NER",
    "🌍 Translation",
  ];

  function handleSpamResult(newSpamErrors) {
    setSpamErrors(newSpamErrors);
    spamErrorsRef.current = newSpamErrors;
    applyHighlights(plainTextRef.current, [
      ...errorsRef.current,
      ...newSpamErrors,
    ]);
  }

  return (
    <div className="app" onClick={() => setTooltip(null)}>
      {/* ── Ribbon ────────────────────────────────────────────── */}
      <div className="ribbon">
        <div className="ribbon-logo">
          <span className="ribbon-logo-icon">W</span>
          <span className="ribbon-logo-text">WriteRight</span>
          <span className="ribbon-version">v2</span>
        </div>
        <div className="ribbon-tabs">
          {RIBBON_TABS.map((t) => (
            <button
              key={t}
              className={`ribbon-tab ${t.includes("Lab") ? "lab-tab" : ""} ${activeRibbonTab === t ? "active" : ""}`}
              onClick={() => setActiveRibbonTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="ribbon-right">
          <div className={`api-indicator ${apiStatus}`}>
            <span className="api-dot" />
            {apiStatus === "ok"
              ? "API Connected"
              : apiStatus === "error"
                ? "API Offline"
                : "Connecting…"}
          </div>
        </div>
      </div>

      {/* ── Toolbar ───────────────────────────────────────────── */}
      <div className="toolbar">
        <div className="toolbar-group">
          <button className="tb-btn" title="Bold">
            <b>B</b>
          </button>
          <button className="tb-btn" title="Italic">
            <i>I</i>
          </button>
          <button className="tb-btn" title="Underline">
            <u>U</u>
          </button>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <select className="tb-select" defaultValue="Lora">
            <option>Lora</option>
            <option>Times New Roman</option>
            <option>Georgia</option>
          </select>
          <select className="tb-select tb-select-sm" defaultValue="12">
            {[10, 11, 12, 14, 16, 18, 24, 36].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <button className="tb-btn">≡</button>
          <button className="tb-btn">≡</button>
          <button className="tb-btn">≡</button>
        </div>
        <div className="toolbar-sep" />
        <div className="check-legend">
          <span className="legend-pill spell-pill">Red = Spelling</span>
          <span className="legend-pill grammar-pill">Blue = Grammar</span>
          <span className="legend-pill context-pill">Green = Contextual</span>
        </div>
        {loading && <div className="checking-badge">⟳ Checking…</div>}
      </div>

      {/* ── Body ──────────────────────────────────────────────── */}
      <div className="body-area">
        {/* Canvas */}
        <div className="canvas-area">
          <div className="page-wrapper">
            <div className="ruler">
              {Array.from({ length: 17 }).map((_, i) => (
                <span key={i} className="ruler-mark">
                  {i > 0 ? i : ""}
                </span>
              ))}
            </div>
            <div className="page" onClick={(e) => e.stopPropagation()}>
              {tooltip && (
                <Tooltip
                  x={tooltip.x}
                  y={tooltip.y}
                  message={tooltip.message}
                  suggestions={tooltip.suggestions}
                  type={tooltip.type}
                  onClose={() => setTooltip(null)}
                />
              )}
              <div
                ref={editorRef}
                className="editor"
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onInput={handleInput}
                onClick={handleEditorClick}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                data-placeholder="Start typing your document here…"
              />
            </div>
          </div>
        </div>

        {/* Error Sidebar */}
        <ErrorSidebar errors={errors} />

        {/* Highlight panels on the right */}
        {activeRibbonTab === "🚀 Deliverability" ? (
          <DeliverabilityDashboard
            editorText={editorText}
            onSpamResult={handleSpamResult}
            apiStatus={apiStatus}
          />
        ) : activeRibbonTab === "🌐 Network NER" ? (
          <NetworkNerDashboard editorText={editorText} />
        ) : activeRibbonTab === "🌍 Translation" ? (
          <TranslationDashboard editorText={editorText} />
        ) : (
          <LabPanel editorText={editorText} />
        )}
      </div>

      {/* ── Status bar ────────────────────────────────────────── */}
      <div className="statusbar">
        <span>{wordCount} words</span>
        <span>{charCount} characters</span>
        <span className="status-sep">|</span>
        <span>
          {errors.filter((e) => e.type === "spelling").length} spelling &nbsp;
          {errors.filter((e) => e.type === "grammar").length} grammar &nbsp;
          {errors.filter((e) => e.type === "contextual").length} contextual
        </span>
        <span className="status-sep">|</span>
        <span>🔬 Lab 5 — N-gram · Perplexity · Completion</span>
        <span className="status-sep">|</span>
        <span>English (US)</span>
      </div>
    </div>
  );
}
