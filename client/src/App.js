import React, { useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import axios from "axios";

const App = () => {
  const [problem, setProblem] = useState(null);
  const [code, setCode] = useState(`#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your code here\n    return 0;\n}`);
  const [userInput, setUserInput] = useState("");
  const [output, setOutput] = useState("");
  const [chatLog, setChatLog] = useState([{ role: "AI", text: "Welcome! I'm your tutor for today. Start by reading the problem on the left." }]);
  const [timeLeft, setTimeLeft] = useState(600);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Fetch Problem Data on Mount
  useEffect(() => {
    const fetchProblem = async () => {
      try {
        const res = await axios.get("http://localhost:4000/problem/1");
        setProblem(res.data);
      } catch (err) {
        console.error("Error fetching problem:", err);
      }
    };
    fetchProblem();
  }, []);

  const triggerAIAnalysis = useCallback(async (type) => {
    try {
      const res = await axios.post(`http://localhost:4000/ai/${type}`, { 
        code, 
        problemId: 1 
      });
      setChatLog(prev => [...prev, { role: "AI", text: res.data.feedback }]);
    } catch (err) {
      console.error("AI Error:", err.response?.data || err.message);
    }
  }, [code]);

  const handleFinalSubmit = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const res = await axios.post("http://localhost:4000/ai/evaluation", { code, problemId: 1 });
      setChatLog(prev => [...prev, { role: "SYSTEM", text: "TIME UP / SUBMITTED" }, { role: "AI", text: res.data.feedback }]);
    } catch (err) {
      console.error("Evaluation Error", err);
    }
    setIsSubmitting(false);
  }, [code]);

  useEffect(() => {
    if (timeLeft <= 0) {
      handleFinalSubmit();
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, handleFinalSubmit]);

  useEffect(() => {
    if (timeLeft > 0 && timeLeft < 600 && timeLeft % 180 === 0) {
      triggerAIAnalysis("periodic");
    }
  }, [timeLeft, triggerAIAnalysis]);

  const runCode = async () => {
    try {
      const res = await axios.post("http://localhost:4000/run", { code, input: userInput });
      setOutput(res.data.output);
    } catch (err) {
      setOutput("Execution Error: " + err.message);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!problem) return <div style={{color: 'white', padding: '20px'}}>Loading Problem...</div>;

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#0f0f0f", color: "white", fontFamily: "sans-serif", overflow: "hidden" }}>
      
      {/* LEFT: Problem Description */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid #333", background: "#1a1a1a", padding: "20px", overflowY: "auto" }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <h2 style={{margin: 0}}>{problem.title}</h2>
            <span style={{background: '#ff4d4d', padding: '2px 8px', borderRadius: '4px', fontSize: '12px'}}>{problem.difficulty}</span>
        </div>
        <hr style={{borderColor: '#333', margin: '15px 0'}} />
        <p style={{ whiteSpace: "pre-wrap", lineHeight: "1.6", fontSize: "14px", color: "#ccc" }}>
            {problem.description}
        </p>
      </div>

      {/* MIDDLE: Editor & Test Console */}
      <div style={{ flex: 2, display: "flex", flexDirection: "column", borderRight: "1px solid #333" }}>
        <div style={{ padding: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#252526" }}>
          <span style={{ color: timeLeft < 60 ? "#ff4d4d" : "#00ff00", fontWeight: "bold" }}>⏳ Time Left: {formatTime(timeLeft)}</span>
          <button onClick={handleFinalSubmit} disabled={isSubmitting} style={{ background: "#28a745", color: "white", border: "none", padding: "6px 20px", cursor: "pointer", borderRadius: '4px' }}>Submit Solution</button>
        </div>

        <Editor height="65vh" theme="vs-dark" defaultLanguage="cpp" value={code} onChange={setCode} />

        <div style={{ padding: "15px", flex: 1, display: "flex", gap: "15px", background: "#1e1e1e" }}>
          <div style={{ flex: 1 }}>
            <small style={{color: '#888'}}>Input (stdin):</small>
            <textarea style={{ width: "100%", height: "80px", background: "#000", color: "#00ff00", border: "1px solid #333", padding: "10px", marginTop: '5px', borderRadius: '4px', fontFamily: 'monospace' }} value={userInput} onChange={(e) => setUserInput(e.target.value)} />
            <button onClick={runCode} style={{ width: "100%", marginTop: "10px", padding: "10px", background: "#007acc", color: "white", border: "none", cursor: "pointer", borderRadius: '4px', fontWeight: 'bold' }}>▶ Run Tests</button>
          </div>
          <div style={{ flex: 1 }}>
            <small style={{color: '#888'}}>Console Output:</small>
            <pre style={{ background: "#000", height: "115px", padding: "10px", overflow: "auto", margin: '5px 0 0 0', fontSize: "13px", color: "#00ff00", border: "1px solid #333", borderRadius: '4px' }}>{output || "Output will appear here..."}</pre>
          </div>
        </div>
      </div>

      {/* RIGHT: AI Tutor Chat */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#1a1a1a" }}>
        <div style={{ padding: "15px", borderBottom: "1px solid #333", fontWeight: "bold", textAlign: 'center', background: '#252526' }}>🤖 AI Code Tutor</div>
        <div style={{ flex: 1, overflowY: "auto", padding: "15px" }}>
          {chatLog.map((msg, i) => (
            <div key={i} style={{ marginBottom: "15px", padding: "12px", borderRadius: "8px", background: msg.role === "AI" ? "#2d2d2d" : "#004d99", borderLeft: msg.role === "AI" ? "4px solid #007acc" : "4px solid #fff" }}>
              <small style={{ color: "#aaa", fontSize: '10px', textTransform: 'uppercase' }}>{msg.role}</small>
              <p style={{ margin: "5px 0 0 0", fontSize: "14px", whiteSpace: "pre-wrap", color: "#e0e0e0" }}>{msg.text}</p>
            </div>
          ))}
        </div>
        <div style={{ padding: "15px", background: "#252526" }}>
          <button onClick={() => triggerAIAnalysis("hint")} style={{ width: "100%", padding: "12px", background: "#f59e0b", color: "black", fontWeight: "bold", border: "none", cursor: "pointer", borderRadius: '4px' }}>💡 I'm Stuck, Give me a Hint</button>
        </div>
      </div>
    </div>
  );
};

export default App;