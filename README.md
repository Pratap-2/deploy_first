# Quick Start (Run the Project)

Follow the steps below to run the project locally.

---

# 1. Clone the Repository

```bash
git clone https://github.com/Aditya5240/code-ide.git
cd code-ide
```

---

# 2. Install Backend Dependencies

Move to the server folder:

```bash
cd server
```

Install required backend packages:

```bash
npm install express cors axios dotenv nodemon langchain @langchain/groq
```

---

# 3. Create Environment File

Inside the `server` folder create a file named:

```
.env
```

Add the following:

```
GROQ_API_KEY=your_groq_api_key_here
PORT=4000
```

Get a Groq API key from:

https://console.groq.com/keys

---

# 4. Start Backend Server

Run:

```bash
npm run dev
```

Backend server will start at:

```
http://localhost:4000
```

Keep this terminal running.

---

# 5. Install Frontend Dependencies

Open a **new terminal**.

Move to the client folder:

```bash
cd code-ide/client
```

Install frontend packages:

```bash
npm install
```

Install required libraries:

```bash
npm install axios @monaco-editor/react
```

---

# 6. Start Frontend

Run:

```bash
npm start
```

Frontend will start at:

```
http://localhost:3000
```

---

# 7. Open the Application

Open your browser and go to:

```
http://localhost:3000
```
---

# Quick Run Commands

Backend:

```bash
git clone https://github.com/Aditya5240/code-ide.git
cd code-ide/server
npm install express cors axios dotenv nodemon langchain @langchain/groq
npm run dev
```

Frontend (new terminal):

```bash
cd code-ide/client
npm install
npm install axios @monaco-editor/react
npm start
```


