# 🤖 AI Interview Platform

> An end-to-end AI-powered technical interview simulation platform that evaluates candidates on competitive coding problems with real-time voice tutoring, resume-based personalisation, and detailed post-interview analytics.

---

## 🔗 Repositories

| Repo | Description | Link |
|---|---|---|
| **code-ide** | React frontend (code editor, chat, analysis UI) | [github.com/Aditya5240/code-ide](https://github.com/Aditya5240/code-ide) |
| **backend** | FastAPI backend — AI pipelines, Azure services, LangGraph | [github.com/Aditya5240/backend](https://github.com/Aditya5240/backend) |

---

## ✨ Features

| Feature | Description |
|---|---|
| 📄 **Resume Parsing** | Upload PDF/DOCX → personalised dashboard with skills pie chart, bar chart, project/experience cards |
| 🧠 **AI Interviewer** | Voice-enabled AI tutor powered by LLaMA 3.3 70B (via Groq) giving hints, periodic nudges, final evaluation |
| 💬 **Multi-turn Chat** | Stateful conversation history per session — AI remembers context across turns |
| 📚 **CS Concept Teaching** | Keyword-based detection (`"what is"`, `"explain"`, etc.) — concept questions taught purely, not anchored to the problem |
| 🎙️ **Voice Input (STT)** | Azure Cognitive Services Speech-to-Text for microphone input |
| 🔊 **Voice Output (TTS)** | Azure Cognitive Services Text-to-Speech for AI responses |
| ⛶ **Fullscreen Editor** | One-click fullscreen code editor that hides all side panels |
| 💬 **Collapsible Chat** | Toggle the AI tutor panel on/off; floating 💬 button restores it |
| 🌙 **Dark / ☀️ Light Mode** | Theme toggle that updates all UI elements and Monaco editor |
| ⚡ **Resume Cache** | MD5 hash cache — re-uploading the same resume returns instant results |
| 📊 **Post-Interview Analysis** | Score graph over time, final AI evaluation, session history |

---

## 🏗️ Architecture

The project is split into **two separate repositories**:

```
MS PROJECT/
│
├── code-ide/          ← Frontend repo (this repo)
│   └── client/
│       └── src/
│           └── pages/
│               ├── Landing.js    # Resume upload + candidate dashboard
│               ├── Interview.js  # Code editor + AI chat + timer
│               └── Analysis.js  # Post-interview report
│
└── backend/           ← Backend repo (separate: github.com/Aditya5240/backend)
    ├── main.py                   # All FastAPI routes
    ├── cv_parser.py              # Resume parsing (PyPDF2 / python-docx)
    ├── requirements.txt
    └── app/
        ├── schemas.py            # Pydantic models
        ├── problems.py           # Coding problems bank
        ├── graph_builder.py      # LangGraph pipeline
        ├── state.py              # Shared state schema
        ├── nodes/                # LangGraph nodes
        │   ├── interviewer_node.py
        │   ├── hint_node.py
        │   ├── evaluator_node.py
        │   ├── feedback_node.py
        │   ├── tracker_node.py
        │   └── wrapup_node.py
        └── services/
            ├── llm.py            # Groq LLM (chat temp=0.7, analysis temp=0.4)
            ├── speech_service.py # Azure TTS
            ├── session_store.py  # Azure Cosmos DB session CRUD
            └── cosmos_services.py
```

> ℹ️ The React frontend (`client/`) calls the FastAPI backend at `http://localhost:8000`.

---

## 🛠️ Tech Stack

### Frontend
| Library | Purpose |
|---|---|
| React 18 | UI framework |
| `@monaco-editor/react` | VS Code-style code editor |
| `recharts` | Pie & bar charts for resume dashboard |
| `axios` | HTTP client |
| `react-router-dom` | SPA routing |

### Backend
| Library | Purpose |
|---|---|
| FastAPI | REST API framework |
| LangChain + LangGraph | LLM orchestration pipeline |
| `langchain-groq` | LLaMA 3.3 70B Versatile via Groq API |
| `azure-cognitiveservices-speech` | Text-to-Speech + Speech-to-Text |
| `azure-search-documents` | Vector search for resume embeddings |
| `azure-cosmos` | Session state persistence |
| `PyPDF2` / `python-docx` | Resume file parsing |

---

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.11+
- Node.js 18+
- A virtual environment (recommended)
- `g++` compiler on PATH (for C++ code execution)
- API keys (see Environment Variables below)

---

### 1. Clone both repositories

```bash
git clone https://github.com/Aditya5240/code-ide.git
git clone https://github.com/Aditya5240/backend.git
```

Place them side-by-side:
```
MS PROJECT/
├── code-ide/
└── backend/
```

---

### 2. Backend Setup

```bash
# Create and activate virtual environment (from MS PROJECT/ root)
python -m venv ms
.\ms\Scripts\Activate.ps1        # Windows PowerShell
# source ms/bin/activate         # macOS / Linux

# Install dependencies
cd backend
pip install -r requirements.txt
```

#### Environment Variables

Create a `.env` file inside `backend/`:

```env
# Groq (LLM)
GROQ_API_KEY=your_groq_api_key

# Google (Embeddings)
GOOGLE_API_KEY=your_google_api_key

# Azure AI Search (Vector Store)
AZURE_SEARCH_ENDPOINT=https://your-search.search.windows.net
AZURE_SEARCH_KEY=your_azure_search_key
AZURE_SEARCH_INDEX=your_index_name

# Azure Speech (TTS + STT)
AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=eastus

# Azure Cosmos DB (Session Store)
COSMOS_ENDPOINT=https://your-cosmos.documents.azure.com:443/
COSMOS_KEY=your_cosmos_key
COSMOS_DATABASE=interview_db
COSMOS_CONTAINER=sessions
```

#### Start the backend

```bash
# From the backend/ directory with venv active:
uvicorn main:app --port 8000 --reload
```

> The API will be available at `http://localhost:8000`  
> Interactive docs: `http://localhost:8000/docs`

---

### 3. Frontend Setup

```bash
cd code-ide/client
npm install
npm start
```

The React app opens at `http://localhost:3000`.

---

## 🗺️ API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/problem/{id}` | Fetch problem (solution hidden) |
| `POST` | `/run` | Compile & run C++ code (via `g++`) |
| `POST` | `/ai/parse_resume` | Parse uploaded CV (MD5 cached) |
| `POST` | `/ai/welcome` | Generate welcome audio for interview start |
| `POST` | `/ai/chat` | Multi-turn chat with CS concept detection |
| `POST` | `/ai/hint` | Progressive hints (5 levels) |
| `POST` | `/ai/periodic` | Periodic progress nudge (every 60s) |
| `POST` | `/ai/evaluation` | Final code evaluation on submission |
| `POST` | `/ai/stt` | Speech-to-Text (audio file → transcript) |
| `POST` | `/update_code` | Sync code + run LangGraph pipeline |
| `GET` | `/session/{id}/analysis` | Fetch post-interview analysis + scores |

---

## 🎮 How to Use

### 1. Upload Resume
- Go to `http://localhost:3000`
- Upload your resume (PDF or DOCX)
- View personalised dashboard with skills, projects, and experience

### 2. Start Interview
- Click **Start Interview** from the dashboard
- The AI tutor greets you and introduces the problem

### 3. During the Interview

| Action | How |
|---|---|
| Write code | Monaco editor (centre panel) |
| Run tests | **▶ Run Tests** button |
| Ask a question | Type in chat OR use 🎙️ voice input |
| Get a hint | **💡 I'm Stuck** button (5 progressive levels) |
| Go fullscreen | **⛶ Full** toolbar button |
| Hide/show chat | **💬 Hide Chat** toolbar button |
| Toggle theme | **☀️ / 🌙** toolbar button |
| End early | **🛑 End** — stops audio, goes to analysis |
| Submit | **✅ Submit** — final AI feedback then analysis |

### 4. Analysis Page
- View your score graph over the 15-minute session
- Read the AI's final evaluation of your code

---

## 🔑 Key Design Decisions

### Chat Route Ordering (FastAPI)
`/ai/chat` is declared **before** `/ai/{ai_type}`. FastAPI matches routes in registration order — the wildcard would otherwise intercept chat requests.

### Concept Question Detection
Messages are scanned for keywords (`"what is"`, `"explain"`, `"difference between"`, etc.) before calling the LLM. Concept questions are sent **without** the problem context so the model teaches the concept purely.

### Resume Caching
File bytes are hashed (MD5) before parsing. The same resume (regardless of filename) returns cached results instantly from an in-memory dict.

### Dual LLM Temperature
- `chat` mode: `temperature=0.7` — creative, varied educational answers  
- `analysis` mode: `temperature=0.4` — deterministic, consistent evaluation

---

## 📁 Key Files

| File | Repo | Role |
|---|---|---|
| `main.py` | backend | All FastAPI routes |
| `cv_parser.py` | backend | Resume parsing + Azure Search ingestion |
| `app/schemas.py` | backend | Pydantic request/response models |
| `app/problems.py` | backend | Coding problem definitions |
| `app/graph_builder.py` | backend | LangGraph pipeline wiring |
| `app/state.py` | backend | Shared state TypedDict |
| `app/services/llm.py` | backend | LLM factory (chat vs analysis) |
| `app/services/session_store.py` | backend | Cosmos DB session CRUD |
| `app/services/speech_service.py` | backend | Azure TTS helper |
| `client/src/pages/Landing.js` | code-ide | Resume upload + dashboard with charts |
| `client/src/pages/Interview.js` | code-ide | Full interview UI |
| `client/src/pages/Analysis.js` | code-ide | Post-interview report |

---

## 🙋 Author

**Aditya Pratap Singh**  
IIT (ISM) Dhanbad  
[GitHub](https://github.com/Aditya5240)
