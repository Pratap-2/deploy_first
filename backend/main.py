import os
import uuid
import hashlib
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

# ---- In-memory resume parse cache (MD5 hash → parsed data) ----
_resume_cache: dict = {}


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
    # Read bytes once so we can hash them for caching
    file_bytes = await file.read()
    file_hash = hashlib.md5(file_bytes).hexdigest()

    # ── Cache hit: return previous result immediately ──────────
    if file_hash in _resume_cache:
        print(f"[RESUME CACHE HIT] {file.filename} ({file_hash[:8]}...)")
        cached_data = _resume_cache[file_hash]
        if session_id:
            from app.services.session_store import load_session, save_session
            sessions = load_session(session_id)
            if sessions:
                state = sessions[0]
                state["resume_data"] = cached_data
                save_session(state)
        return {"success": True, "data": cached_data, "cached": True}

    # ── Cache miss: parse and store ───────────────────────────
    unique_id = uuid.uuid4().hex[:8]
    tmp_path = os.path.join(tempfile.gettempdir(), f"resume_{unique_id}_{file.filename}")
    try:
        with open(tmp_path, "wb") as f:
            f.write(file_bytes)

        parser = CVParser()
        data = parser.parse_cv(tmp_path)

        # Store in cache
        _resume_cache[file_hash] = data
        print(f"[RESUME CACHE STORE] {file.filename} ({file_hash[:8]}...)")

        if session_id:
            from app.services.session_store import load_session, save_session
            sessions = load_session(session_id)
            if sessions:
                state = sessions[0]
                state["resume_data"] = data
                save_session(state)

        return {"success": True, "data": data, "cached": False}
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
# 5. POST /ai/chat — interactive chat (MUST be before /ai/{ai_type})
# =============================================================
@app.post("/ai/chat")
def ai_chat(payload: ChatRequestPayload):
    from langchain_core.messages import AIMessage as LCAIMessage
    problem = problems.get(payload.problemId)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    from app.services.session_store import load_session
    session_data = {}
    if payload.session_id:
        sessions = load_session(payload.session_id)
        if sessions:
            session_data = sessions[0]

    # ---- Detect if this is a general CS concept question ----
    concept_keywords = [
        "what is", "what are", "explain", "how does", "how do",
        "difference between", "define", "what's", "can you explain",
        "tell me about", "describe", "meaning of", "what does",
        "when to use", "why do we use", "how is", "how are"
    ]
    msg_lower = payload.message.lower()
    is_concept_question = any(kw in msg_lower for kw in concept_keywords)

    system_role = (
        "You are an expert computer science professor and technical mentor during a coding interview.\n\n"
        "## MOST IMPORTANT RULE:\n"
        "If the candidate asks about a CS concept, data structure, algorithm, or technology, "
        "you MUST answer ONLY about that specific concept. DO NOT mention the coding problem.\n\n"
        "## For concept questions use this structure:\n"
        "1. DEFINITION: Precise and very Crisp , simple definition with a real-world analogy.\n"
        "2. WHY IT MATTERS: When and why it is used.\n"
        "3. EXAMPLE: Short code snippet or step-by-step trace.\n\n"
        "## For code/problem-specific questions:\n"
        "- Analyze their code and give targeted guidance.\n"
        "- Never reveal the full solution unless hint_level is 5.\n\n"
        "Remember prior messages in this conversation and build on them."
    )

    try:
        llm = get_llm("chat")

        # Start with system message
        messages = [SystemMessage(content=system_role)]

        # For problem-specific questions, add background context + acknowledgment
        if not is_concept_question:
            background_context = (
                f"Problem the candidate is solving: {problem['description']}\n"
                f"Candidate current code:\n{payload.code}\n"
                f"Hint level: {session_data.get('hint_level', 0)} / 5"
            )
            messages.append(HumanMessage(content=background_context))
            messages.append(LCAIMessage(content="Understood, I have the context. I'm ready to help!"))

        # Replay conversation history for multi-turn memory
        for turn in payload.history:
            if turn.role == "user":
                messages.append(HumanMessage(content=turn.content))
            elif turn.role == "assistant":
                messages.append(LCAIMessage(content=turn.content))

        # Add the new user message
        messages.append(HumanMessage(content=payload.message))

        response = llm.invoke(messages)

        from app.services.speech_service import text_to_speech_base64
        audio_base64 = None
        try:
            audio_base64 = text_to_speech_base64(response.content)
        except Exception as se:
            print(f"[SPEECH ERROR] chat voice failed: {se}")

        return {"feedback": response.content, "audio": audio_base64}
    except Exception as e:
        print(f"[CHAT ERROR] {e}")
        return {"feedback": "I'm sorry, I'm having trouble processing that.", "audio": None}


