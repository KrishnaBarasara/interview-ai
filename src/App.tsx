import { useEffect, useRef, useState } from "react";
import { useInterviewStore } from "./store/useInterviewStore";
import { useAuthStore } from "./store/useAuthStore";
import { useSpeech, unlockAudio } from "./hooks/useSpeech";
import { supabase } from "./lib/supabase";
import { api } from "./services/api";
import {
  Mic,
  MicOff,
  Play,
  Square,
  Volume2,
  Code2,
  LayoutPanelLeft,
  Activity,
  CheckCircle2,
  BrainCircuit,
  MessageSquare,
  Loader2,
  AlertTriangle,
  WifiOff,
  Clock,
  XCircle,
  Lock,
  Check,
} from "lucide-react";
import { CodeEditor } from "./components/CodeEditor";
import { Dashboard } from "./components/Dashboard";
import { Auth } from "./components/Auth";
import { useInterviewStability } from "./hooks/useInterviewStability";

export default function App() {
  const { status, error, clearError, isCodingMode } = useInterviewStore();

  const queryParams = new URLSearchParams(window.location.search);
  let targetId = queryParams.get("id");
  if (targetId === "undefined" || targetId === "null" || targetId === "") {
    targetId = null;
  }

  const view = targetId ? "candidate" : "dashboard";
  const { user, loading: authLoading, checkUser, signOut } = useAuthStore();
  const { isOffline, showCheatWarning, tabViolations, isDuplicateTab } =
    useInterviewStability(status === "active");

  useEffect(() => {
    checkUser();
  }, [checkUser]);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300 font-sans selection:bg-indigo-500/30">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/10 blur-[120px] pointer-events-none rounded-full"></div>

      <main
        className={`relative z-10 mx-auto p-6 h-full flex flex-col pt-24 min-h-screen transition-all duration-700 ${isCodingMode && view === "candidate" ? "max-w-[95rem]" : "max-w-6xl"}`}
      >
        <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-[#09090b]/80 backdrop-blur-md border-b border-white/5 z-50">
          <div className="flex items-center space-x-2">
            <BrainCircuit className="w-6 h-6 text-indigo-400" />
            <span className="font-semibold text-zinc-100 tracking-wide">
              Albiorix Tech Assessment
            </span>
          </div>
          <div className="flex items-center space-x-4">
            {user && view === "dashboard" && (
              <button
                onClick={signOut}
                className="text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Sign Out
              </button>
            )}
          </div>
        </header>

        <div className="flex flex-col space-y-3 mb-6 z-40 relative mt-4">
          {error && (
            <div className="glass-panel border-red-500/30 text-red-400 p-4 rounded-xl flex justify-between items-center animate-fade-in shadow-lg shadow-red-500/5">
              <div className="flex items-center space-x-3">
                <Activity className="w-5 h-5" />
                <span className="font-medium">{error}</span>
              </div>
              <button
                onClick={clearError}
                className="p-1 hover:bg-red-500/10 rounded-md transition-colors"
              >
                ×
              </button>
            </div>
          )}
          {isOffline && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl flex items-center space-x-3 animate-fade-in shadow-lg shadow-red-500/5">
              <WifiOff className="w-5 h-5 animate-pulse" />
              <span className="font-medium">
                Connection lost. Please check your internet connection. The
                interview is paused.
              </span>
            </div>
          )}
          {showCheatWarning && view === "candidate" && (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-4 rounded-xl flex items-center space-x-3 animate-in slide-in-from-top shadow-lg shadow-amber-500/5">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">
                Warning: Tab switching is not permitted during the interview.
                (Violation {tabViolations})
              </span>
            </div>
          )}
        </div>

        {view === "dashboard" ? (
          authLoading ? (
            <div className="flex justify-center items-center h-64 w-full">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
          ) : user ? (
            <Dashboard />
          ) : (
            <Auth />
          )
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 w-full mt-[-60px]">
            {status === "idle" && (
              <WelcomeScreen
                targetId={targetId}
                isDuplicateTab={isDuplicateTab}
              />
            )}
            {status === "active" && <ActiveInterviewScreen />}
            {status === "completed" && <ReportScreen />}
          </div>
        )}
      </main>
    </div>
  );
}

