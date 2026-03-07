import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

// This global audio context unlocking ensures the browser trusts subsequent audio.plays()
export const globalAudioContext = new Audio();
globalAudioContext.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="; // 1ms silent wav

const Landing = () => {
    const navigate = useNavigate();
    const [resumeFile, setResumeFile] = useState(null);
    const [isParsing, setIsParsing] = useState(false);

    const handleStartInterview = async () => {
        setIsParsing(true);
        // Unlock audio
        try { globalAudioContext.play().catch(e => console.warn("Audio unlock prevented", e)); } catch(e){}

        const session_id = Math.random().toString(36).substring(7);

        try {
            if (resumeFile) {
                const formData = new FormData();
                formData.append("file", resumeFile);
                formData.append("session_id", session_id);
                await axios.post("http://localhost:8000/ai/parse_resume", formData);
            }
            
            // Generate welcome audio (non-blocking) before navigate
            axios.post("http://localhost:8000/ai/welcome", { code: "", problemId: 1 }).then(res => {
                 if(res.data.audio) {
                     sessionStorage.setItem(`welcomeAudio_${session_id}`, res.data.audio);
                 }
            }).catch(e => console.error(e));

            // Navigate to interview
            navigate(`/interview/1?session=${session_id}`);

        } catch (err) {
            console.error("Error setting up interview:", err);
            navigate(`/interview/1?session=${session_id}`);
        } finally {
            setIsParsing(false);
        }
    };

    return (
        <div style={{ display: "flex", height: "100vh", backgroundColor: "#0f0f0f", color: "white", fontFamily: "sans-serif", justifyContent: "center", alignItems: "center" }}>
            <div style={{ background: "#1a1a1a", padding: "40px", borderRadius: "12px", textAlign: "center", border: "1px solid #333", maxWidth: "450px" }}>
                <h1 style={{ marginBottom: "10px", color: "#00aaff" }}>AI Coding Interview</h1>
                <p style={{ marginBottom: "20px", color: "#888" }}>Welcome to your technical assessment. You will have 15 minutes to solve the challenge. Make sure your microphone and speakers are ready.</p>
                
                <div style={{ background: "#252526", padding: "20px", borderRadius: "8px", marginBottom: "30px", border: "1px solid #333" }}>
                    <p style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#ccc" }}>Optional: Upload your resume for a personalized evaluation experience.</p>
                    <input 
                    type="file" 
                    accept=".pdf,.docx,.txt" 
                    onChange={(e) => setResumeFile(e.target.files[0])}
                    style={{ fontSize: "12px", color: "#888" }}
                    />
                </div>

                <button onClick={handleStartInterview} disabled={isParsing} style={{ padding: "15px 40px", background: isParsing ? "#444" : "#00aaff", color: "white", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: "pointer", fontSize: "18px", boxShadow: "0 4px 15px rgba(0, 170, 255, 0.3)" }}>
                    {isParsing ? "Preparing Session..." : "Begin Interview"}
                </button>
            </div>
        </div>
    );
};

export default Landing;
