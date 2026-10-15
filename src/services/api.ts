const PROD_BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:8787").replace(/\/$/, "");
const LOCAL_BACKEND_URL = (import.meta.env.VITE_LOCAL_BACKEND_URL || "http://localhost:8787").replace(/\/$/, "");
const USE_LOCAL = import.meta.env.VITE_USE_LOCAL_BACKEND === "true";

const BACKEND_URL = USE_LOCAL ? LOCAL_BACKEND_URL : PROD_BACKEND_URL;

export interface TranscriptMsg {
  role: "system" | "ai" | "candidate" | "interviewer";
  content: string;
  created_at?: string;
  audioBase64?: string;
  messageId?: string;
  voice?: string;
  aiAudioBase64?: string; // NEW: Holds the pre-fetched AI speech
}

export const api = {
  // Starts the interview OR resumes it if it's already active
  async startInterview(interviewId?: string, email?: string, otp?: string): Promise<any> {
    const res = await fetch(`${BACKEND_URL}/api/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviewId: interviewId || null, email, otp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to start interview");
    return data;
  },

  async uploadAudio(interviewId: string, base64Audio: string, audioId: string): Promise<void> {
    fetch(`${BACKEND_URL}/api/audio-upload/${interviewId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64Audio, audioId }),
    }).catch(() => {}); // Pure fire-and-forget, no awaiting
  },

  async submitCode(interviewId: string, language: string, code: string, output: string, clientId?: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BACKEND_URL}/api/code/${interviewId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, code, output, clientId }),
    });
    if (!res.ok) throw new Error("Failed to submit code");
    return res.json();
  },

  async sendMessage(
    interviewId: string,
    message: string,
    audioId?: string,
    clientId?: string
  ): Promise<{ response: string; audio?: string; messageId?: string; voice?: string; audioBase64?: string }> {
    const res = await fetch(`${BACKEND_URL}/api/chat/${interviewId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, audioId, clientId }),
    });
    const data = await res.json();
    if (!res.ok) {
      if (data.type === 'SESSION_CONFLICT') throw new Error('SESSION_CONFLICT');
      throw new Error(data.error || "Failed to send message");
    }
    return data;
  },

  async streamMessage(
    interviewId: string,
    message: string,
    base64Audio: string | undefined,
    clientId: string | undefined,
    onText: (chunk: string) => void,
    onAudio: (base64Chunk: string) => void,
    onEnd: () => void
  ): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/api/chat/${interviewId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, base64Audio, clientId }),
    });

    if (!res.ok) throw new Error("Failed to start stream");

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No reader");
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || "";

      for (const part of parts) {
        if (part.startsWith('data: ')) {
          try {
            const data = JSON.parse(part.slice(6));
            if (data.type === 'text') onText(data.data);
            if (data.type === 'audio') onAudio(data.data);
            if (data.type === 'auto_end') {
              window.dispatchEvent(new CustomEvent('ai-auto-end'));
            }
            if (data.type === 'end') {
              onEnd();
              return;
            }
          } catch (e) {}
        }
      }
    }
  },

  async endInterview(
    interviewId: string,
    clientId?: string
  ): Promise<{ success: boolean; history: TranscriptMsg[] }> {
    const res = await fetch(`${BACKEND_URL}/api/end/${interviewId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    if (!res.ok) throw new Error("Failed to end interview");
    return res.json();
  },

  sendHeartbeat: async (interviewId: string, clientId: string) => {
    return fetch(`${BACKEND_URL}/api/heartbeat/${interviewId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
      keepalive: true
    }).catch(() => {});
  },

  releaseLock: async (interviewId: string, clientId: string) => {
    return fetch(`${BACKEND_URL}/api/release/${interviewId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
      keepalive: true
    }).catch(() => {});
  }
};
