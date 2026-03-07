import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";

const Analysis = () => {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get("session");
    const navigate = useNavigate();
    const [report, setReport] = useState("Loading final analysis...");

    useEffect(() => {
        if (!sessionId) {
            navigate("/");
            return;
        }
        
        // Fetch the generated evaluation report string from the backend session
        const fetchAnalysis = async () => {
            try {
                const res = await axios.get(`http://localhost:8000/session/${sessionId}/analysis`);
                setReport(res.data.analysis || "No analysis found for this session.");
            } catch (err) {
                console.error("Analysis fetch error:", err);
                setReport("Failed to load interview analysis. Please ensure the backend supports fetching it.");
            }
        };
        fetchAnalysis();
    }, [sessionId, navigate]);

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "#0f0f0f", color: "white", fontFamily: "sans-serif", padding: "40px" }}>
            <div style={{ maxWidth: "800px", margin: "0 auto", background: "#1a1a1a", padding: "40px", borderRadius: "12px", border: "1px solid #333" }}>
                <h1 style={{ color: "#00aaff", marginBottom: "20px", borderBottom: "1px solid #333", paddingBottom: "10px" }}>
                    Interview Analysis Report
                </h1>
                
                <div style={{ background: "#252526", padding: "20px", borderRadius: "8px", border: "1px solid #444" }}>
                    <p style={{ whiteSpace: "pre-wrap", lineHeight: "1.8", color: "#e0e0e0", fontSize: "16px" }}>
                        {report}
                    </p>
                </div>

                <div style={{ marginTop: "30px", textAlign: "center" }}>
                    <button onClick={() => navigate("/")} style={{ padding: "12px 30px", background: "#007acc", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>
                        Start New Interview
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Analysis;
