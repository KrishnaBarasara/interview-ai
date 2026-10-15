import { useState, useRef, useCallback, useEffect } from "react";
import { useInterviewStore } from "../store/useInterviewStore";

const BACKEND_WS_URL = (import.meta.env.VITE_USE_LOCAL_BACKEND === "true" 
  ? import.meta.env.VITE_LOCAL_BACKEND_URL 
  : import.meta.env.VITE_BACKEND_URL)?.replace(/^http/, 'ws') || "ws://localhost:8787";

export const unlockAudio = () => {};

export const useSpeech = () => {
  const [isListening, setIsListening] = useState(false);
  const [liveText, setLiveText] = useState("");
  const { setAiSpeaking, submitCandidateAnswer, setMicrophoneActive } = useInterviewStore();
  
  const wsRef = useRef<WebSocket | null>(null);
  const silenceIntervalRef = useRef<any>(null);
  const isMicActiveRef = useRef(false);
  const pendingTextRef = useRef<string | null>(null);

  // Audio Stream Track References
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Playback References
  const playbackContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const isStreamCompleteRef = useRef(false);
  const activeNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const leftoverByteRef = useRef<number | null>(null);

  // Initialize the persistent 24/7 AssemblyAI streaming socket connection
  const initialize247Stream = useCallback(() => {
    const { interviewId, clientId } = useInterviewStore.getState();
    if (!interviewId || !clientId || wsRef.current) return;

    console.log("[Speech Engine] Initializing 24/7 stream proxy socket.");
    const wsUrl = `${BACKEND_WS_URL}/api/stream?interviewId=${interviewId}&clientId=${clientId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      silenceIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN && !isMicActiveRef.current) {
          const emptyBuffer = new Int16Array(4096);
          ws.send(emptyBuffer.buffer);
        }
      }, 250);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "InterviewControl" && data.action === "SubmitAnswer") {
          const { isAiThinking, isAiSpeaking } = useInterviewStore.getState();
          if (isAiThinking || isAiSpeaking) return;

          console.log("[Speech Engine] Silence threshold hit. Submitting transcript:", data.text);
          pendingTextRef.current = data.text;
          stopMicHardware(); 
        } else if (data.type === "InterviewControl" && data.action === "KillSession") {
          stopMicHardware();
          window.location.href = "/";
        } else if (data.type === "LiveTranscript" && data.text) {
          const { isAiSpeaking, isAiThinking } = useInterviewStore.getState();
          if (!isAiSpeaking && !isAiThinking) setLiveText(data.text);
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      wsRef.current = null;
      if (silenceIntervalRef.current) clearInterval(silenceIntervalRef.current);
    };
  }, [setLiveText]);

  // Persistent Microphone Starter (Called once on startup, or to reactivate track state)
  const startMicHardware = useCallback(async () => {
    if (isMicActiveRef.current) return;
    
    if (!wsRef.current) initialize247Stream();

    try {
      if (!streamRef.current) {
        console.log("[Speech Engine] Requesting persistent hardware mic access.");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true }
        });
        streamRef.current = stream;
      }

      // Explicitly enable the existing audio track instead of rebuilding it
      streamRef.current.getAudioTracks().forEach(track => { track.enabled = true; });
      isMicActiveRef.current = true;
      
      const { isAiSpeaking } = useInterviewStore.getState();
      if (!isAiSpeaking) setIsListening(true);
      setMicrophoneActive(true);

      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(",")[1];
          if (pendingTextRef.current) {
            submitCandidateAnswer(pendingTextRef.current, base64data);
            pendingTextRef.current = null;
            setLiveText(""); // Reset transcription stream frame
          }
        };
      };

      mediaRecorder.start();

      let audioContext = audioContextRef.current;
      if (!audioContext || audioContext.state === "closed") {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        audioContextRef.current = audioContext;
      }
      if (audioContext.state === "suspended") await audioContext.resume().catch(() => {});

      if (!sourceRef.current) {
        sourceRef.current = audioContext.createMediaStreamSource(streamRef.current);
        processorRef.current = audioContext.createScriptProcessor(4096, 1, 1);
        sourceRef.current.connect(processorRef.current);
        processorRef.current.connect(audioContext.destination);
      }

      if (processorRef.current) {
        processorRef.current.onaudioprocess = (e) => {
          if (wsRef.current?.readyState === WebSocket.OPEN && isMicActiveRef.current) {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 32767;
            }
            wsRef.current.send(pcm16.buffer); 
          }
        };
      }
    } catch (error) {
      console.error("[Speech Engine] Persistent mic activation failed:", error);
      setIsListening(false);
    }
  }, [initialize247Stream, setIsListening, setMicrophoneActive, submitCandidateAnswer]);

  const stopMicHardware = useCallback(() => {
    isMicActiveRef.current = false; 
    setIsListening(false);
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    
    // Smoothly disable/mute the audio track rather than killing the hardware allocation completely
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => { track.enabled = false; });
    }
    
    setMicrophoneActive(false);
  }, [setMicrophoneActive]);

  const checkTurnComplete = useCallback(() => {
    if (isStreamCompleteRef.current && activeNodesRef.current.length === 0) {
      const { isAiSpeaking } = useInterviewStore.getState();
      if (isAiSpeaking) {
        setAiSpeaking(false);
        startMicHardware();
      }
    }
  }, [setAiSpeaking, startMicHardware]);

  useEffect(() => {
    const handleAudioChunk = async (e: any) => {
      try {
        const base64Chunk = e.detail;
        if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') {
          playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        }
        const ctx = playbackContextRef.current;
        if (ctx.state === 'suspended') await ctx.resume().catch(()=>{});

        const binaryStr = atob(base64Chunk);
        let bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        
        let mergedBytes: Uint8Array;
        if (leftoverByteRef.current !== null) {
          mergedBytes = new Uint8Array(bytes.length + 1);
          mergedBytes[0] = leftoverByteRef.current;
          mergedBytes.set(bytes, 1);
          leftoverByteRef.current = null;
        } else {
          mergedBytes = bytes;
        }

        if (mergedBytes.length % 2 !== 0) {
          leftoverByteRef.current = mergedBytes[mergedBytes.length - 1];
          mergedBytes = mergedBytes.slice(0, mergedBytes.length - 1);
        }

        if (mergedBytes.length === 0) return;

        const int16 = new Int16Array(mergedBytes.buffer, mergedBytes.byteOffset, mergedBytes.length / 2);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;

        const buffer = ctx.createBuffer(1, float32.length, 16000);
        buffer.getChannelData(0).set(float32);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        
        const currentTime = ctx.currentTime;
        if (nextPlayTimeRef.current < currentTime) {
          nextPlayTimeRef.current = currentTime + 0.05;
        }

        source.start(nextPlayTimeRef.current);
        nextPlayTimeRef.current += buffer.duration;
        
        activeNodesRef.current.push(source);
        source.onended = () => {
          activeNodesRef.current = activeNodesRef.current.filter(n => n !== source);
          checkTurnComplete();
        };
      } catch (err) { console.error("PCM Playback error:", err); }
    };

    const handleAudioEnd = () => {
      isStreamCompleteRef.current = true;
      checkTurnComplete();
    };

    const handleTurnStart = () => {
      isStreamCompleteRef.current = false;
      nextPlayTimeRef.current = 0;
      leftoverByteRef.current = null;
      activeNodesRef.current.forEach(node => {
        try { node.stop(); node.disconnect(); } catch(e){}
      });
      activeNodesRef.current = [];
    };

    window.addEventListener('ai-audio-chunk', handleAudioChunk);
    window.addEventListener('ai-audio-end', handleAudioEnd);
    window.addEventListener('ai-turn-start', handleTurnStart);

    return () => {
      window.removeEventListener('ai-audio-chunk', handleAudioChunk);
      window.removeEventListener('ai-audio-end', handleAudioEnd);
      window.removeEventListener('ai-turn-start', handleTurnStart);
    };
  }, [checkTurnComplete]);

  const speak = useCallback(async (_text: string, _messageId?: string, _voiceModel?: string, audioBase64?: string) => {
    setAiSpeaking(true);
    stopMicHardware(); 
    if (audioBase64) {
      window.dispatchEvent(new CustomEvent('ai-turn-start'));
      window.dispatchEvent(new CustomEvent('ai-audio-chunk', { detail: audioBase64 }));
      window.dispatchEvent(new CustomEvent('ai-audio-end'));
    }
  }, [setAiSpeaking, stopMicHardware]);

  const cancelSpeech = useCallback(() => {
    activeNodesRef.current.forEach(node => {
      try { node.stop(); node.disconnect(); } catch (e) {}
    });
    activeNodesRef.current = [];
    nextPlayTimeRef.current = 0;
    leftoverByteRef.current = null;
    stopMicHardware();
    
    // Explicit clean shutdown of persistent tracks if user cancels/ends session entirely
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, [stopMicHardware]);

  return { wsRef, startListeningInternal: startMicHardware, stopListening: stopMicHardware, speak, cancelSpeech, isListening, liveText };
};
