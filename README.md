# 🤖 AI Interview Platform

An end-to-end AI-powered technical interview simulation platform that evaluates candidates on competitive coding problems with real-time voice tutoring, resume-based personalisation, and detailed post-interview analytics.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📄 **Resume Parsing** | Upload PDF/DOCX → get personalised candidate dashboard with skills pie chart, bar chart, and project/experience cards |
| 🧠 **AI Interviewer** | Voice-enabled AI tutor powered by LLaMA 3.3 70B (via Groq) that gives hints, periodic nudges, and final evaluation |
| 💬 **Multi-turn Chat** | Stateful conversation history sent with each message so the AI remembers context across turns |
| 📚 **CS Concept Teaching** | Keyword-based detection of concept questions ("what is X", "explain Y") — answered purely as CS education, not anchored to the problem |
| 🎙️ **Voice Input (STT)** | Web Speech API for microphone input in the chat |
| 🔊 **Voice Output (TTS)** | Azure Cognitive Services Text-to-Speech for AI responses |
| ⛶ **Fullscreen Editor** | One-click fullscreen code editor that hides all side panels |
| 💬 **Collapsible Chat** | Toggle the AI tutor panel on/off; floating 💬 button restores it |
| 🌙 **Dark / ☀️ Light Mode** | Theme toggle that updates all UI elements and the Monaco editor theme |
| ⚡ **Resume Cache** | MD5 hash cache — re-uploading the same resume returns instant results without re-parsing |
| 📊 **Post-Interview Analysis** | Score graph over time, final AI evaluation, session history |

---

## 🏗️ Architecture

```
MS PROJECT/
├── code-ide/
│   ├── client/                  # React frontend
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── Landing.js   # Resume upload + candidate dashboard
│   │       │   ├── Interview.js # Code editor + AI chat + timer
│   │       │   └── Analysis.js  # Post-interview report
│   │       └── assets/
│   └── backend/                 # FastAPI backend (copy synced from /backend)
│       ├── main.py              # All API routes
│       ├── cv_parser.py         # Resume parsing (PyPDF2 / python-docx)
│       └── app/
│           ├── schemas.py       # Pydantic models
│           ├── problems.py      # Coding problems bank
│           ├── graph_builder.py # LangGraph pipeline
│           └── services/
│               ├── llm.py       # Groq LLM (chat temp=0.7, analysis temp=0.4)
│               ├── speech_service.py  # Azure TTS
│               └── session_store.py  # Azure Cosmos DB session persistence
└── backend/                     # Active running backend
    └── (same structure as above)
```

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
| Web Speech API | Browser-native STT |

### Backend
| Library | Purpose |
|---|---|
| FastAPI | REST API framework |
| LangChain + LangGraph | LLM orchestration pipeline |
| `langchain-groq` | LLaMA 3.3 70B Versatile via Groq API |
| `azure-search-documents` | Vector search for resume embeddings |
| `azure-cognitiveservices-speech` | Text-to-Speech |
| `PyPDF2` / `python-docx` | Resume file parsing |
| Azure Cosmos DB | Session state persistence |

---

## ⚙️ Setup & Installation

### Prerequisites
- Python 3.11+
- Node.js 18+
- A virtual environment (recommended)
- API keys (see Environment Variables below)

---

### 1. Clone the repository

```bash
git clone https://github.com/Aditya5240/code-ide.git
cd code-ide
```

---

### 2. Backend Setup

```bash
# Create and activate virtual environment
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

# Azure Speech (TTS)
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
# from MS PROJECT/ directory with venv active:
cd backend
uvicorn main:app --port 8000 --reload
```

The API will be available at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`

---

### 3. Frontend Setup

```bash
cd code-ide/client
npm install
npm start
```

The React app will open at `http://localhost:3000`.

---

## 🗺️ API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/problem/{id}` | Fetch problem (solution hidden) |
| `POST` | `/run` | Compile & run C++ code |
| `POST` | `/ai/parse_resume` | Parse uploaded CV (MD5 cached) |
| `POST` | `/ai/welcome` | Generate welcome audio for interview start |
| `POST` | `/ai/chat` | Multi-turn chat with CS concept detection |
| `POST` | `/ai/hint` | Progressive hints (5 levels) |
| `POST` | `/ai/periodic` | Periodic progress nudge (every 60s) |
| `POST` | `/ai/evaluation` | Final code evaluation on submission |
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
| End early | **🛑 End** — stops audio and goes to analysis immediately |
| Submit | **✅ Submit** — gets final AI feedback then goes to analysis |

### 4. Analysis Page
- View your score graph over the 15-minute session
- Read the AI's final evaluation of your code

---

## 🔑 Key Design Decisions

### Chat Route Ordering (FastAPI)
The `/ai/chat` route is deliberately declared **before** `/ai/{ai_type}` in `main.py`. FastAPI matches routes in registration order — declaring the wildcard first would intercept all chat requests.

### Concept Question Detection
Chat messages are scanned for keywords (`"what is"`, `"explain"`, `"difference between"`, etc.) before calling the LLM. Concept questions are sent **without** the problem context so the model teaches the concept purely, not anchored to the coding problem.

### Resume Caching
File bytes are hashed (MD5) before parsing. The same resume file (regardless of filename) returns cached results instantly from an in-memory dict.

### Dual LLM Temperature
- `chat` mode: `temperature=0.7` — more varied, creative educational answers
- `analysis` mode: `temperature=0.4` — deterministic, consistent evaluation

---

## 📁 Key Files

| File | Role |
|---|---|
| `backend/main.py` | All FastAPI routes |
| `backend/cv_parser.py` | Resume parsing + Azure Search ingestion |
| `backend/app/schemas.py` | Pydantic request/response models |
| `backend/app/problems.py` | Coding problem definitions |
| `backend/app/services/llm.py` | LLM factory (chat vs analysis) |
| `backend/app/services/session_store.py` | Cosmos DB session CRUD |
| `backend/app/services/speech_service.py` | Azure TTS helper |
| `client/src/pages/Landing.js` | Resume upload + dashboard with charts |
| `client/src/pages/Interview.js` | Full interview UI |
| `client/src/pages/Analysis.js` | Post-interview report |

---

## 🙋 Author

**Aditya Pratap Singh**  
IIT (ISM) Dhanbad  
[GitHub](https://github.com/Aditya5240)
