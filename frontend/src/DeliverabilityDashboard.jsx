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
        models: data.models || { nb: "Clear", svm: "Clear", lr: "Clear" },
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

  const currentScore = result ? result.score : '?';
  const isHighRisk = result && result.score < 70;
  
  return (
    <div className="dd-dashboard">
      <div className="dd-header">
        <h2 className="dd-title">Deliverability & Spam Analytics</h2>
        <p className="dd-subtitle">Ensure your email reaches the inbox</p>
      </div>

      <div className="dd-body">
        {/* Score Section */}
        <div className="dd-score-card">
          <div className="dd-score-label">Deliverability Score</div>
          <div className={`dd-score-value ${result ? (isHighRisk ? 'score-high-risk' : 'score-safe') : 'score-empty'}`}>
             {result ? `${result.score}% ${isHighRisk ? 'High Risk' : 'Safe'}` : '- -'}
          </div>
        </div>

        {/* Action Button */}
        <button 
           className={`dd-scan-btn ${loading ? 'scanning' : ''}`} 
           onClick={handleScan} 
           disabled={loading || !editorText.trim()}
        >
          {loading ? (
             <><span className="dd-spinner"></span> Scanning Document...</>
          ) : (
             "Scan Document"
          )}
        </button>
        {error && <div className="dd-error">{error}</div>}

        {/* Model Breakdown */}
        {result && (
          <div className="dd-models-breakdown">
             <div className="dd-models-title">AI Model Classification</div>
             <div className="dd-model-list">
                <div className="dd-model-pill">
                   <span className="dd-model-name">Naive Bayes</span>
                   <span className={`dd-model-status ${result.models.nb === 'Spam' ? 'status-spam' : 'status-clear'}`}>{result.models.nb}</span>
                </div>
                <div className="dd-model-pill">
                   <span className="dd-model-name">SVM</span>
                   <span className={`dd-model-status ${result.models.svm === 'Spam' ? 'status-spam' : 'status-clear'}`}>{result.models.svm}</span>
                </div>
                <div className="dd-model-pill">
                   <span className="dd-model-name">Logistic Regression</span>
                   <span className={`dd-model-status ${result.models.lr === 'Spam' ? 'status-spam' : 'status-clear'}`}>{result.models.lr}</span>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
