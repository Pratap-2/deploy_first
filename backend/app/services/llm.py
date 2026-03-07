from dotenv import load_dotenv
import os

load_dotenv()

# We will initialize these lazily
groq_llm = None
gemini_llm = None

def get_llm(agent_type: str):
    global groq_llm

    if groq_llm is None:
        from langchain_groq import ChatGroq
        groq_llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.4,
            groq_api_key=os.getenv("GROQ_API_KEY")
        )
    return groq_llm
