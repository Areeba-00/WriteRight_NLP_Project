import React, { useState } from "react";
import axios from "axios";
import "./DeliverabilityDashboard.css"; // Reusing your existing clean styles

const API = "http://localhost:8000";

export default function TranslationDashboard({ editorText }) {
  const [loading, setLoading] = useState(false);
  const [translatedText, setTranslatedText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  // Handle direct text translation
  const handleTextTranslate = async () => {
    if (!editorText.trim()) return;
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/translate/text`, {
        text: editorText,
      });
      setTranslatedText(data.translated);
    } catch (err) {
      console.error(err);
      setTranslatedText("Error: Translation failed.");
    } finally {
      setLoading(false);
    }
  };

  // Handle document translation
  const handleDocumentTranslate = async () => {
    if (!selectedFile) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await axios.post(`${API}/translate/document`, formData, {
        responseType: "blob", // Important for downloading files
      });

      // Create a link to download the file automatically
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;

      // Set filename based on original
      const extension = selectedFile.name.endsWith(".docx") ? ".docx" : ".txt";
      link.setAttribute(
        "download",
        `URDU_${selectedFile.name.replace(/\.[^/.]+$/, "")}${extension}`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTranslatedText(
        `Success! Translated file downloaded as URDU_${selectedFile.name}`,
      );
    } catch (err) {
      console.error(err);
      setTranslatedText("Error: Document translation failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dd-dashboard" style={{ flex: "0 0 400px" }}>
      <div className="dd-header">
        <h2 className="dd-title">🌍 EN → UR Translation</h2>
        <p className="dd-subtitle">Machine Translation & Document Parsing</p>
      </div>

      <div className="dd-body">
        {/* Text Translation Section */}
        <div className="dd-score-card">
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              marginBottom: "10px",
            }}
          >
            1. Direct Text Translation
          </div>
          <button
            className="dd-scan-btn"
            onClick={handleTextTranslate}
            disabled={loading || !editorText.trim()}
          >
            Translate Editor Text
          </button>
        </div>

        {/* Document Translation Section */}
        <div className="dd-score-card">
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              marginBottom: "10px",
            }}
          >
            2. Document Translation (.docx, .pdf)
          </div>
          <input
            type="file"
            accept=".docx, .pdf"
            onChange={(e) => setSelectedFile(e.target.files[0])}
            style={{ marginBottom: "10px", fontSize: "0.85rem" }}
          />
          <button
            className="dd-scan-btn"
            onClick={handleDocumentTranslate}
            disabled={loading || !selectedFile}
            style={{ backgroundColor: "#10b981" }} // Green variation for documents
          >
            Translate & Download Document
          </button>
        </div>

        {/* Output Section */}
        <div className="dd-models-breakdown" style={{ marginTop: "0" }}>
          <div className="dd-models-title">Urdu Output</div>
          <div
            style={{
              background: "#f9fafb",
              padding: "12px",
              borderRadius: "6px",
              border: "1px solid #e5e7eb",
              minHeight: "100px",
              fontFamily: "Jameel Noori Nastaleeq, Arial, sans-serif", // Standard Urdu font
              fontSize: "1.2rem",
              direction: "rtl",
              textAlign: "right",
            }}
          >
            {loading ? (
              <span
                className="dd-spinner"
                style={{
                  borderColor: "#1a6b5a",
                  borderTopColor: "transparent",
                }}
              ></span>
            ) : (
              translatedText
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
