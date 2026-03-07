const { ChatGroq } = require("@langchain/groq");
const { PromptTemplate } = require("@langchain/core/prompts");
require('dotenv').config();

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: "llama-3.1-8b-instant",
  temperature: 0.7,
});

async function getAIResponse(type, problem, code, extra = "None") {
  try {
    let systemRole = "";

    if (type === "periodic") {
      systemRole = "You are a coding tutor. Briefly analyze progress. Give a 1-sentence hint only if they look stuck.";
    } else if (type === "hint") {
      systemRole = "The user is stuck and asked for a hint. Provide guidance on logic, not code.";
    } else {
      systemRole = "Evaluate the final code for correctness and efficiency.";
    }

    const prompt = PromptTemplate.fromTemplate(`
      Role: {systemRole}
      Problem: {problem}
      User Code: {code}
      Context: {extra}

      Instruction: Provide a concise response in plain text.
    `);

    const chain = prompt.pipe(model);
    
    // We must ensure all variables in the template are provided as strings
    const response = await chain.invoke({
      systemRole: systemRole,
      problem: String(problem),
      code: String(code),
      extra: String(extra) 
    });

    return response.content;
  } catch (error) {
    console.error("Error in getAIResponse:", error.message);
    throw error; // Re-throw to be caught by the route handler
  }
}

module.exports = { getAIResponse };
