import os
import uuid
import subprocess
import tempfile

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware

from app.graph_builder import build_graph
from app.schemas import CodeUpdatePayload, RunCodePayload, AIRequestPayload, ChatRequestPayload
from app.problems import problems
from app.services.llm import get_llm
from cv_parser import CVParser

from langchain_core.messages import SystemMessage, HumanMessage

app = FastAPI()

# ---- CORS (allow React dev server on port 3000) ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- LangGraph pipeline (existing) ----
graph = build_graph(checkpointer=None)


# =============================================================
# 1. GET /problem/{problem_id}  — serve problem (hide solution)
# =============================================================
@app.get("/problem/{problem_id}")
def get_problem(problem_id: int):
    problem = problems.get(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    # Return everything except the solution
    return {k: v for k, v in problem.items() if k != "solution"}


# =============================================================
# 2. POST /run  — compile & run C++ code
# =============================================================
@app.post("/run")
def run_code(payload: RunCodePayload):
    unique_id = uuid.uuid4().hex[:8]

    # Use a temp directory so files don't litter the project
    tmp_dir = tempfile.gettempdir()
    cpp_path = os.path.join(tmp_dir, f"temp_{unique_id}.cpp")
    exe_path = os.path.join(tmp_dir, f"temp_{unique_id}.exe")
    input_path = os.path.join(tmp_dir, f"input_{unique_id}.txt")

    try:
        # Write source and input files
        with open(cpp_path, "w") as f:
            f.write(payload.code)
        with open(input_path, "w") as f:
            f.write(payload.input)

        # Compile
        compile_result = subprocess.run(
            ["g++", cpp_path, "-o", exe_path],
            capture_output=True, text=True, timeout=15
        )

        if compile_result.returncode != 0:
            return {"success": False, "output": compile_result.stderr}

        # Run with input
        with open(input_path, "r") as inp:
            run_result = subprocess.run(
                [exe_path],
                stdin=inp,
                capture_output=True, text=True, timeout=10
            )

        if run_result.returncode != 0:
            return {"success": False, "output": run_result.stderr or "Runtime error"}

        return {"success": True, "output": run_result.stdout}

    except subprocess.TimeoutExpired:
        return {"success": False, "output": "Time Limit Exceeded"}
    except Exception as e:
        return {"success": False, "output": str(e)}
    finally:
        # Cleanup temp files
        for path in [cpp_path, exe_path, input_path]:
            if os.path.exists(path):
                try:
                    os.remove(path)
                except OSError:
                    pass


# =============================================================
# 3. POST /ai/parse_resume  — parse uploaded CV
# =============================================================
@app.post("/ai/parse_resume")
async def parse_resume(file: UploadFile = File(...), session_id: str = None):
    unique_id = uuid.uuid4().hex[:8]
    tmp_path = os.path.join(tempfile.gettempdir(), f"resume_{unique_id}_{file.filename}")
    
    try:
        with open(tmp_path, "wb") as f:
            f.write(await file.read())
        
        parser = CVParser()
        data = parser.parse_cv(tmp_path)
        
        # Save to session if session_id exists
        if session_id:
            from app.services.session_store import load_session, save_session
            sessions = load_session(session_id)
            if sessions:
                state = sessions[0]
                state["resume_data"] = data
                save_session(state)
        
        return {"success": True, "data": data}
    except Exception as e:
        print(f"[CV ERROR] {e}")
        return {"success": False, "error": str(e)}
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


# =============================================================
# 4. POST /ai/welcome  — initial greeting
# =============================================================
@app.post("/ai/welcome")
def ai_welcome(payload: AIRequestPayload):
    problem = problems.get(payload.problemId)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
        
    welcome_text = (
        f"Hi there! I'm your interviewer today. Let's tackle this challenge: {problem['title']}. "
        "Don't worry, I'm here to guide you. Take a moment to read the problem, and whenever you're ready, start coding. "
        "I'll be watching your progress and I'm happy to help if you get stuck!"
    )
    
    from app.services.speech_service import text_to_speech_base64
    audio_base64 = None
    try:
        audio_base64 = text_to_speech_base64(welcome_text)
    except Exception as se:
        print(f"[SPEECH ERROR] Welcome voice failed: {se}")

    return {
        "feedback": welcome_text,
        "audio": audio_base64
    }


# =============================================================
# 4. POST /ai/{ai_type}  — AI hints / periodic / evaluation
# =============================================================
@app.post("/ai/{ai_type}")
def ai_endpoint(ai_type: str, payload: AIRequestPayload):
    problem = problems.get(payload.problemId)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    # Load session state if session_id is provided
    from app.services.session_store import load_session, save_session
    session_data = {}
    if payload.session_id:
        sessions = load_session(payload.session_id)
        if sessions:
            session_data = sessions[0]

    # Choose system prompt based on type
    if ai_type == "periodic":
        system_role = (
            "You are a friendly technical interviewer observing the candidate. "
            "Analyze their code every 3 minutes. "
            "Give them a quick, supportive nudge if they're moving in the right direction or suggest a friendly conceptual hint if they look stuck. "
            "Do not reveal the solution. Keep it warm and encouraging."
        )
    elif ai_type == "hint":
        hint_level = session_data.get("hint_level", 0) + 1
        if hint_level > 5: hint_level = 5
        
        level_instructions = {
            1: "subtle, friendly conceptual hint",
            2: "mention the data structure or technique gently",
            3: "explain the reasoning like a mentor",
            4: "friendly high-level algorithm description",
            5: "complete solution direction with encouraging words"
        }
        instr = level_instructions.get(hint_level, level_instructions[5])
        system_role = f"The user asked for a hint. Provide a {instr}. Use a warm, supportive tone. Do not provide code."
    else:
        system_role = "Evaluate the final code for correctness and efficiency."

    # Build prompt with context
    context = (
        f"Problem: {problem['description']}\n"
        f"User Code: {payload.code}\n"
        f"Context: {problem.get('aiContext', 'None')}\n"
        f"Previous Analysis: {session_data.get('analysis', 'None')}"
    )

    try:
        llm = get_llm("analysis")
        response = llm.invoke([
            SystemMessage(content=f"{system_role}\n\nInstruction: Provide a concise response in plain text (1-3 sentences max)."),
            HumanMessage(content=context)
        ])
        
        # Update session data if needed (specifically for hints)
        if ai_type == "hint" and payload.session_id:
            session_data["hint_level"] = session_data.get("hint_level", 0) + 1
            if session_data["hint_level"] > 5: session_data["hint_level"] = 5
            
            # Create a minimal state to save
            state_to_save = {
                "session_id": payload.session_id,
                "problem_statement": problem['description'],
                "current_code": payload.code,
                "compiler_output": "",
                "hint_level": session_data["hint_level"]
            }
            save_session(state_to_save)

        # Generate voice
        from app.services.speech_service import text_to_speech_base64
        audio_base64 = None
        try:
            audio_base64 = text_to_speech_base64(response.content)
        except Exception as se:
            print(f"[SPEECH ERROR] voice failed: {se}")

        return {
            "feedback": response.content,
            "audio": audio_base64,
            "level": session_data.get("hint_level", 0) if ai_type == "hint" else None
        }
    except Exception as e:
        print(f"[AI ERROR] /ai/{ai_type} failed: {type(e).__name__}: {e}")
        return {"feedback": "Tutor is thinking... try again.", "audio": None}


# =============================================================
# 5. POST /ai/chat — interactive chat
# =============================================================
@app.post("/ai/chat")
def ai_chat(payload: ChatRequestPayload):
    problem = problems.get(payload.problemId)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    from app.services.session_store import load_session, save_session
    session_data = {}
    if payload.session_id:
        sessions = load_session(payload.session_id)
        if sessions:
            session_data = sessions[0]

    system_role = (
        "You are an expert computer science professor and technical mentor during a coding interview.\n\n"
        "## MOST IMPORTANT RULE:\n"
        "If the candidate asks about a CS concept, data structure, algorithm, or technology "
        "(examples: 'what is a priority queue', 'explain recursion', 'how does binary search work', "
        "'what is dynamic programming', 'explain Big-O notation', 'what is a tree', 'how does hashing work'), "
        "you MUST answer ONLY about that specific concept. "
        "DO NOT mention the coding problem. DO NOT reference their code. "
        "Treat it as pure computer science teaching.\n\n"
        "## How to answer concept questions (ALWAYS follow this structure):\n"
        "1. DEFINITION: Give a precise, simple definition with a real-world analogy.\n"
        "2. WHY IT MATTERS: Explain when and why it is used in practice.\n"
        "3. EXAMPLE: Provide a short, concrete code snippet or step-by-step trace.\n\n"
        "## For code/problem-specific questions only:\n"
        "- Analyze their code and give targeted guidance.\n"
        "- Never reveal the full solution unless hint_level is 5.\n\n"
        "Be warm, specific, and educational. Never give vague or generic answers."
    )

    background_context = (
        f"[Background — only relevant if the question is about the problem or their code]\n"
        f"Problem the candidate is solving: {problem['description']}\n"
        f"Candidate current code:\n{payload.code}\n"
        f"Hint level: {session_data.get('hint_level', 0)} / 5"
    )

    try:
        llm = get_llm("analysis")
        response = llm.invoke([
            SystemMessage(content=system_role),
            HumanMessage(content=background_context),
            HumanMessage(content=f"Candidate's question: {payload.message}")
        ])

        # Generate voice
        from app.services.speech_service import text_to_speech_base64
        audio_base64 = None
        try:
            audio_base64 = text_to_speech_base64(response.content)
        except Exception as se:
            print(f"[SPEECH ERROR] chat voice failed: {se}")

        return {
            "feedback": response.content,
            "audio": audio_base64
        }
    except Exception as e:
        print(f"[CHAT ERROR] {e}")
        return {"feedback": "I'm sorry, I'm having trouble processing that.", "audio": None}


# =============================================================
# 6. POST /ai/stt — speech to text
# =============================================================
@app.post("/ai/stt")
async def speech_to_text_endpoint(file: UploadFile = File(...)):
    # In a real scenario, we'd process the audio file here.
    # For now, let's use the local speech_service if possible, 
    # but that expects a microphone.
    # Instead, we'll return a placeholder or implement a simple file-based STT if needed.
    # For this task, I'll implement a mock or simple Whisper/Azure file STT if available.
    # Given the constraints, I'll use Azure Speech SDK to recognize from file.
    unique_id = uuid.uuid4().hex[:8]
    tmp_path = os.path.join(tempfile.gettempdir(), f"audio_{unique_id}.wav")
    
    try:
        with open(tmp_path, "wb") as f:
            f.write(await file.read())
            
        import azure.cognitiveservices.speech as speechsdk
        speech_config = speechsdk.SpeechConfig(
            subscription=os.getenv("AZURE_SPEECH_KEY"),
            region=os.getenv("AZURE_SPEECH_REGION")
        )
        audio_config = speechsdk.audio.AudioConfig(filename=tmp_path)
        recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)
        
        result = recognizer.recognize_once_async().get()
        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            return {"text": result.text}
        else:
            return {"text": "", "error": str(result.reason)}
            
    except Exception as e:
        return {"text": "", "error": str(e)}
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
from app.services.session_store import load_session

