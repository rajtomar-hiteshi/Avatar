'use strict';

const API_URL = 'http://127.0.0.1:8000/voice/process';

const talkBtn = document.getElementById('talk-btn');
const statusEl = document.getElementById('status');
const logEl = document.getElementById('conversation-log');

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// ── State machine ──────────────────────────────────────────────────────────

function setState(state, detail) {
  const labels = {
    idle:       'Idle',
    recording:  'Recording…',
    processing: 'Processing…',
    speaking:   'Speaking…',
  };
  const base = labels[state] ?? state;
  statusEl.textContent = detail ? `${base} — ${detail}` : base;
  statusEl.className = state.startsWith('error') ? 'error' : state;

  talkBtn.className = state === 'recording' ? 'recording' : '';
  talkBtn.disabled = state === 'processing' || state === 'speaking';
}

// ── Conversation log ───────────────────────────────────────────────────────

function addMessage(text, role) {
  const bubble = document.createElement('div');
  bubble.classList.add('message', role);
  bubble.textContent = text;
  logEl.appendChild(bubble);
  logEl.scrollTop = logEl.scrollHeight;
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Recording ──────────────────────────────────────────────────────────────

async function startRecording() {
  if (isRecording) return;

  try {
    setState('processing', 'requesting mic…');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    });

    mediaRecorder.start();
    isRecording = true;
    setState('recording');
  } catch (err) {
    const msg = `${err.name}: ${err.message}`;
    console.error('Mic error:', err);
    setState('error', msg);
    setTimeout(() => setState('idle'), 8000);
  }
}

function stopAndSubmit() {
  if (!isRecording || !mediaRecorder) return;
  isRecording = false;

  mediaRecorder.addEventListener('stop', async () => {
    const blob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
    mediaRecorder.stream.getTracks().forEach((t) => t.stop());
    mediaRecorder = null;
    await submitAudio(blob);
  }, { once: true });

  mediaRecorder.stop();
}

// ── API call ───────────────────────────────────────────────────────────────

async function submitAudio(blob) {
  setState('processing', 'uploading audio…');

  try {
    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');

    setState('processing', 'waiting for server…');
    let response;
    try {
      response = await fetch(API_URL, { method: 'POST', body: formData });
    } catch (networkErr) {
      console.error('Network error:', networkErr);
      throw new Error(`Network error: ${networkErr.message}`);
    }

    if (!response.ok) {
      const body = await response.text();
      const msg = `HTTP ${response.status} ${response.statusText}: ${body}`;
      console.error('Server error:', msg);
      throw new Error(msg);
    }

    const rawTranscript = response.headers.get('X-Transcript') ?? '(none)';
    const rawReply = response.headers.get('X-Reply') ?? '(none)';

    let transcript = '';
    let reply = '';
    try {
      transcript = rawTranscript === '(none)' ? '' : decodeURIComponent(rawTranscript);
      reply = rawReply === '(none)' ? '' : decodeURIComponent(rawReply);
    } catch {
      transcript = rawTranscript;
      reply = rawReply;
    }

    if (transcript) addMessage(transcript, 'user');
    if (reply) addMessage(reply, 'agent');

    setState('processing', 'loading audio response…');
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    setState('speaking');

    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(audioUrl);
      setState('idle');
    }, { once: true });

    audio.addEventListener('error', () => {
      const code = audio.error?.code;
      const detail = audio.error?.message || '(no detail)';
      const msg = `Audio playback error — code ${code}: ${detail}`;
      console.error(msg, audio.error);
      URL.revokeObjectURL(audioUrl);
      setState('error', msg);
      setTimeout(() => setState('idle'), 8000);
    }, { once: true });

    await audio.play();
  } catch (err) {
    console.error('Voice agent error:', err);
    setState('error', err.message || String(err));
    setTimeout(() => setState('idle'), 8000);
  }
}

// ── Button event listeners ─────────────────────────────────────────────────

talkBtn.addEventListener('mousedown', (e) => {
  e.preventDefault();
  startRecording();
});

talkBtn.addEventListener('mouseup', (e) => {
  e.preventDefault();
  stopAndSubmit();
});

talkBtn.addEventListener('mouseleave', () => {
  if (isRecording) stopAndSubmit();
});

talkBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  startRecording();
}, { passive: false });

talkBtn.addEventListener('touchend', (e) => {
  e.preventDefault();
  stopAndSubmit();
}, { passive: false });

// ── Init ───────────────────────────────────────────────────────────────────

setState('idle');
