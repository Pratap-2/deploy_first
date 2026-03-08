import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import congratsImage from "../assets/motivational_congrats.png";

const Analysis = () => {
    const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get("session");
    const navigate = useNavigate();
    const [report, setReport] = useState("Loading final analysis...");
    const [scores, setScores] = useState([]);

    useEffect(() => {
        if (!sessionId) {
            navigate("/");
            return;
        }
        
        const fetchAnalysis = async () => {
            try {
                const res = await axios.get(`${API_URL}/session/${sessionId}/analysis`);
                setReport(res.data.analysis || "No analysis found for this session.");
                setScores(res.data.progress_scores || []);
            } catch (err) {
                console.error("Analysis fetch error:", err);
                setReport("Failed to load interview analysis. Please ensure the backend supports fetching it.");
            }
        };
        fetchAnalysis();
    }, [sessionId, navigate]);

    return (
        <div style={{ minHeight: "100vh", backgroundColor: "#0f0f0f", color: "white", fontFamily: "sans-serif", padding: "40px" }}>
            <div style={{ maxWidth: "900px", margin: "0 auto", background: "#1a1a1a", padding: "40px", borderRadius: "12px", border: "1px solid #333" }}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: "1px solid #333", paddingBottom: "20px", marginBottom: "30px"}}>
                    <div>
                        <h1 style={{ color: "#00aaff", margin: "0 0 10px 0" }}>
                            Interview Analysis Report
                        </h1>
                        <p style={{ margin: 0, color: "#aaa", fontSize: "16px" }}>Great job completing the challenge! Here is your feedback.</p>
                    </div>
                    <img src={congratsImage} alt="Success Celebration" style={{ width: "120px", height: "120px", borderRadius: "50%", objectFit: "cover", border: "3px solid #00aaff", boxShadow: "0 0 15px rgba(0, 170, 255, 0.4)" }} />
                </div>
                
                <div style={{ display: "flex", gap: "20px", flexDirection: "column" }}>
                    {/* SCORES CHART */}
                    {scores && scores.length > 0 && (
                        <div style={{ background: "#252526", padding: "20px", borderRadius: "8px", border: "1px solid #444", height: "300px" }}>
                            <h3 style={{ marginTop: 0, color: "#ccc" }}>Minute-by-minute Progress (1-100)</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={scores} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                                    <XAxis dataKey="minute" label={{ value: 'Minute', position: 'insideBottom', offset: -5, fill: '#888' }} stroke="#888" />
                                    <YAxis domain={[0, 100]} stroke="#888" />
                                    <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333" }} />
                                    <Line type="monotone" dataKey="score" stroke="#00aaff" activeDot={{ r: 8 }} strokeWidth={3} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* EXPANDABLE TEXT REPORT */}
                    <details style={{ background: "#252526", padding: "20px", borderRadius: "8px", border: "1px solid #444", cursor: "pointer" }}>
                        <summary style={{ fontSize: "18px", color: "#00aaff", fontWeight: "bold", outline: "none" }}>
                            Detailed Answer & Feedback (Click to Expand)
                        </summary>
                        <hr style={{ borderColor: "#444", margin: "15px 0" }} />
                        <p style={{ whiteSpace: "pre-wrap", lineHeight: "1.8", color: "#e0e0e0", fontSize: "16px", cursor: "text" }}>
                            {report}
                        </p>
                    </details>
                </div>

                <div style={{ marginTop: "30px", textAlign: "center", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ color: "#666", margin: 0 }}>Session ID: {sessionId}</p>
                    <button onClick={() => navigate("/")} style={{ padding: "12px 30px", background: "#007acc", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>
                        Start New Interview
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Analysis;
