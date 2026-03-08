import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import axios from "axios";
import { globalAudioContext } from "./Landing"; 

const Interview = () => {
  const { problemId } = useParams();
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session") || "default";
  const navigate = useNavigate();

  const lastMsgCount = useRef(0);

  // ── UI Layout State ──────────────────────────────────────────
  const [isDark, setIsDark] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(true);

  // ── App State ─────────────────────────────────────────────────
  const [problem, setProblem] = useState(null);
  const [code, setCode] = useState(`#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}`);
  const [userInput, setUserInput] = useState("");
  const [output, setOutput] = useState("");
  const [chatLog, setChatLog] = useState([{ role: "AI", text: "Welcome! I'm your tutor for today. Start by reading the problem on the left.", level: 0 }]);
  const [chatHistory, setChatHistory] = useState([]);
  const [timeLeft, setTimeLeft] = useState(900);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const welcomePlayed = useRef(false);
  const chatEndRef = useRef(null);

  // ── Theme tokens ────────────────────────────────────────────
  const T = {
    bg:        isDark ? "#0f0f0f" : "#f0f2f5",
    panel:     isDark ? "#1a1a1a" : "#ffffff",
    panel2:    isDark ? "#252526" : "#e8eaed",
    border:    isDark ? "#333"    : "#ccc",
    text:      isDark ? "#e0e0e0" : "#1a1a1a",
    muted:     isDark ? "#888"    : "#555",
    accent:    "#007acc",
    aiMsg:     isDark ? "#2d2d2d" : "#e3eeff",
    aiBorder:  isDark ? "#444"    : "#b3cfff",
    userMsg:   isDark ? "#004d99" : "#007acc",
    input:     isDark ? "#000"    : "#fff",
    inputText: isDark ? "#fff"    : "#000",
  };

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog, isThinking]);

  // Play audio safely
  const playBase64Audio = useCallback((base64String) => {
    try {
      if (!base64String) return;
      globalAudioContext.src = "data:audio/wav;base64," + base64String;
      globalAudioContext.play().catch(e => console.error("Audio playback error:", e));
    } catch (e) { console.error(e); }
  }, []);

  // Fetch Problem
  useEffect(() => {
    const fetchProblem = async () => {
      try {
        const res = await axios.get(`${API_URL}/problem/${problemId || 1}`);
        setProblem(res.data);
      } catch (err) { console.error("Error fetching problem:", err); }
    };
    fetchProblem();
  }, [problemId]);

  // Welcome audio
  useEffect(() => {
    if (problem && !welcomePlayed.current) {
      welcomePlayed.current = true;
      const savedAudio = sessionStorage.getItem(`welcomeAudio_${sessionId}`);
      if (savedAudio) {
        playBase64Audio(savedAudio);
        sessionStorage.removeItem(`welcomeAudio_${sessionId}`);
      } else {
        axios.post(`${API_URL}/ai/welcome`, { code: "", problemId: problemId || 1 })
          .then(res => { if (res.data.audio) playBase64Audio(res.data.audio); })
          .catch(e => console.log(e));
      }
    }
  }, [problem, playBase64Audio, sessionId, problemId]);

  const triggerAIAnalysis = useCallback(async (type) => {
    setIsThinking(true);
    try {
      const res = await axios.post(`${API_URL}/ai/${type}`, {
        code, problemId: problemId || 1, session_id: sessionId
      });
      setChatLog(prev => [...prev, { role: "AI", text: res.data.feedback }]);
      if (res.data.level !== undefined) setHintLevel(res.data.level);
      if (res.data.audio) playBase64Audio(res.data.audio);
    } catch (err) {
      console.error("AI Error:", err.response?.data || err.message);
    } finally { setIsThinking(false); }
  }, [code, problemId, sessionId, playBase64Audio]);

  const stopAudio = useCallback(() => {
    try { globalAudioContext.pause(); globalAudioContext.currentTime = 0; } catch (e) {}
  }, []);

  const handleEndInterview = useCallback(() => {
    stopAudio();
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} setIsRecording(false); }
    navigate(`/analysis?session=${sessionId}`);
  }, [stopAudio, sessionId, navigate]);

  const handleFinalSubmit = useCallback(async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    stopAudio();
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} setIsRecording(false); }
    try {
      const res = await axios.post(`${API_URL}/ai/evaluation`, { code, problemId: problemId || 1, session_id: sessionId });
      setChatLog(prev => [...prev, { role: "SYSTEM", text: "SUBMITTED" }, { role: "AI", text: res.data.feedback }]);
      if (res.data.audio) playBase64Audio(res.data.audio);
      setTimeout(() => navigate(`/analysis?session=${sessionId}`), 6000);
    } catch (err) {
      console.error("Evaluation Error", err);
      navigate(`/analysis?session=${sessionId}`);
    }
    setIsSubmitting(false);
  }, [isSubmitting, code, problemId, sessionId, playBase64Audio, stopAudio, navigate]);

  const sendChatMessage = useCallback(async (msg) => {
    const text = msg || chatInput;
    if (!text.trim()) return;
    setChatLog(prev => [...prev, { role: "USER", text }]);
    setChatInput("");
    setIsThinking(true);
    try {
      const res = await axios.post(`${API_URL}/ai/chat`, {
        message: text, session_id: sessionId, code, problemId: problemId || 1, history: chatHistory
      });
      const aiReply = res.data.feedback;
      setChatLog(prev => [...prev, { role: "AI", text: aiReply }]);
      setChatHistory(prev => [...prev, { role: "user", content: text }, { role: "assistant", content: aiReply }]);
      if (res.data.audio) playBase64Audio(res.data.audio);
    } catch (err) { console.error("Chat Error:", err); }
    finally { setIsThinking(false); }
  }, [chatInput, chatHistory, code, problemId, sessionId, playBase64Audio]);

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      if (!('webkitSpeechRecognition' in window)) {
        alert("Web Speech API not supported. Try Chrome.");
        return;
      }
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      const initialInput = chatInput;
      let finalTranscript = '';
      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
          else interimTranscript += event.results[i][0].transcript;
        }
        setChatInput(initialInput + (initialInput ? " " : "") + finalTranscript + interimTranscript);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
      recognition.start();
    }
  };

  const syncWithBackend = useCallback(async (currentOutput) => {
    if (!problem) return;
    try {
      const res = await axios.post(`${API_URL}/update_code`, {
        session_id: sessionId, problem_statement: problem.description, current_code: code, compiler_output: currentOutput || output
      });
      if (res.data.messages) {
        const aiMessages = res.data.messages.filter(m => m.role === "AI");
        if (aiMessages.length > lastMsgCount.current) {
          setChatLog(prev => [...prev, ...aiMessages.slice(lastMsgCount.current)]);
          lastMsgCount.current = aiMessages.length;
        }
      }
      if (res.data.audio) playBase64Audio(res.data.audio);
    } catch (err) { console.error("Sync Error:", err); }
  }, [code, output, problem, sessionId, playBase64Audio]);

  useEffect(() => {
    if (timeLeft <= 0) { handleFinalSubmit(); return; }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, handleFinalSubmit]);

  useEffect(() => {
    if (timeLeft > 0 && timeLeft < 900 && (900 - timeLeft) % 60 === 0) triggerAIAnalysis("periodic");
  }, [timeLeft, triggerAIAnalysis]);

  const runCode = async () => {
    try {
      const res = await axios.post(`${API_URL}/run`, { code, input: userInput });
      setOutput(res.data.output);
      await syncWithBackend(res.data.output);
    } catch (err) { setOutput("Execution Error: " + err.message); }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60 < 10 ? '0' : '') + (s % 60)}`;

  if (!problem) return (
    <div style={{ height: '100vh', background: T.bg, color: T.text, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '18px' }}>
      Loading Workspace...
    </div>
  );

  // ── Toolbar icon styles ─────────────────────────────────────
  const iconBtn = (bg = "#333") => ({
    background: bg, border: "none", color: "#fff", padding: "6px 10px",
    borderRadius: "6px", cursor: "pointer", fontSize: "14px",
    display: "flex", alignItems: "center", gap: "4px",
    transition: "opacity 0.2s",
  });

  return (
    <div style={{ display: "flex", height: "100vh", background: T.bg, color: T.text, fontFamily: "'Inter', sans-serif", overflow: "hidden", transition: "background 0.3s" }}>

      {/* ── LEFT: Problem Description (hidden in fullscreen) ─────── */}
      {!isFullscreen && (
        <div style={{ width: "300px", flexShrink: 0, display: "flex", flexDirection: "column", borderRight: `1px solid ${T.border}`, background: T.panel, padding: "20px", overflowY: "auto", transition: "background 0.3s" }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', color: T.text }}>{problem.title}</h2>
            <span style={{ background: '#ff4d4d', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>{problem.difficulty}</span>
          </div>
          <hr style={{ borderColor: T.border, margin: '10px 0' }} />
          <p style={{ whiteSpace: "pre-wrap", lineHeight: "1.7", fontSize: "13px", color: T.muted }}>{problem.description}</p>
        </div>
      )}

      {/* ── MIDDLE: Editor + Toolbar ─────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: showChat && !isFullscreen ? `1px solid ${T.border}` : "none", minWidth: 0 }}>

        {/* Toolbar */}
        <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", background: T.panel2, borderBottom: `1px solid ${T.border}`, gap: "8px", flexWrap: "wrap" }}>
          
          {/* Left: Timer + layout buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ color: timeLeft < 60 ? "#ff4d4d" : "#00cc66", fontWeight: "bold", fontSize: "15px", minWidth: "110px" }}>
              ⏳ {formatTime(timeLeft)}
            </span>

            {/* Fullscreen toggle */}
            <button style={iconBtn("#444")} title={isFullscreen ? "Exit fullscreen" : "Fullscreen editor"}
              onClick={() => setIsFullscreen(f => !f)}>
              {isFullscreen ? "⬛ Exit Full" : "⛶ Full"}
            </button>

            {/* Chat panel toggle */}
            {!isFullscreen && (
              <button style={iconBtn(showChat ? "#005f99" : "#444")} title={showChat ? "Hide chat panel" : "Show chat panel"}
                onClick={() => setShowChat(s => !s)}>
                {showChat ? "💬 Hide Chat" : "💬 Show Chat"}
              </button>
            )}

            {/* Dark/Light toggle */}
            <button style={iconBtn(isDark ? "#555" : "#fbbf24")} title="Toggle dark/light mode"
              onClick={() => setIsDark(d => !d)}>
              {isDark ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>

          {/* Right: Action buttons */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={handleEndInterview} title="Stop and exit"
              style={{ ...iconBtn("#cc0000"), fontWeight: 'bold', padding: "7px 14px" }}>
              🛑 End
            </button>
            <button onClick={handleFinalSubmit} disabled={isSubmitting} title="Submit for evaluation"
              style={{ ...iconBtn(isSubmitting ? "#555" : "#28a745"), fontWeight: 'bold', padding: "7px 14px", cursor: isSubmitting ? "not-allowed" : "pointer" }}>
              {isSubmitting ? "⏳ Submitting..." : "✅ Submit"}
            </button>
          </div>
        </div>

        {/* Monaco Editor */}
        <Editor
          height={isFullscreen ? "75vh" : "62vh"}
          theme={isDark ? "vs-dark" : "vs"}
          defaultLanguage="cpp"
          value={code}
          onChange={setCode}
          options={{ fontSize: 14, minimap: { enabled: false }, scrollBeyondLastLine: false }}
        />

        {/* Input / Output */}
        <div style={{ padding: "10px 15px", display: "flex", gap: "12px", background: T.panel2, borderTop: `1px solid ${T.border}`, flex: 1 }}>
          <div style={{ flex: 1 }}>
            <small style={{ color: T.muted }}>Input (stdin):</small>
            <textarea style={{ width: "95%", height: "70px", background: T.input, color: isDark ? "#00ff00" : "#000", border: `1px solid ${T.border}`, padding: "8px", marginTop: '4px', borderRadius: '4px', fontFamily: 'monospace', resize: 'none' }}
              value={userInput} onChange={(e) => setUserInput(e.target.value)} />
            <button onClick={runCode} style={{ width: "100%", marginTop: "6px", padding: "9px", background: T.accent, color: "white", border: "none", cursor: "pointer", borderRadius: '4px', fontWeight: 'bold' }}>
              ▶ Run Tests
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <small style={{ color: T.muted }}>Console Output:</small>
            <pre style={{ background: T.input, height: "100px", padding: "8px", overflow: "auto", margin: '4px 0 0 0', fontSize: "13px", color: isDark ? "#00ff00" : "#007700", border: `1px solid ${T.border}`, borderRadius: '4px' }}>
              {output || "Output will appear here..."}
            </pre>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Chat Panel (collapsible) ─────────────────────── */}
      {showChat && !isFullscreen && (
        <div style={{ width: "340px", flexShrink: 0, display: "flex", flexDirection: "column", background: T.panel, transition: "background 0.3s" }}>

          {/* Chat header */}
          <div style={{ padding: "12px 15px", borderBottom: `1px solid ${T.border}`, fontWeight: "bold", textAlign: "center", background: T.panel2, fontSize: "14px" }}>
            🤖 AI Code Tutor
          </div>

          {/* Chat messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {chatLog.map((msg, i) => (
              <div key={i} style={{
                alignSelf: msg.role === "USER" ? "flex-end" : "flex-start",
                maxWidth: "88%",
                padding: "10px 14px",
                borderRadius: "14px",
                background: msg.role === "AI" ? T.aiMsg : T.userMsg,
                border: msg.role === "AI" ? `1px solid ${T.aiBorder}` : "none",
                boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              }}>
                <small style={{ color: msg.role === "AI" ? "#00aaff" : "#cce5ff", fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>{msg.role}</small>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", lineHeight: "1.5", color: T.text, whiteSpace: "pre-wrap" }}>{msg.text}</p>
              </div>
            ))}
            {isThinking && (
              <div style={{ alignSelf: "flex-start", background: T.aiMsg, padding: "8px 14px", borderRadius: "12px", fontSize: "12px", color: T.muted, fontStyle: "italic" }}>
                AI is thinking...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div style={{ padding: "8px 12px", background: T.panel2, borderTop: `1px solid ${T.border}`, display: "flex", gap: "6px" }}>
            <input type="text" value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
              placeholder="Ask a question..."
              style={{ flex: 1, background: T.input, color: T.inputText, border: `1px solid ${T.border}`, borderRadius: "6px", padding: "8px 10px", fontSize: "13px", outline: "none" }} />
            <button onClick={() => sendChatMessage()} style={iconBtn(T.accent)}>Send</button>
            <button onClick={toggleRecording} style={iconBtn(isRecording ? "#ff4d4d" : "#444")} title="Voice input">
              {isRecording ? "🔴" : "🎙️"}
            </button>
          </div>

          {/* Hints section */}
          <div style={{ padding: "12px 15px", background: T.panel2, borderTop: `1px solid ${T.border}` }}>
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <small style={{ color: T.muted, fontSize: '12px' }}>Hint Level:</small>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[1, 2, 3, 4, 5].map(l => (
                  <div key={l} style={{ width: '22px', height: '6px', borderRadius: '3px', background: l <= hintLevel ? '#f59e0b' : T.border, transition: 'background 0.3s' }} />
                ))}
              </div>
            </div>
            <button onClick={() => triggerAIAnalysis("hint")} disabled={isThinking}
              style={{ width: "100%", padding: "11px", background: isThinking ? "#555" : "#f59e0b", color: "black", fontWeight: "bold", border: "none", cursor: isThinking ? "not-allowed" : "pointer", borderRadius: '6px', transition: 'background 0.2s', fontSize: '13px' }}>
              {isThinking ? "Consulting..." : "💡 I'm Stuck, Give me a Hint"}
            </button>
          </div>
        </div>
      )}

      {/* Floating chat toggle when in fullscreen or chat is hidden */}
      {(isFullscreen || !showChat) && (
        <button
          onClick={() => { setIsFullscreen(false); setShowChat(true); }}
          title="Show Chat & Hints"
          style={{
            position: "fixed", bottom: "24px", right: "24px",
            background: "#f59e0b", color: "#000", border: "none",
            borderRadius: "50%", width: "52px", height: "52px",
            fontSize: "22px", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.2s",
          }}
        >
          💬
        </button>
      )}
    </div>
  );
};

export default Interview;
