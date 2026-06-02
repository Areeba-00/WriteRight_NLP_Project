import React, { useState } from 'react';
import axios from 'axios';
import './DeliverabilityDashboard.css';

const API = "http://localhost:8000";

export default function DeliverabilityDashboard({ editorText, onSpamResult }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleScan = async () => {
    if (!editorText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(`${API}/analyze-deliverability`, { text: editorText });
      
      const safeData = {
        score: data.score ?? 100,
        is_spam: data.is_spam ?? false,
        spam_errors: data.spam_errors || []
      };

      setResult(safeData);
      if (onSpamResult) {
        onSpamResult(safeData.spam_errors);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to run the deliverability scan. Ensure the backend endpoint is implemented.");
    } finally {
      setLoading(false);
    }
  };

  const isHighRisk = result && result.is_spam;
  
  return (
    <div className="dd-dashboard">
      <div className="dd-header">
        <h2 className="dd-title">Deliverability & Spam Analytics</h2>
        <p className="dd-subtitle">Ensure your email reaches the inbox</p>
      </div>

      <div className="dd-body">
        {/* Score Section */}
        <div className="dd-score-card">
          <div className="dd-score-label">Inbox Deliverability Probability</div>
          <div className={`dd-score-number ${result ? (isHighRisk ? 'score-high-risk' : 'score-safe') : 'score-empty'}`}>
             {result ? `${result.score}%` : '- -'}
          </div>
          {result && (
            <div className={`dd-score-badge ${isHighRisk ? 'badge-high-risk' : 'badge-safe'}`}>
              {isHighRisk ? '⚠️ High Spam Risk' : '✅ Safe for Inbox'}
            </div>
          )}
          {result && (
            <p className="dd-score-explanation">
              {isHighRisk 
                ? "This draft contains language typical of spam filters. Modern email clients are highly likely to redirect it to the junk folder." 
                : "Excellent copy! This email is highly likely to successfully bypass filter policies and land directly in the recipient's inbox."}
            </p>
          )}
        </div>

        {/* Action Button */}
        <button 
           className={`dd-scan-btn ${loading ? 'scanning' : ''}`} 
           onClick={handleScan} 
           disabled={loading || !editorText.trim()}
        >
          {loading ? (
             <><span className="dd-spinner"></span> Analyzing Copy...</>
          ) : (
             "Scan Document"
          )}
        </button>
        {error && <div className="dd-error">{error}</div>}

        {/* Model Breakdown */}
        {result && (
          <div className="dd-models-breakdown">
             <div className="dd-models-title">DistilBERT AI Analysis</div>
             <div className="dd-model-list">
                <div className="dd-model-pill dd-model-primary">
                   <div className="dd-model-info">
                      <span className="dd-model-name">✨ DistilBERT Classifier</span>
                      <span className="dd-model-desc">Transformer Sequence Classification Model</span>
                   </div>
                   <span className={`dd-model-status ${isHighRisk ? 'status-spam' : 'status-clear'}`}>
                      {isHighRisk ? 'Spam' : 'Ham (Clear)'}
                   </span>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
