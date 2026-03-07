import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import axios from "axios";
import { globalAudioContext } from "./Landing"; 

const Interview = () => {
  const { problemId } = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session") || "default";
  const navigate = useNavigate();

  const lastMsgCount = useRef(0);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  const [problem, setProblem] = useState(null);
  const [code, setCode] = useState(`#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}`);
  const [userInput, setUserInput] = useState("");
  const [output, setOutput] = useState("");
  const [chatLog, setChatLog] = useState([{ role: "AI", text: "Welcome! I'm your tutor for today. Start by reading the problem on the left.", level:0 }]);
  
  const [timeLeft, setTimeLeft] = useState(900);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const welcomePlayed = useRef(false);

  // Play audio safely
  const playBase64Audio = useCallback((base64String) => {
      try {
          if (!base64String) return;
          globalAudioContext.src = "data:audio/wav;base64," + base64String;
          globalAudioContext.play().catch(e => console.error("Audio playback error:", e));
      } catch (e) { console.error(e) }
  }, []);

  // Fetch Problem
  useEffect(() => {
    const fetchProblem = async () => {
      try {
        const res = await axios.get(`http://localhost:8000/problem/${problemId || 1}`);
        setProblem(res.data);
      } catch (err) {
        console.error("Error fetching problem:", err);
      }
    };
    fetchProblem();
  }, [problemId]);

  // Handle welcome audio once problem loads
  useEffect(() => {
    if (problem && !welcomePlayed.current) {
        welcomePlayed.current = true;
        const savedAudio = sessionStorage.getItem(`welcomeAudio_${sessionId}`);
        if(savedAudio) {
            playBase64Audio(savedAudio);
            sessionStorage.removeItem(`welcomeAudio_${sessionId}`);
        } else {
             // Fallback
             axios.post("http://localhost:8000/ai/welcome", { code: "", problemId: problemId||1 }).then(res => {
                 if(res.data.audio) playBase64Audio(res.data.audio);
             }).catch(e=>console.log(e));
        }
    }
  }, [problem, playBase64Audio, sessionId, problemId]);


  const triggerAIAnalysis = useCallback(async (type) => {
    setIsThinking(true);
    try {
      const res = await axios.post(`http://localhost:8000/ai/${type}`, { 
        code, 
        problemId: problemId || 1,
        session_id: sessionId
      });
      setChatLog(prev => [...prev, { role: "AI", text: res.data.feedback }]);
      if (res.data.level !== undefined) setHintLevel(res.data.level);
      
      if (res.data.audio) playBase64Audio(res.data.audio);
    } catch (err) {
      console.error("AI Error:", err.response?.data || err.message);
    } finally {
      setIsThinking(false);
    }
  }, [code, problemId, sessionId, playBase64Audio]);

  const handleFinalSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const res = await axios.post("http://localhost:8000/ai/evaluation", { code, problemId: problemId || 1 });
      setChatLog(prev => [...prev, { role: "SYSTEM", text: "TIME UP / SUBMITTED" }, { role: "AI", text: res.data.feedback }]);
      
      if (res.data.audio) { playBase64Audio(res.data.audio); }
      
      // Delay to let user hear final feedback, then route to analysis
      setTimeout(() => navigate(`/analysis?session=${sessionId}`), 6000);

    } catch (err) {
      console.error("Evaluation Error", err);
      navigate(`/analysis?session=${sessionId}`);
    }
    setIsSubmitting(false);
  }, [code, problemId, sessionId, playBase64Audio, navigate]);

  const sendChatMessage = useCallback(async (msg) => {
    const text = msg || chatInput;
    if (!text.trim()) return;
    
    setChatLog(prev => [...prev, { role: "USER", text: text }]);
    setChatInput("");
    setIsThinking(true);
    
    try {
      const res = await axios.post("http://localhost:8000/ai/chat", {
        message: text,
        session_id: sessionId,
        code,
        problemId: problemId || 1
      });
      setChatLog(prev => [...prev, { role: "AI", text: res.data.feedback }]);
      if (res.data.audio) playBase64Audio(res.data.audio);
    } catch (err) {
      console.error("Chat Error:", err);
    } finally {
      setIsThinking(false);
    }
  }, [chatInput, code, problemId, sessionId, playBase64Audio]);

  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorder.current) {
        mediaRecorder.current.stop();
        setIsRecording(false);
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder.current = new MediaRecorder(stream);
        audioChunks.current = [];
        mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
        mediaRecorder.current.onstop = async () => {
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
          const formData = new FormData();
          formData.append("file", audioBlob, "recording.wav");
          try {
            const res = await axios.post("http://localhost:8000/ai/stt", formData);
            if (res.data.text) setChatInput(res.data.text);
          } catch (err) { console.error("STT Error:", err); }
          stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorder.current.start();
        setIsRecording(true);
      } catch (err) { console.error("Microphone denied:", err); }
    }
  };

  const syncWithBackend = useCallback(async (currentOutput) => {
      if (!problem) return;
      try {
          const res = await axios.post("http://localhost:8000/update_code", {
              session_id: sessionId,
              problem_statement: problem.description,
              current_code: code,
              compiler_output: currentOutput || output
          });
          if (res.data.messages) {
              const aiMessages = res.data.messages.filter(m => m.role === "AI");
              if (aiMessages.length > lastMsgCount.current) {
                  const newMsgs = aiMessages.slice(lastMsgCount.current);
                  setChatLog(prev => [...prev, ...newMsgs]);
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
    if (timeLeft > 0 && timeLeft < 900 && (900 - timeLeft) % 180 === 0) {
      triggerAIAnalysis("periodic");
    }
  }, [timeLeft, triggerAIAnalysis]);

  const runCode = async () => {
    try {
      const res = await axios.post("http://localhost:8000/run", { code, input: userInput });
      setOutput(res.data.output);
      await syncWithBackend(res.data.output);
    } catch (err) {
      setOutput("Execution Error: " + err.message);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!problem) return <div style={{height: '100vh', backgroundColor: '#0f0f0f', color: 'white', padding: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>Loading Workspace...</div>;

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#0f0f0f", color: "white", fontFamily: "sans-serif", overflow: "hidden" }}>
      {/* LEFT: Description */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid #333", background: "#1a1a1a", padding: "20px", overflowY: "auto" }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2 style={{margin: 0}}>{problem.title}</h2>
            <span style={{background: '#ff4d4d', padding: '2px 8px', borderRadius: '4px', fontSize: '12px'}}>{problem.difficulty}</span>
        </div>
        <hr style={{borderColor: '#333', margin: '15px 0'}} />
        <p style={{ whiteSpace: "pre-wrap", lineHeight: "1.6", fontSize: "14px", color: "#ccc" }}>{problem.description}</p>
      </div>

      {/* MIDDLE: Editor */}
      <div style={{ flex: 2, display: "flex", flexDirection: "column", borderRight: "1px solid #333" }}>
        <div style={{ padding: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#252526" }}>
          <span style={{ color: timeLeft < 60 ? "#ff4d4d" : "#00ff00", fontWeight: "bold" }}>⏳ Time Left: {formatTime(timeLeft)}</span>
          <button onClick={handleFinalSubmit} disabled={isSubmitting} style={{ background: "#28a745", color: "white", border: "none", padding: "6px 20px", cursor: "pointer", borderRadius: '4px' }}>Submit Solution</button>
        </div>
        <Editor height="65vh" theme="vs-dark" defaultLanguage="cpp" value={code} onChange={setCode} />
        <div style={{ padding: "15px", flex: 1, display: "flex", gap: "15px", background: "#1e1e1e" }}>
          <div style={{ flex: 1 }}>
            <small style={{color: '#888'}}>Input (stdin):</small>
            <textarea style={{ width: "95%", height: "80px", background: "#000", color: "#00ff00", border: "1px solid #333", padding: "10px", marginTop: '5px', borderRadius: '4px', fontFamily: 'monospace' }} value={userInput} onChange={(e) => setUserInput(e.target.value)} />
            <button onClick={runCode} style={{ width: "100%", marginTop: "10px", padding: "10px", background: "#007acc", color: "white", border: "none", cursor: "pointer", borderRadius: '4px', fontWeight: 'bold' }}>▶ Run Tests</button>
          </div>
          <div style={{ flex: 1 }}>
            <small style={{color: '#888'}}>Console Output:</small>
            <pre style={{ background: "#000", height: "115px", padding: "10px", overflow: "auto", margin: '5px 0 0 0', fontSize: "13px", color: "#00ff00", border: "1px solid #333", borderRadius: '4px' }}>{output || "Output will appear here..."}</pre>
          </div>
        </div>
      </div>

      {/* RIGHT: Chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#1a1a1a" }}>
        <div style={{ padding: "15px", borderBottom: "1px solid #333", fontWeight: "bold", textAlign: 'center', background: '#252526' }}>🤖 AI Code Tutor</div>
        <div style={{ flex: 1, overflowY: "auto", padding: "15px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {chatLog.map((msg, i) => (
            <div key={i} style={{ alignSelf: msg.role === "AI" ? "flex-start" : "flex-end", maxWidth: "85%", padding: "12px", borderRadius: "12px", background: msg.role === "AI" ? "#2d2d2d" : "#004d99", border: msg.role === "AI" ? "1px solid #444" : "1px solid #0059b3", boxShadow: "0 2px 4px rgba(0,0,0,0.2)"}}>
              <small style={{ color: msg.role === "AI" ? "#00aaff" : "#fff", fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }}>{msg.role}</small>
              <p style={{ margin: "5px 0 0 0", fontSize: "14px", lineHeight: "1.4", color: "#e0e0e0" }}>{msg.text}</p>
            </div>
          ))}
          {isThinking && <div style={{ alignSelf: "flex-start", background: "#2d2d2d", padding: "8px 15px", borderRadius: "12px", fontSize: "12px", color: "#888", fontStyle: "italic" }}>AI is thinking...</div>}
        </div>
        
        <div style={{ padding: "0 15px 15px 15px", background: "#1a1a1a", display: "flex", gap: "5px" }}>
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyPress={(e) => e.key === "Enter" && sendChatMessage()} placeholder="Type a question..." style={{ flex: 1, background: "#000", color: "#fff", border: "1px solid #333", borderRadius: "4px", padding: "8px" }} />
            <button onClick={() => sendChatMessage()} style={{ background: "#007acc", border: "none", color: "#fff", padding: "8px 12px", borderRadius: "4px", cursor: "pointer" }}>Send</button>
            <button onClick={toggleRecording} style={{ background: isRecording ? "#ff4d4d" : "#444", border: "none", color: "#fff", padding: "8px 12px", borderRadius: "4px", cursor: "pointer" }}>{isRecording ? "🔴" : "🎙️"}</button>
        </div>

        <div style={{ padding: "15px", background: "#252526", borderTop: "1px solid #333" }}>
          <div style={{marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
               <small style={{color: '#888'}}>Hint Level:</small>
               <div style={{display: 'flex', gap: '4px'}}>{[1,2,3,4,5].map(l => <div key={l} style={{width: '20px', height: '6px', borderRadius: '3px', background: l <= hintLevel ? '#f59e0b' : '#444'}} />)}</div>
          </div>
          <button onClick={() => triggerAIAnalysis("hint")} disabled={isThinking} style={{ width: "100%", padding: "12px", background: isThinking ? "#444" : "#f59e0b", color: "black", fontWeight: "bold", border: "none", cursor: "pointer", borderRadius: '4px', transition: 'background 0.2s' }}>{isThinking ? "Consulting..." : "💡 I'm Stuck, Give me a Hint"}</button>
        </div>
      </div>
    </div>
  );
};

export default Interview;