// ==========================================
// SCREEN 1: Welcome & Verification Screen
// ==========================================
function WelcomeScreen({
  targetId,
  isDuplicateTab,
}: {
  targetId: string | null;
  isDuplicateTab?: boolean;
}) {
  const { startSession, isAiThinking, error, clearError } = useInterviewStore();
  const [scheduleTime, setScheduleTime] = useState<Date | null>(null);
  const [canStart, setCanStart] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [timeMessage, setTimeMessage] = useState("");
  const [interviewStatus, setInterviewStatus] = useState<string>("pending");
  const [isInvalid, setIsInvalid] = useState(!targetId);
  const [isExpired, setIsExpired] = useState(false);

  // Security Auth States
  const [interviewData, setInterviewData] = useState<any>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [authForm, setAuthForm] = useState({ email: "", otp: "" });
  const [authError, setAuthError] = useState("");

  // Compliance & Hardware States
  const [hasConsent, setHasConsent] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile(); // Check on mount
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!targetId) {
      setIsInvalid(true);
      setLoadingInfo(false);
      return;
    }

    const fetchInfo = async () => {
      const { data, error } = await supabase
        .from("interviews")
        .select("*")
        .eq("id", targetId)
        .single();

      // BLOCK ACCESS IF HIDDEN
      if (error || !data || data.is_hidden) {
        setIsInvalid(true);
        setLoadingInfo(false);
        return;
      }

      setInterviewData(data);
      setInterviewStatus(data.status);

      if (
        data.status === "completed" ||
        data.status === "cancelled" ||
        data.status === "partially_completed"
      ) {
        setCanStart(false);
        setLoadingInfo(false);
        return;
      }

      // EXPIRED CHECK
      if (data.expires_at && data.status === "pending") {
        const expiry = new Date(data.expires_at).getTime();
        const now = new Date().getTime();
        if (now > expiry) {
          setIsExpired(true);
          setCanStart(false);
          setLoadingInfo(false);
          return;
        }
      }

      if (data.scheduled_at) {
        setScheduleTime(new Date(data.scheduled_at));
        // Bypass the timer lock if they are returning to an already started session
        if (data.status === "incomplete" || data.status === "active") {
          setCanStart(true);
        }
      } else {
        setCanStart(true);
      }
      setLoadingInfo(false);
    };

    fetchInfo();
  }, [targetId]);

  // Watch for the specific 5-minute permanently closed error from the backend
  useEffect(() => {
    if (error && error.includes("permanently closed")) {
      setInterviewStatus("partially_completed");
      clearError(); // Clear the top red toast so we rely purely on the full-screen UI
    }
  }, [error, clearError]);

  useEffect(() => {
    if (!scheduleTime || interviewStatus !== "pending") return;

    const checkTime = () => {
      const now = new Date();
      const diffMs = scheduleTime.getTime() - now.getTime();

      if (diffMs <= 0) {
        setCanStart(true);
        setTimeMessage("");
      } else {
        setCanStart(false);
        const totalSeconds = Math.floor(diffMs / 1000);

        if (totalSeconds < 3600) {
          // ENTERPRISE BEST PRACTICE: Less than an hour away, show high-precision MM:SS ticker
          const m = Math.floor(totalSeconds / 60);
          const s = totalSeconds % 60;
          setTimeMessage(`Unlocks in ${m}:${s.toString().padStart(2, "0")}`);
        } else {
          // More than an hour away: Show days, hours, and rounded-up minutes
          const diffMinutes = diffMs / 60000;
          const days = Math.floor(diffMinutes / 1440);
          const hours = Math.floor((diffMinutes % 1440) / 60);
          const mins = Math.ceil(diffMinutes % 60); // Use ceil so 1h 45s shows as 2m instead of 1m

          let msg = "Unlocks in ";
          if (days > 0) msg += `${days}d `;
          if (hours > 0) msg += `${hours}h `;
          msg += `${mins}m`;
          setTimeMessage(msg);
        }
      }
    };

    checkTime();
    // Bumped interval down to 1000ms (1 second) to support smooth seconds ticking
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [scheduleTime, interviewStatus]);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!interviewData) return;

    if (
      authForm.email.trim().toLowerCase() ===
        interviewData.candidate_email.toLowerCase() &&
      authForm.otp.trim() === interviewData.otp
    ) {
      setIsVerified(true);
      setAuthError("");
      // Auto-resume if they were already active or incomplete before losing connection
      if (
        interviewData.status === "active" ||
        interviewData.status === "incomplete"
      ) {
        startSession(targetId || undefined, interviewData?.duration, authForm.email, authForm.otp);
      }
    } else {
      setAuthError("Invalid email or Access PIN. Please try again.");
    }
  };

  // 1. INVALID SCREEN
  if (isInvalid) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center max-w-2xl mx-auto w-full animate-fade-in shadow-2xl border border-red-500/20">
        <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-red-500/20">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-4 tracking-tight">
          Invalid Assessment Link
        </h1>
        <p className="text-zinc-400 text-lg leading-relaxed">
          We couldn't find an active assessment with this link. <br />
          <br />
          Please make sure you copied the exact link provided in your email, or
          contact your recruiter if you believe this is an error.
        </p>
      </div>
    );
  }

  // 2. CANCELLED SCREEN
  if (interviewStatus === "cancelled") {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center max-w-2xl mx-auto w-full animate-fade-in shadow-2xl border border-red-500/20">
        <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-red-500/20">
          <XCircle className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-4 tracking-tight">
          Interview Cancelled
        </h1>
        <p className="text-zinc-400 text-lg leading-relaxed mb-6">
          This interview session has been cancelled by the recruiter. <br />
          <br />
          If you have any questions, please reach out directly to your hiring
          contact.
        </p>
      </div>
    );
  }

  // EXPIRED SCREEN
  if (isExpired) {
    return (
      <div className="glass-panel rounded-2xl p-12 text-center max-w-2xl mx-auto w-full animate-fade-in shadow-2xl border border-amber-500/20">
        <div className="w-20 h-20 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-amber-500/20">
          <Clock className="w-10 h-10 text-amber-400" />
        </div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-4 tracking-tight">
          Link Expired
        </h1>
        <p className="text-zinc-400 text-lg leading-relaxed mb-6">
          The designated time window to complete this assessment has closed.{" "}
          <br />
          <br />
          Please contact your recruiter if you need to request a new invitation
          link.
        </p>
      </div>
    );
  }

  // 3. COMPLETED OR PARTIALLY COMPLETED SCREEN
  if (
    interviewStatus === "completed" ||
    interviewStatus === "partially_completed"
  ) {
    const isPartial = interviewStatus === "partially_completed";
    return (
      <div
        className={`glass-panel rounded-2xl p-12 text-center max-w-2xl mx-auto w-full animate-fade-in shadow-2xl border ${isPartial ? "border-indigo-500/20" : "border-emerald-500/20"}`}
      >
        <div
          className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-8 border ${isPartial ? "bg-indigo-500/10 border-indigo-500/20" : "bg-emerald-500/10 border-emerald-500/20"}`}
        >
          <CheckCircle2
            className={`w-10 h-10 ${isPartial ? "text-indigo-400" : "text-emerald-400"}`}
          />
        </div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-4 tracking-tight">
          Assessment {isPartial ? "Closed" : "Completed"}
        </h1>

        <p className="text-zinc-400 text-lg leading-relaxed mb-6">
          {isPartial
            ? "This session was disconnected and the 5-minute reconnect window has expired. The assessment is now permanently closed."
            : "You have successfully completed this interview session."}{" "}
          <br />
          <br />
          The recruiter will review your results and get back to you shortly.
          You may now close this tab.
        </p>
      </div>
    );
  }

  // 4. LOADING STATE
  if (loadingInfo) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-6" />
        <span className="text-zinc-400 animate-pulse text-lg">
          Loading assessment data...
        </span>
      </div>
    );
  }

  // 5. SECURITY VERIFICATION SCREEN
  if (!isVerified) {
    return (
      <div className="glass-panel rounded-2xl p-10 max-w-md mx-auto w-full animate-fade-in shadow-2xl border border-white/5">
        <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-indigo-500/20">
          <Lock className="w-8 h-8 text-indigo-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2 text-center">
          Security Verification
        </h1>
        <p className="text-zinc-400 text-sm text-center mb-8">
          Please verify your identity using the email address and 6-digit Access
          PIN provided by your recruiter.
        </p>

        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <input
              required
              type="email"
              value={authForm.email}
              onChange={(e) =>
                setAuthForm({ ...authForm, email: e.target.value })
              }
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 outline-none focus:border-indigo-500 transition-colors"
              placeholder="e.g. jane@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
              6-Digit Access PIN
            </label>
            <input
              required
              type="text"
              maxLength={6}
              value={authForm.otp}
              onChange={(e) =>
                setAuthForm({ ...authForm, otp: e.target.value })
              }
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 outline-none focus:border-indigo-500 transition-colors font-mono tracking-widest text-lg text-center"
              placeholder="••••••"
            />
          </div>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2 shrink-0" /> {authError}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all active:scale-[0.98] shadow-lg shadow-indigo-500/20"
          >
            Verify & Continue
          </button>
        </form>
      </div>
    );
  }

  // 6. MAIN WELCOME / START SCREEN
  return (
    <div className="glass-panel rounded-2xl p-12 text-center max-w-2xl mx-auto w-full animate-fade-in shadow-2xl">
      <div className="w-20 h-20 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-indigo-500/20">
        <BrainCircuit className="w-10 h-10 text-indigo-400" />
      </div>
      <h1 className="text-4xl font-bold text-zinc-100 mb-3 tracking-tight">
        Welcome, {interviewData?.candidate_name.split(" ")[0]}
      </h1>
      <h2 className="text-xl font-medium text-indigo-400 mb-6 tracking-wide">
        {interviewData?.position} Assessment
      </h2>

      <p className="text-zinc-400 text-lg mb-8 leading-relaxed max-w-lg mx-auto">
        The AI interviewer is ready to begin. Please ensure you are in a quiet
        environment with a working microphone.
      </p>

      <div className="flex flex-col items-center">
        {!canStart && interviewStatus !== "active" && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-3 rounded-lg flex items-center space-x-2 mb-6 animate-fade-in">
            <Clock className="w-5 h-5" />
            <span className="font-medium text-sm">
              Scheduled for{" "}
              {scheduleTime?.toLocaleString([], {
                dateStyle: "short",
                timeStyle: "short",
              })}
              .{timeMessage && ` (${timeMessage})`}
            </span>
          </div>
        )}

        {isMobile && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-4 rounded-xl flex items-start space-x-3 mb-6 text-left max-w-md animate-fade-in">
            <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
            <span className="text-sm leading-relaxed">
              <strong>Mobile Device Detected:</strong> This assessment requires
              a desktop or laptop computer. The integrated code editor and AI
              environment are not supported on mobile devices. Please switch to
              a larger screen to continue.
            </span>
          </div>
        )}

        {!isMobile && interviewStatus !== "active" && (
          <label className="flex items-start space-x-3 text-left mb-8 cursor-pointer group max-w-md animate-fade-in">
            <div className="relative flex items-start mt-0.5">
              <input
                type="checkbox"
                checked={hasConsent}
                onChange={(e) => setHasConsent(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-5 h-5 rounded border border-zinc-600 bg-zinc-900/50 peer-checked:bg-indigo-500 peer-checked:border-indigo-500 flex items-center justify-center transition-all">
                <Check className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
              </div>
            </div>
            <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors leading-relaxed">
              I consent to having my microphone audio recorded, transcribed, and
              analyzed by AI for the purpose of this interview evaluation.
            </span>
          </label>
        )}
        {isDuplicateTab && interviewStatus !== "active" && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-start space-x-3 mb-6 text-left max-w-md animate-fade-in">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="text-sm font-medium">
              This interview is already open in another tab. Please close this
              tab to prevent conflicts.
            </span>
          </div>
        )}

        <button
          onClick={() => {
            // PRIME THE AUDIO ENGINE ONLY
            unlockAudio();
            window.speechSynthesis.resume();
            const primer = new SpeechSynthesisUtterance(" ");
            primer.volume = 0;
            window.speechSynthesis.speak(primer);
            startSession(targetId || undefined, interviewData?.duration, authForm.email, authForm.otp);
          }}
          disabled={
            isAiThinking ||
            (!canStart && interviewStatus === "pending") ||
            (!hasConsent && interviewStatus !== "active") ||
            isMobile ||
            isDuplicateTab
          }
          className="group relative px-8 py-4 bg-zinc-100 hover:bg-white text-zinc-900 disabled:bg-zinc-800 disabled:text-zinc-500 font-semibold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center space-x-3 mx-auto w-full max-w-sm overflow-hidden"
        >
          {isAiThinking ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5 fill-current" />
          )}
          <span>
            {isAiThinking
              ? "Initializing Session..."
              : !canStart && interviewStatus === "pending"
                ? "Waiting for Scheduled Time"
                : "Begin Assessment"}
          </span>
        </button>

        {!canStart && interviewStatus === "pending" && (
          <p className="text-xs text-zinc-500 mt-4">
            The "Begin Assessment" button will activate exactly at your scheduled time.
          </p>
        )}
      </div>
    </div>
  );
}

// ==========================================
// SCREEN 2: Active Interview Loop
// ==========================================
function ActiveInterviewScreen() {
  const {
    history,
    isAiThinking,
    isAiSpeaking,
    endSession,
    isCodingMode,
    toggleCodingMode,
    duration,
    startedAt,
  } = useInterviewStore();
  const { speak, isListening, cancelSpeech, liveText } = useSpeech();
  const lastSpokenIndex = useRef(-1);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);

  // Auto-scroll ref for the live transcript
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (captionsEnabled && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [liveText, captionsEnabled]);

  // --- Auto-End Logic ---
  const [isPendingAutoEnd, setIsPendingAutoEnd] = useState(false);

  useEffect(() => {
    const handleAutoEnd = () => setIsPendingAutoEnd(true);
    window.addEventListener('ai-auto-end', handleAutoEnd);
    return () => window.removeEventListener('ai-auto-end', handleAutoEnd);
  }, []);

  useEffect(() => {
    // If auto-end flag is raised and the AI has physically stopped playing audio, end it.
    if (isPendingAutoEnd && !isAiSpeaking && !isAiThinking) {
      endSession();
    }
  }, [isPendingAutoEnd, isAiSpeaking, isAiThinking, endSession]);

  // ENSURE MICROPHONE DIES AND LOCK IS MANAGED
  useEffect(() => {
    const currentInterviewId = useInterviewStore.getState().interviewId;
    const currentClientId = useInterviewStore.getState().clientId;

    if (!currentInterviewId || !currentClientId) return;

    // 1. Start the 10-second heartbeat pulse
    const pulse = () => api.sendHeartbeat(currentInterviewId, currentClientId);
    pulse(); // Initial pulse
    const heartbeatInterval = setInterval(pulse, 10000);

    // 2. The Guaranteed Goodbye using keepalive (Bypasses CORS issues)
    const handleUnload = () => {
      api.releaseLock(currentInterviewId, currentClientId);
    };

    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      cancelSpeech();
      clearInterval(heartbeatInterval);
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);

      // Standard cleanup
      api.releaseLock(currentInterviewId, currentClientId);
      
      // FIX: Reset spoken index on unmount so Strict Mode remounts can replay the interrupted message
      lastSpokenIndex.current = -1;
    };
  }, [cancelSpeech]);

  // --- Timer Logic ---
  const [timeLeft, setTimeLeft] = useState(duration * 60);

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = duration * 60 - elapsedSeconds;

      if (remaining <= 0) {
        clearInterval(interval);
        setTimeLeft(0);
        cancelSpeech();
        endSession();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt, duration, cancelSpeech, endSession]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const currentQuestion =
    [...history].reverse().find((msg) => msg.role === "ai" || msg.role === "interviewer")?.content || "";

  useEffect(() => {
    const lastMessageIndex = history.length - 1;
    const lastMessage = history[lastMessageIndex];
    if (
      lastMessage &&
      (lastMessage.role === "ai" || lastMessage.role === "interviewer") &&
      lastMessageIndex > lastSpokenIndex.current
    ) {
      lastSpokenIndex.current = lastMessageIndex;
      speak(lastMessage.content, (lastMessage as any).messageId, (lastMessage as any).voice, (lastMessage as any).aiAudioBase64);
    }
  }, [history, speak]);

  const handleEnd = () => {
    cancelSpeech();
    endSession();
  };

  return (
    <div className={`w-full mx-auto transition-all duration-500 ease-in-out flex flex-col lg:flex-row gap-6 ${isCodingMode ? "max-w-[1600px] h-[85vh] min-h-[600px]" : "max-w-3xl h-[75vh] min-h-[550px]"}`}>
      
      {/* =========================================
          1. AI INTERVIEWER CONSOLE (SIDEBAR/MAIN)
          ========================================= */}
      <div className={`glass-panel rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all duration-500 ${isCodingMode ? "w-full lg:w-[380px] xl:w-[420px] shrink-0 h-full" : "w-full h-full"}`}>
        
        {/* HEADER: Normal Document Flow (Fixes Overlap) */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-black/20 shrink-0">
          <div className="flex items-center space-x-2 bg-zinc-900/80 px-3 py-1.5 rounded-full border border-zinc-700/50 shadow-sm">
            <div className={`w-2 h-2 rounded-full ${isAiThinking ? "bg-amber-400 animate-pulse" : "bg-emerald-500"}`}></div>
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest">
              {isAiThinking ? "Processing" : "Live"}
            </span>
          </div>

          <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border shadow-sm transition-colors ${timeLeft < 120 ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse" : "bg-zinc-900/80 border-zinc-700/50 text-zinc-300"}`}>
            <Clock className="w-3.5 h-3.5" />
            <span className="text-xs font-bold font-mono tracking-wider">{formatTime(timeLeft)}</span>
          </div>
        </div>

        {/* BODY: Scrollable Safe Area (Prevents Squishing) */}
        <div className="flex-1 flex flex-col items-center justify-between p-6 overflow-y-auto custom-scrollbar">
          
          {/* Module A: Visualizer Frame */}
          <div className="flex flex-col items-center justify-center w-full min-h-[160px] shrink-0 mb-8 mt-2">
            <div className={`relative transition-all duration-700 mb-6 ${isAiSpeaking ? "scale-110" : "scale-100"}`}>
              {isAiSpeaking && (
                <>
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping scale-[2.0] duration-1000"></div>
                  <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping scale-[1.5] duration-700 delay-150"></div>
                </>
              )}
              <div className={`relative z-10 w-20 h-20 md:w-22 md:h-22 rounded-full flex items-center justify-center border ${isAiSpeaking ? "bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.3)]" : "bg-zinc-900 border-zinc-800 text-zinc-600"}`}>
                {isAiThinking ? <Loader2 className="w-10 h-10 animate-spin" /> : <Volume2 className="w-8 h-8 md:w-10 md:h-10" />}
              </div>
            </div>
            
            {currentQuestion && !isAiThinking && (
              <div className="bg-zinc-900/30 border border-indigo-500/10 rounded-xl p-4 max-w-xl text-center shadow-sm animate-fade-in mb-3">
                <p className="text-zinc-300 text-sm font-medium leading-relaxed italic">"{currentQuestion}"</p>
              </div>
            )}
            
            <h2 className={`text-xs font-semibold tracking-widest uppercase ${isAiSpeaking ? "text-indigo-400" : isAiThinking ? "text-amber-400" : "text-zinc-500"}`}>
              {isAiThinking ? "Analyzing response..." : isAiSpeaking ? "Interviewer is speaking" : "System Streaming"}
            </h2>
          </div>

          {/* Module B: Premium Captions Module (Fixed Height) */}
          <div className="w-full bg-zinc-950/60 border border-white/5 rounded-xl p-4 h-[140px] shrink-0 flex flex-col mb-6 shadow-inner relative">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2 shrink-0">
              <div className="flex items-center space-x-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isListening && captionsEnabled ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`}></div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Live Captions</span>
              </div>
              
              <button 
                type="button"
                onClick={() => setCaptionsEnabled(!captionsEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${captionsEnabled ? 'bg-indigo-600' : 'bg-zinc-800'}`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${captionsEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <p className="text-sm font-medium leading-relaxed transition-all duration-300 text-zinc-200">
                {!captionsEnabled ? (
                  <span className="text-zinc-600 italic">Captions disabled. Use switch to enable.</span>
                ) : liveText ? (
                  liveText
                ) : isListening ? (
                  <span className="text-zinc-500 italic">Start speaking to stream transcription...</span>
                ) : (
                  <span className="text-zinc-500 italic">Awaiting AI turn complete...</span>
                )}
              </p>
              {/* Invisible element to anchor the auto-scroll */}
              <div ref={transcriptEndRef} className="h-1" />
            </div>
          </div>

          {/* Module C: Microphone State */}
          <div className={`w-full flex flex-col items-center transition-all duration-500 shrink-0 ${isListening ? "opacity-100" : "opacity-30"}`}>
            <div className={`p-3 rounded-full mb-1 ${isListening ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]" : "bg-zinc-800/50 text-zinc-500"}`}>
              {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </div>
            <p className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">
              {isListening ? "Mic Transcribing" : "Mic Muted"}
            </p>
          </div>

        </div>

        {/* FOOTER: Fixed Bottom Actions */}
        <div className="bg-zinc-950/80 p-4 flex gap-3 border-t border-white/5 shrink-0">
          <button
            onClick={toggleCodingMode}
            className="flex-1 px-4 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-xl font-medium transition-all active:scale-[0.98] flex items-center justify-center space-x-2 text-sm"
          >
            {isCodingMode ? <LayoutPanelLeft className="w-4 h-4 text-indigo-400" /> : <Code2 className="w-4 h-4 text-indigo-400" />}
            <span>{isCodingMode ? "Close Editor" : "Open Editor"}</span>
          </button>
          <button
            onClick={handleEnd}
            className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 rounded-xl font-medium transition-all active:scale-[0.98] flex items-center justify-center space-x-2 text-sm"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>End</span>
          </button>
        </div>
      </div>

      {/* =========================================
          2. CODE EDITOR (SIDE PANEL)
          ========================================= */}
      {isCodingMode && (
        <div className="flex-1 h-full min-h-[500px] animate-fade-in rounded-2xl overflow-hidden shadow-2xl border border-white/5">
          <CodeEditor />
        </div>
      )}
    </div>
  );
}

// ==========================================
// SCREEN 3: Report / Transcript Screen
// ==========================================
function ReportScreen() {
  const { history } = useInterviewStore();
  const evalIndex = history.findIndex(
    (msg) =>
      msg.role === "system" &&
      msg.content.includes("=== FINAL EVALUATION REPORT ==="),
  );
  const displayHistory = history.filter((_, index) => index !== evalIndex);

  return (
    <div className="glass-panel rounded-3xl p-10 max-w-4xl mx-auto w-full animate-fade-in shadow-2xl">
      <div className="flex justify-between items-end mb-10 pb-8 border-b border-white/10">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400"/>
            <h2 className="text-3xl font-bold text-zinc-100 tracking-tight">
              Assessment Complete
            </h2>
          </div>
          <p className="text-zinc-400 text-lg ml-11">
            Review your session transcript below. You may now close this tab.
          </p>
        </div>
      </div>
      
      <div className="flex flex-col h-[600px]">
        <div className="flex items-center space-x-3 mb-6">
          <MessageSquare className="w-5 h-5 text-zinc-500"/>
          <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
            Session Transcript
          </h3>
        </div>
        <div className="flex-1 bg-zinc-950/50 rounded-2xl border border-white/5 p-6 overflow-y-auto custom-scrollbar space-y-6">
          {displayHistory.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col ${msg.role === "candidate" ? "items-end" : "items-start"}`}
            >
              <span
                className={`text-[11px] font-bold mb-1.5 uppercase tracking-wider ${msg.role === "candidate" ? "text-indigo-400" : "text-zinc-500"}`}
              >
                {msg.role === "candidate" ? "You" : "AI Interviewer"}
              </span>
              <div
                className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-md ${msg.role === "candidate" ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-zinc-800/80 border border-white/5 text-zinc-200 rounded-tl-sm"}`}
              >
                <pre className="whitespace-pre-wrap font-sans">
                  {msg.content}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
