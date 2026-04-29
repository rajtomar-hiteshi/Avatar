# Avatar — AI Voice Agent

A real-time voice conversation agent powered by ElevenLabs STT, Groq LLM, and ElevenLabs TTS. Speak naturally — Avatar listens, thinks, and responds with a human-sounding voice in under 1.5 seconds.

---

## How It Works

```
Your Voice → STT (ElevenLabs) → LLM (Groq) → TTS (ElevenLabs) → Audio Response
```

The pipeline is fully **streaming** — the LLM response is split into sentences as it generates, each sentence is converted to audio immediately, and audio chunks play back-to-back without waiting for the full response. This gives near-instant responses instead of waiting 3+ seconds for the full pipeline to complete.

---

## Features

- **Continuous conversation loop** — no push-to-talk, just speak naturally
- **Voice Activity Detection (VAD)** — automatically detects when you start and stop speaking
- **Streaming pipeline** — first audio chunk plays within ~1s of finishing your sentence
- **Live transcript** — see your words and the agent's reply appear in real time
- **Mic sensitivity control** — adjustable slider for different microphones and environments
- **Latency display** — debug panel shows STT / LLM / TTS timing for every response

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend | FastAPI (Python) |
| Speech-to-Text | ElevenLabs Scribe v1 |
| Language Model | Groq — `llama-3.1-8b-instant` |
| Text-to-Speech | ElevenLabs `eleven_turbo_v2_5` |
| Streaming | Server-Sent Events (SSE) |
| Audio | Web Audio API + MediaRecorder |

---

## Project Structure

```
Avatar/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Loads environment variables
│   ├── logger.py            # Logging setup
│   ├── routes/
│   │   └── voice.py         # POST /voice/process — SSE streaming endpoint
│   └── services/
│       ├── stt.py           # ElevenLabs Speech-to-Text
│       ├── llm.py           # Groq LLM (batch + streaming)
│       └── tts.py           # ElevenLabs TTS (batch + chunk)
├── frontend-react/
│   ├── index.html
│   ├── vite.config.js       # Dev proxy → backend
│   └── src/
│       ├── App.jsx           # Root component + conversation state
│       ├── api/
│       │   └── voiceApi.js  # SSE stream reader + audio queue
│       ├── hooks/
│       │   └── useVoiceRecorder.js  # VAD loop + MediaRecorder
│       └── components/
│           ├── TalkButton.jsx
│           ├── StatusBar.jsx
│           ├── ConversationLog.jsx
│           └── DebugPanel.jsx
├── .env                     # API keys (never committed)
├── .gitignore
├── requirements.txt
└── README.md
```

---

## Prerequisites

Make sure you have the following installed:

- **Python 3.10+** — [python.org](https://www.python.org/downloads/)
- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **Git** — [git-scm.com](https://git-scm.com/)

You will also need API keys from:

- **ElevenLabs** — [elevenlabs.io](https://elevenlabs.io) (free tier works)
- **Groq** — [console.groq.com](https://console.groq.com) (free tier works)

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/rajtomar-hiteshi/Avatar.git
cd Avatar
```

### 2. Create your `.env` file

Create a file named `.env` in the project root (same level as `requirements.txt`):

```env
GROQ_API_KEY=your_groq_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id_here
```

**Where to get these:**

| Key | Where to find it |
|-----|-----------------|
| `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) |
| `ELEVENLABS_API_KEY` | ElevenLabs → Profile → API Key |
| `ELEVENLABS_VOICE_ID` | ElevenLabs → Voices → click a voice → copy the Voice ID from the URL or settings |

### 3. Set up the Python backend

```bash
# Create a virtual environment
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 4. Set up the React frontend

```bash
cd frontend-react
npm install
cd ..
```

---

## Running the App

You need **two terminals** running at the same time.

### Terminal 1 — Backend

```bash
# From the project root, with venv activated
uvicorn backend.main:app --reload
```

The backend starts at `http://127.0.0.1:8000`

### Terminal 2 — Frontend

```bash
cd frontend-react
npm run dev
```

The frontend starts at `http://localhost:5173`

Open **http://localhost:5173** in your browser and click **Start Conversation**.

> **Note:** The Vite dev server automatically proxies `/voice/*` requests to the backend, so no CORS configuration is needed during development.

---

## Usage

1. Click **Start Conversation**
2. Speak normally — the agent detects your voice automatically (VAD)
3. When you stop speaking, it processes and replies within ~1.5 seconds
4. The conversation continues automatically — no need to click again
5. Click **Stop** to end the session

**Tips:**
- Adjust the **Mic Sensitivity** slider if VAD isn't picking up your voice
- The **Debug** panel shows latency breakdown for each response
- Works best with a headset to avoid the agent's voice triggering VAD

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | Yes | Groq API key for LLM inference |
| `ELEVENLABS_API_KEY` | Yes | ElevenLabs API key for STT and TTS |
| `ELEVENLABS_VOICE_ID` | Yes | The voice ID used for TTS responses |

---

## Troubleshooting

**Microphone not detected**
- Make sure your browser has microphone permission for `localhost`
- Try adjusting the Mic Sensitivity slider upward

**Agent replies in wrong language**
- The LLM is instructed to always reply in English
- STT is forced to English (`language_code: en`)

**Backend not picking up `.env` changes**
- Uvicorn's `--reload` only watches `.py` files
- After editing `.env`, fully restart the backend (`Ctrl+C` then run again)

**Audio doesn't play**
- Check browser console for autoplay errors
- Some browsers block audio until the user interacts with the page — clicking Start counts as interaction

---

## License

MIT