@app.post("/update_code")
def update_code(payload: CodeUpdatePayload):
    past_sessions = load_session(payload.session_id)
    
    if past_sessions:
        session_data = past_sessions[0]
        state = {
            "session_id": payload.session_id,
            "problem_statement": payload.problem_statement,
            "current_code": payload.current_code,
            "compiler_output": payload.compiler_output,
            "code_analysis": session_data.get("analysis", ""),
            "messages": session_data.get("messages", []),
            "ping_count": session_data.get("ping_count", 0),
            "start_time": session_data.get("start_time", None),
            "last_activity": session_data.get("last_activity", None),
        }
    else:
        state = {
            "session_id": payload.session_id,
            "problem_statement": payload.problem_statement,
            "current_code": payload.current_code,
            "compiler_output": payload.compiler_output,
        }

    result = graph.invoke(state)
    
    # Ensure the final state is saved back to Cosmos DB
    from app.services.session_store import save_session
    save_session(result)
    
    # Serialize LangChain objects to simple dictionaries for the frontend response
    serializable_messages = []
    for msg in result.get("messages", []):
        if hasattr(msg, "content"):
            role = "AI" if getattr(msg, "type", "") == "ai" else "USER" if getattr(msg, "type", "") == "human" else "SYSTEM"
            serializable_messages.append({"role": role, "text": msg.content})
        elif isinstance(msg, dict):
            serializable_messages.append(msg)
            
    return {
        "analysis": result.get("code_analysis", ""),
        "messages": serializable_messages,
        "audio": result.get("audio", None),
        "ping_count": result.get("ping_count")
    }

