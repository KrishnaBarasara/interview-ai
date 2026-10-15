import { create } from "zustand";
import { api } from "../services/api";
import type { TranscriptMsg } from "../services/api";

interface InterviewState {
  status: "idle" | "active" | "completed";
  interviewId: string | null;
  clientId: string | null;
  history: TranscriptMsg[];
  duration: number;
  startedAt: number | null;

  isAiThinking: boolean;
  isAiSpeaking: boolean;
  isMicrophoneActive: boolean;
  error: string | null;

  // Coding Round State
  isCodingMode: boolean;
  code: string;
  language: string;
  codeOutput: string;

  // Actions
  startSession: (targetInterviewId?: string, duration?: number, email?: string, otp?: string) => Promise<void>;
  submitCandidateAnswer: (text: string, base64Audio?: string) => Promise<void>;
  endSession: () => Promise<void>;
  setAiSpeaking: (isSpeaking: boolean) => void;
  setMicrophoneActive: (isActive: boolean) => void;
  clearError: () => void;
  
  // Coding Actions
  toggleCodingMode: () => void;
  setCode: (code: string) => void;
  setLanguage: (lang: string) => void;
  setCodeOutput: (output: string) => void;
  submitCodeToAi: () => Promise<void>;
  submitCode: (code: string, output: string) => Promise<void>;
}

export const useInterviewStore = create<InterviewState>((set, get) => ({
  status: "idle",
  interviewId: null,
  clientId: null,
  history: [],
  duration: 15,
  startedAt: null,
  isAiThinking: false,
  isAiSpeaking: false,
  isMicrophoneActive: false,
  error: null,

  isCodingMode: false,
  code: "// Write your solution here\n\nfunction solve() {\n  \n}\n\nconsole.log(solve());",
  language: "javascript",
  codeOutput: "",

  startSession: async (targetInterviewId?: string, duration?: number, email?: string, otp?: string) => {
    try {
      set({ status: "idle", error: null, isAiThinking: true });
      const data = await api.startInterview(targetInterviewId, email, otp);
      
      if (data.status === 'resumed') {
        set({
          status: "active",
          interviewId: data.interviewId,
          clientId: data.clientId,
          history: data.history,
          isAiThinking: false,
          duration: duration || 15,
          startedAt: data.startedAt ? new Date(data.startedAt).getTime() : Date.now(),
        });
      } else {
        set({
          status: "active",
          interviewId: data.interviewId,
          clientId: data.clientId,
          history: [{ 
            role: "ai", 
            content: data.greeting, 
            messageId: data.messageId, 
            voice: data.voice,
            aiAudioBase64: data.audioBase64 // FIX: Store the zero-latency greeting audio
          }],
          isAiThinking: false,
          duration: duration || 15,
          startedAt: data.startedAt ? new Date(data.startedAt).getTime() : Date.now(),
        });
      }
    } catch (error: any) {
      if (error.message.includes('SESSION_LOCKED')) {
        set({ error: error.message, isAiThinking: false, status: "idle" });
      } else {
        set({ error: error.message || "Failed to start session", isAiThinking: false });
      }
    }
  },

  submitCandidateAnswer: async (text: string, base64Audio?: string) => {
    const { interviewId, clientId, history } = get();
    if (!interviewId) return;

    // Add candidate message to local UI instantly
    const newMsg: TranscriptMsg = { role: "candidate", content: text };
    set({
      history: [...history, newMsg],
      isAiThinking: true,
      error: null,
    });

    try {
      window.dispatchEvent(new CustomEvent('ai-turn-start'));
      
      set((state) => ({
        history: [...state.history, { role: "interviewer", content: "" }],
        isAiThinking: false,
        isAiSpeaking: true,
      }));

      await api.streamMessage(
        interviewId,
        text,
        base64Audio,
        clientId || undefined,
        (textChunk) => {
          set((state) => {
            const newHistory = [...state.history];
            const lastMsg = newHistory[newHistory.length - 1];
            if (lastMsg.role === "interviewer") lastMsg.content += textChunk;
            return { history: newHistory };
          });
        },
        (audioChunkBase64) => {
          window.dispatchEvent(new CustomEvent('ai-audio-chunk', { detail: audioChunkBase64 }));
        },
        () => {
          window.dispatchEvent(new CustomEvent('ai-audio-end'));
        }
      );
    } catch (error: any) {
      set({ error: "Failed to send message. Please try again.", isAiThinking: false });
    }
  },

  submitCodeToAi: async () => {
    const { code, codeOutput } = get();
    await get().submitCode(code, codeOutput || "None");
  },

  submitCode: async (code: string, output: string) => {
    set({ isCodingMode: false, isAiThinking: true });
    const { interviewId, clientId, language } = get();

    if (interviewId) {
      try {
        await api.submitCode(interviewId, language, code, output, clientId || undefined);
      } catch (error: any) {
        if (error.message === 'SESSION_CONFLICT') {
          set({ error: "Session paused: This assessment is active on another device or tab.", status: "idle" });
        } else {
          console.error("Failed to save submission to DB", error);
        }
      }
    }

    const codeSubmissionMessage = `I have completed the code. Here is my submission:\n\nLanguage: ${language}\n\nCode:\n${code}\n\nExecution Output:\n${output}`;
    get().submitCandidateAnswer(codeSubmissionMessage);
  },

  endSession: async () => {
    const { interviewId, clientId } = get();
    if (!interviewId) return;

    try {
      set({ isAiThinking: true, error: null });
      const { history } = await api.endInterview(interviewId, clientId || undefined);

      set({
        status: "completed",
        history,
        isAiThinking: false,
        isAiSpeaking: false,
        isMicrophoneActive: false,
      });
    } catch (error: any) {
      set({
        error: error.message || "Failed to end session",
        isAiThinking: false,
      });
    }
  },

  setAiSpeaking: (isSpeaking) => set({ isAiSpeaking: isSpeaking }),
  setMicrophoneActive: (isActive) => set({ isMicrophoneActive: isActive }),
  clearError: () => set({ error: null }),

  toggleCodingMode: () =>
    set((state) => ({ isCodingMode: !state.isCodingMode })),
  setCode: (code) => set({ code }),
  setLanguage: (language) => set({ language }),
  setCodeOutput: (codeOutput) => set({ codeOutput }),
}));
