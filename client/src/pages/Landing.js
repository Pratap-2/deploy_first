import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import bgImage from "../assets/ghibli_bg.png";
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
    Tooltip, ResponsiveContainer
} from "recharts";

// This global audio context unlocking ensures the browser trusts subsequent audio.plays()
export const globalAudioContext = new Audio();
globalAudioContext.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="; // 1ms silent wav

const CHART_COLORS = ["#00aaff", "#f59e0b", "#10b981", "#a855f7", "#ef4444", "#06b6d4", "#84cc16"];

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ background: "rgba(20,20,30,0.95)", border: "1px solid #444", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", color: "#fff" }}>
                <strong>{payload[0].name}</strong>: {payload[0].value}
            </div>
        );
    }
    return null;
};

const Landing = () => {
    const navigate = useNavigate();
    const [resumeFile, setResumeFile] = useState(null);
    const [isParsing, setIsParsing] = useState(false);
    const [parsedData, setParsedData] = useState(null);
    const [rawData, setRawData] = useState(null);
    const [sessionId] = useState(Math.random().toString(36).substring(7));

    const handleUpload = async () => {
        if (!resumeFile) return;
        setIsParsing(true);
        try {
            const formData = new FormData();
            formData.append("file", resumeFile);
            formData.append("session_id", sessionId);
            const res = await axios.post("http://localhost:8000/ai/parse_resume", formData);
            if (res.data.success) {
                const cv = res.data.data || {};
                setRawData(cv);

                // Build summary text for backward compat
                const name = cv.name || "Candidate";
                const skills = (cv.skills && Object.values(cv.skills).flat().filter(Boolean).join(", ")) || "Extracted core skills.";
                const summary = `Name: ${name}\nSkills Detected: ${skills}\nExperience Length: ${cv.experience ? cv.experience.length : 0} roles.\n\nYour interviewer has saved this context to personalize your questions.`;
                setParsedData(summary);
            } else {
                setParsedData("Failed to parse resume, but you can still proceed.");
                setRawData(null);
            }
        } catch (err) {
            console.error("Resume parsing error:", err);
            setParsedData("Network error while parsing resume, but you can still proceed.");
            setRawData(null);
        } finally {
            setIsParsing(false);
        }
    };

    const handleStartInterview = async () => {
        try { globalAudioContext.play().catch(e => console.warn("Audio unlock prevented", e)); } catch(e){}
        axios.post("http://localhost:8000/ai/welcome", { code: "", problemId: 1 }).then(res => {
             if(res.data.audio) {
                 sessionStorage.setItem(`welcomeAudio_${sessionId}`, res.data.audio);
             }
        }).catch(e => console.error(e));
        navigate(`/interview/1?session=${sessionId}`);
    };

    // Prepare chart data from skills object: { languages: [], tools: [], concepts: [] }
    const getSkillsPieData = () => {
        if (!rawData || !rawData.skills) return [];
        const sk = rawData.skills;
        const data = [];
        if (sk.languages && sk.languages.length) data.push({ name: "Languages", value: sk.languages.length });
        if (sk.tools && sk.tools.length) data.push({ name: "Tools & Frameworks", value: sk.tools.length });
        if (sk.concepts && sk.concepts.length) data.push({ name: "Concepts", value: sk.concepts.length });
        return data;
    };

    const getBarData = () => {
        if (!rawData) return [];
        return [
            { name: "Projects", count: rawData.projects ? rawData.projects.length : 0 },
            { name: "Experience", count: rawData.experience ? rawData.experience.length : 0 },
            { name: "Education", count: rawData.education ? rawData.education.length : 0 },
            { name: "Achievements", count: rawData.achievements ? rawData.achievements.length : 0 },
        ];
    };

    const skillsPieData = getSkillsPieData();
    const barData = getBarData();

    return (
        <div style={{ 
            minHeight: "100vh", 
            width: "100vw",
            backgroundImage: `url(${bgImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            display: "flex", 
            justifyContent: "center", 
            alignItems: parsedData && rawData ? "flex-start" : "center",
            fontFamily: "'Inter', 'Segoe UI', sans-serif",
            padding: parsedData && rawData ? "30px 0" : "0",
            overflowY: "auto"
        }}>
            {/* Dark overlay */}
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.65)", zIndex: 0 }} />

            {/* --- UPLOAD SECTION (no parsed data yet) --- */}
            {!parsedData && (
                <div style={{ 
                    background: "rgba(20, 20, 30, 0.88)", 
                    padding: "50px", 
                    borderRadius: "20px", 
                    textAlign: "center", 
                    boxShadow: "0 8px 40px rgba(0, 0, 0, 0.6)", 
                    maxWidth: "500px",
                    zIndex: 1,
                    backdropFilter: "blur(14px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "white",
                    width: "90%"
                }}>
                    <div style={{ fontSize: "42px", marginBottom: "12px" }}>🤖</div>
                    <h1 style={{ marginBottom: "10px", color: "#66ccff", fontSize: "2.4rem", textShadow: "0 2px 8px rgba(0,170,255,0.3)", margin: "0 0 10px 0" }}>
                        AI Code Sensei
                    </h1>
                    <p style={{ marginBottom: "30px", color: "#aaa", fontSize: "1rem", lineHeight: "1.6", margin: "10px 0 30px 0" }}>
                        A stress-free AI interview environment. 15 minutes to solve a challenge with your personal AI tutor.
                    </p>
                    
                    <div style={{ background: "rgba(0,0,0,0.4)", padding: "24px", borderRadius: "14px", marginBottom: "28px", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <p style={{ margin: "0 0 15px 0", fontSize: "14px", color: "#bbb" }}>
                            📄 Upload your resume for a personalized experience
                        </p>
                        <label style={{ display: "block", cursor: "pointer", background: "rgba(0,170,255,0.08)", border: "2px dashed rgba(0,170,255,0.3)", borderRadius: "10px", padding: "18px", transition: "border-color 0.2s" }}>
                            <input 
                                type="file" 
                                accept=".pdf,.docx,.txt" 
                                onChange={(e) => setResumeFile(e.target.files[0])}
                                style={{ display: "none" }}
                            />
                            {resumeFile ? (
                                <span style={{ color: "#66ccff", fontSize: "14px" }}>📎 {resumeFile.name}</span>
                            ) : (
                                <span style={{ color: "#666", fontSize: "14px" }}>Click to choose a PDF, DOCX, or TXT file</span>
                            )}
                        </label>
                        {resumeFile && (
                            <button 
                                onClick={handleUpload} 
                                disabled={isParsing} 
                                style={{ 
                                    width: "100%", marginTop: "16px", padding: "13px", 
                                    background: isParsing ? "#333" : "linear-gradient(135deg, #007acc, #005fa3)", 
                                    color: "white", border: "none", borderRadius: "10px", 
                                    fontWeight: "700", cursor: isParsing ? "not-allowed" : "pointer", 
                                    fontSize: "15px", letterSpacing: "0.3px",
                                    boxShadow: isParsing ? "none" : "0 4px 15px rgba(0,122,204,0.4)",
                                    transition: "all 0.2s"
                                }}
                            >
                                {isParsing ? "⟳ Analyzing Resume..." : "🔍 Upload & Analyze Resume"}
                            </button>
                        )}
                    </div>

                    <button 
                        onClick={handleStartInterview} 
                        style={{ 
                            padding: "15px 40px", background: "linear-gradient(135deg, #28a745, #1e7d34)", 
                            color: "white", border: "none", borderRadius: "10px", 
                            fontWeight: "bold", cursor: "pointer", fontSize: "17px", 
                            width: "100%", boxShadow: "0 4px 20px rgba(40, 167, 69, 0.4)", 
                            transition: "transform 0.2s, box-shadow 0.2s" 
                        }}
                        onMouseOver={(e) => { e.target.style.transform = "scale(1.02)"; e.target.style.boxShadow = "0 6px 25px rgba(40,167,69,0.6)"; }}
                        onMouseOut={(e) => { e.target.style.transform = "scale(1)"; e.target.style.boxShadow = "0 4px 20px rgba(40, 167, 69, 0.4)"; }}
                    >
                        ⚡ Skip & Begin Interview
                    </button>
                </div>
            )}

            {/* --- PERSONALIZED DASHBOARD AFTER PARSING --- */}
            {parsedData && (
                <div style={{ zIndex: 1, width: "min(96vw, 980px)", color: "white" }}>
                    {/* Header Card */}
                    <div style={{ background: "rgba(20,20,30,0.9)", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.1)", padding: "30px 36px", marginBottom: "22px", backdropFilter: "blur(14px)", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                                <span style={{ fontSize: "32px" }}>✅</span>
                                <h1 style={{ margin: 0, color: "#4caf50", fontSize: "1.7rem" }}>Profile Analyzed</h1>
                            </div>
                            {rawData && (
                                <p style={{ margin: 0, color: "#aaa", fontSize: "15px" }}>
                                    Welcome, <strong style={{ color: "#66ccff" }}>{rawData.name || "Candidate"}</strong>! Your profile has been personalized for the interview.
                                </p>
                            )}
                            {rawData?.contact?.email && (
                                <p style={{ margin: "6px 0 0 0", color: "#888", fontSize: "13px" }}>📧 {rawData.contact.email}</p>
                            )}
                            {rawData?.contact?.github && (
                                <p style={{ margin: "4px 0 0 0", color: "#888", fontSize: "13px" }}>🔗 {rawData.contact.github}</p>
                            )}
                            {rawData?.contact?.linkedin && (
                                <p style={{ margin: "4px 0 0 0", color: "#888", fontSize: "13px" }}>💼 {rawData.contact.linkedin}</p>
                            )}
                        </div>
                        <button
                            onClick={handleStartInterview}
                            style={{
                                padding: "15px 36px", background: "linear-gradient(135deg, #00aaff, #0077cc)",
                                color: "white", border: "none", borderRadius: "12px", fontWeight: "800",
                                cursor: "pointer", fontSize: "16px", boxShadow: "0 4px 20px rgba(0,170,255,0.4)",
                                transition: "transform 0.2s, box-shadow 0.2s", letterSpacing: "0.5px", whiteSpace: "nowrap"
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 6px 30px rgba(0,170,255,0.6)"; }}
                            onMouseOut={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,170,255,0.4)"; }}
                        >
                            🚀 Enter Interview Room
                        </button>
                    </div>

                    {/* Charts Row */}
                    {rawData && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px", marginBottom: "22px" }}>
                            {/* Pie Chart - Skills Breakdown */}
                            <div style={{ background: "rgba(20,20,30,0.9)", borderRadius: "18px", border: "1px solid rgba(255,255,255,0.08)", padding: "24px", backdropFilter: "blur(14px)", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
                                <h3 style={{ margin: "0 0 20px 0", color: "#ccc", fontSize: "15px", fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                                    🧠 Skills Breakdown
                                </h3>
                                {skillsPieData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={220}>
                                        <PieChart>
                                            <Pie
                                                data={skillsPieData}
                                                cx="50%"
                                                cy="50%"
                                                outerRadius={80}
                                                innerRadius={40}
                                                dataKey="value"
                                                label={({ name, value }) => `${name} (${value})`}
                                                labelLine={{ stroke: "#555" }}
                                            >
                                                {skillsPieData.map((entry, idx) => (
                                                    <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <p style={{ color: "#555", textAlign: "center", paddingTop: "60px" }}>No skill categories found</p>
                                )}
                                {/* Skill tags */}
                                {rawData.skills && (
                                    <div style={{ marginTop: "14px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                                        {Object.entries(rawData.skills).flatMap(([cat, items]) =>
                                            (items || []).slice(0, 5).map((s, i) => (
                                                <span key={cat + i} style={{ background: "rgba(0,170,255,0.15)", border: "1px solid rgba(0,170,255,0.3)", color: "#00aaff", padding: "3px 10px", borderRadius: "20px", fontSize: "12px" }}>{s}</span>
                                            ))
                                        )}
                                        {Object.values(rawData.skills || {}).flat().length > 15 && (
                                            <span style={{ color: "#555", fontSize: "12px", alignSelf: "center" }}>+{Object.values(rawData.skills || {}).flat().length - 15} more</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Bar Chart - Profile Overview */}
                            <div style={{ background: "rgba(20,20,30,0.9)", borderRadius: "18px", border: "1px solid rgba(255,255,255,0.08)", padding: "24px", backdropFilter: "blur(14px)", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
                                <h3 style={{ margin: "0 0 20px 0", color: "#ccc", fontSize: "15px", fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                                    📊 Profile Overview
                                </h3>
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                        <XAxis dataKey="name" tick={{ fill: "#aaa", fontSize: 12 }} axisLine={{ stroke: "#333" }} tickLine={false} />
                                        <YAxis tick={{ fill: "#aaa", fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={55}>
                                            {barData.map((entry, idx) => (
                                                <Cell key={idx} fill={CHART_COLORS[(idx + 2) % CHART_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Projects + Experience Row */}
                    {rawData && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px", marginBottom: "22px" }}>
                            {/* Projects */}
                            <div style={{ background: "rgba(20,20,30,0.9)", borderRadius: "18px", border: "1px solid rgba(255,255,255,0.08)", padding: "24px", backdropFilter: "blur(14px)", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
                                <h3 style={{ margin: "0 0 16px 0", color: "#ccc", fontSize: "15px", fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase" }}>🛠 Projects ({rawData.projects?.length || 0})</h3>
                                {rawData.projects && rawData.projects.length > 0 ? (
                                    rawData.projects.slice(0, 4).map((proj, i) => (
                                        <div key={i} style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: "10px", padding: "12px 15px", marginBottom: "10px" }}>
                                            <p style={{ margin: 0, color: "#f59e0b", fontWeight: "700", fontSize: "14px" }}>
                                                {typeof proj === "string" ? proj : (proj.name || proj.title || `Project ${i + 1}`)}
                                            </p>
                                            {typeof proj === "object" && (proj.description || proj.tech) && (
                                                <p style={{ margin: "4px 0 0 0", color: "#888", fontSize: "12px", lineHeight: "1.4" }}>
                                                    {proj.description || proj.tech}
                                                </p>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <p style={{ color: "#555", fontSize: "13px" }}>No projects extracted</p>
                                )}
                            </div>

                            {/* Experience */}
                            <div style={{ background: "rgba(20,20,30,0.9)", borderRadius: "18px", border: "1px solid rgba(255,255,255,0.08)", padding: "24px", backdropFilter: "blur(14px)", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
                                <h3 style={{ margin: "0 0 16px 0", color: "#ccc", fontSize: "15px", fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase" }}>💼 Experience ({rawData.experience?.length || 0})</h3>
                                {rawData.experience && rawData.experience.length > 0 ? (
                                    rawData.experience.slice(0, 4).map((exp, i) => (
                                        <div key={i} style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "10px", padding: "12px 15px", marginBottom: "10px" }}>
                                            <p style={{ margin: 0, color: "#10b981", fontWeight: "700", fontSize: "14px" }}>
                                                {typeof exp === "string" ? exp : (exp.role || exp.title || exp.company || `Role ${i + 1}`)}
                                            </p>
                                            {typeof exp === "object" && (exp.company || exp.duration) && (
                                                <p style={{ margin: "4px 0 0 0", color: "#888", fontSize: "12px" }}>
                                                    {[exp.company, exp.duration].filter(Boolean).join(" · ")}
                                                </p>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <p style={{ color: "#555", fontSize: "13px" }}>No experience extracted</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Fallback text-only card if rawData is null */}
                    {!rawData && (
                        <div style={{ background: "rgba(20,20,30,0.9)", borderRadius: "18px", border: "1px solid rgba(255,255,255,0.08)", padding: "24px", marginBottom: "22px", backdropFilter: "blur(14px)", color: "#aaa", fontSize: "14px", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>
                            {parsedData}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Landing;
