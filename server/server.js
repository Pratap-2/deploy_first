require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { compileCpp } = require("./compiler");
const { getAIResponse } = require("./aiHints");
const { problems } = require("./problems");

const app = express();
app.use(cors());
app.use(express.json());

// Add this route to server.js
app.get("/problem/:id", (req, res) => {
  const problem = problems[req.params.id];
  if (!problem) return res.status(404).json({ error: "Problem not found" });
  
  // We send everything EXCEPT the solution to the frontend
  const { solution, ...publicData } = problem;
  res.json(publicData);
});

app.post("/run", async (req, res) => {
  const { code, input } = req.body;
  const result = await compileCpp(code, input);
  res.json(result);
});

app.post("/ai/:type", async (req, res) => {
  try {
    const { type } = req.params;
    const { code, problemId } = req.body;
    const problem = problems[problemId];

    // Pass problem.aiContext to the LLM function
    const feedback = await getAIResponse(
        type, 
        problem.description, 
        code, 
        problem.aiContext // New field!
    );
    
    res.json({ feedback });
  } catch (err) {
    res.status(500).json({ feedback: "Tutor is thinking... try again." });
  }
});

app.listen(4000, () => console.log("Server running on 4000"));