# =============================================================
# 6. POST /ai/{ai_type}  — AI hints / periodic / evaluation
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
            "You are a friendly technical and consise interviewer observing the candidate. "
            "Analyze their code. "
            "Give them a quick, supportive nudge if they're moving in the right direction or suggest a friendly conceptual hint if they look stuck. "
            "Do not reveal the solution. Keep it warm and encouraging. "
            "AT THE VERY END of your response, you MUST include a score tag reflecting their progress out of 100, formatted exactly like: [SCORE: 75]"
        )
    elif ai_type == "hint":
        hint_level = session_data.get("hint_level", 0) + 1
        if hint_level > 5: hint_level = 5
        
        level_instructions = {
            1: "subtle, friendly conceptual and crisp hint",
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
        # Clean up text and extract score if periodic
        final_feedback = response.content
        extracted_score = 50
        if ai_type == "periodic":
            import re
            match = re.search(r"\[SCORE:\s*(\d+)\]", final_feedback)
            if match:
                extracted_score = int(match.group(1))
                final_feedback = re.sub(r"\[SCORE:\s*\d+\]", "", final_feedback).strip()
            
            # Save periodic progress
            if payload.session_id:
                scores = session_data.get("progress_scores", [])
                scores.append({"minute": len(scores) + 1, "score": extracted_score})
                session_data["progress_scores"] = scores
                state_to_save = {
                    "session_id": payload.session_id,
                    "problem_statement": problem['description'],
                    "current_code": payload.code,
                    "compiler_output": "",
                    "progress_scores": scores
                }
                save_session(state_to_save)

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
            
        if ai_type == "evaluation" and payload.session_id:
            state_to_save = {
                "session_id": payload.session_id,
                "problem_statement": problem['description'],
                "current_code": payload.code,
                "compiler_output": "",
                "evaluation": final_feedback
            }
            save_session(state_to_save)
        # Generate voice
        from app.services.speech_service import text_to_speech_base64
        audio_base64 = None
        try:
            audio_base64 = text_to_speech_base64(final_feedback)
        except Exception as se:
            print(f"[SPEECH ERROR] voice failed: {se}")

        return {
            "feedback": final_feedback,
            "audio": audio_base64,
            "level": session_data.get("hint_level", 0) if ai_type == "hint" else None
        }
    except Exception as e:
        print(f"[AI ERROR] /ai/{ai_type} failed: {type(e).__name__}: {e}")
        return {"feedback": "Tutor is thinking... try again.", "audio": None}



# =============================================================
# 6. POST /ai/stt — speech to text
# =============================================================
@app.post("/ai/stt")
async def speech_to_text_endpoint(file: UploadFile = File(...)):
   
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


@app.get("/session/{session_id}/analysis")
def get_session_analysis(session_id: str):
    from app.services.session_store import load_session
    past_sessions = load_session(session_id)
    if not past_sessions:
        return {"analysis": "Session not found.", "progress_scores": []}
    
    session_data = past_sessions[-1] if isinstance(past_sessions, list) else past_sessions
    analysis = session_data.get("evaluation", session_data.get("code_analysis", "No final analysis available yet."))
    return {
        "analysis": analysis,
        "progress_scores": session_data.get("progress_scores", [])
    }

