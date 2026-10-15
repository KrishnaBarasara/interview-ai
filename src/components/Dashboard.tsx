import React, { useState, useEffect } from "react";

interface ClockTimePickerProps {
  value: string; // "HH:MM" format (24h)
  onChange: (time: string) => void;
}

function ClockTimePicker({ value, onChange }: ClockTimePickerProps) {
  const [hours, minutes] = value.split(":").map(Number);
  const [activeMode, setActiveMode] = React.useState<"hours" | "minutes">(
    "hours",
  );
  const [isPm, setIsPm] = React.useState(hours >= 12);

  const displayHours = hours % 12 === 0 ? 12 : hours % 12;

  React.useEffect(() => {
    setIsPm(hours >= 12);
  }, [hours]);

  const handleSelectHour = (h: number) => {
    let newHour = h;
    if (isPm && h !== 12) newHour += 12;
    if (!isPm && h === 12) newHour = 0;

    const formattedHour = String(newHour).padStart(2, "0");
    const formattedMinute = String(minutes).padStart(2, "0");
    onChange(`${formattedHour}:${formattedMinute}`);
    setActiveMode("minutes"); // Automatically switch to minutes after selecting hour
  };

  const handleSelectMinute = (m: number) => {
    const finalHour = String(hours).padStart(2, "0");
    const formattedMinute = String(m).padStart(2, "0");
    onChange(`${finalHour}:${formattedMinute}`);
  };

  const toggleAmPm = (pm: boolean) => {
    setIsPm(pm);
    let newHour = hours % 12;
    if (pm && newHour !== 12) newHour += 12;
    if (!pm && newHour === 12) newHour = 0;
    onChange(
      `${String(newHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    );
  };

  return (
    <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-6 w-[280px] select-none mx-auto shadow-xl">
      {/* Time Display Header */}
      <div className="flex items-center justify-center space-x-2 mb-6 text-2xl font-bold tracking-tight">
        <button
          type="button"
          onClick={() => setActiveMode("hours")}
          className={`px-3 py-1.5 rounded-lg transition-all ${activeMode === "hours" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          {String(displayHours).padStart(2, "0")}
        </button>
        <span className="text-zinc-600 animate-pulse">:</span>
        <button
          type="button"
          onClick={() => setActiveMode("minutes")}
          className={`px-3 py-1.5 rounded-lg transition-all ${activeMode === "minutes" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          {String(minutes).padStart(2, "0")}
        </button>

        <div className="flex flex-col ml-3 bg-zinc-950 rounded-lg p-0.5 border border-white/5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => toggleAmPm(false)}
            className={`px-2 py-1 rounded ${!isPm ? "bg-zinc-800 text-indigo-400" : "text-zinc-500 hover:text-zinc-400"}`}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => toggleAmPm(true)}
            className={`px-2 py-1 rounded ${isPm ? "bg-zinc-800 text-indigo-400" : "text-zinc-500 hover:text-zinc-400"}`}
          >
            PM
          </button>
        </div>
      </div>

      {/* Interactive Clock Face Dial */}
      <div className="relative w-48 h-48 bg-zinc-950/60 rounded-full mx-auto border border-white/5 flex items-center justify-center">
        {/* Center Point */}
        <div className="absolute w-2 h-2 bg-indigo-500 rounded-full z-20" />

        {activeMode === "hours"
          ? // Hours Dial (1 to 12)
            [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h, i) => {
              const angle = (i * 30 * Math.PI) / 180;
              const x = Math.sin(angle) * 72;
              const y = -Math.cos(angle) * 72;
              const isSelected = displayHours === h;

              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => handleSelectHour(h)}
                  style={{ transform: `translate(${x}px, ${y}px)` }}
                  className={`absolute w-8 h-8 rounded-full text-xs font-bold transition-all flex items-center justify-center ${isSelected ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 font-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"}`}
                >
                  {h}
                </button>
              );
            })
          : // Minutes Dial (Steps of 5)
            [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m, i) => {
              const angle = (i * 30 * Math.PI) / 180;
              const x = Math.sin(angle) * 72;
              const y = -Math.cos(angle) * 72;
              const isSelected = Math.floor(minutes / 5) * 5 === m;

              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelectMinute(m)}
                  style={{ transform: `translate(${x}px, ${y}px)` }}
                  className={`absolute w-8 h-8 rounded-full text-xs font-bold transition-all flex items-center justify-center ${isSelected ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 font-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"}`}
                >
                  {String(m).padStart(2, "0")}
                </button>
              );
            })}
      </div>

      <p className="text-[10px] text-zinc-500 text-center mt-4 uppercase tracking-wider font-semibold">
        Selecting {activeMode}
      </p>
    </div>
  );
}
import {
  Users,
  Calendar,
  ArrowLeft,
  MessageSquare,
  Briefcase,
  ChevronRight,
  Plus,
  Link as LinkIcon,
  Copy,
  Check,
  Code2,
  Clock,
  AlertCircle,
  X,
  XCircle,
  Lock,
  Info,
  Trash2,
  Loader2,
  Volume2,
  Square
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../store/useAuthStore";

const AI_PERSONAS = [
  { id: "aura-2-amalthea-en", name: "Amalthea", gender: "Female", description: "Engaging, Natural, Cheerful", avatar: "https://static.deepgram.com/examples/avatars/amalthea.jpg" },
  { id: "aura-2-andromeda-en", name: "Andromeda", gender: "Female", description: "Casual, Expressive, Comfortable", avatar: "https://static.deepgram.com/examples/avatars/andromeda.jpg" },
  { id: "aura-2-apollo-en", name: "Apollo", gender: "Male", description: "Confident, Comfortable, Casual", avatar: "https://static.deepgram.com/examples/avatars/apollo.jpg" },
  { id: "aura-2-arcas-en", name: "Arcas", gender: "Male", description: "Natural, Smooth, Clear, Comfortable", avatar: "https://static.deepgram.com/examples/avatars/arcas.jpg" },
  { id: "aura-2-aries-en", name: "Aries", gender: "Male", description: "Warm, Energetic, Caring", avatar: "https://static.deepgram.com/examples/avatars/aries.jpg" },
  { id: "aura-2-asteria-en", name: "Asteria", gender: "Female", description: "Clear, Confident, Knowledgeable", avatar: "https://static.deepgram.com/examples/avatars/asteria.jpg" },
  { id: "aura-2-athena-en", name: "Athena", gender: "Female", description: "Calm, Smooth, Professional", avatar: "https://static.deepgram.com/examples/avatars/athena.jpg" },
  { id: "aura-2-atlas-en", name: "Atlas", gender: "Male", description: "Enthusiastic, Confident, Approachable", avatar: "https://static.deepgram.com/examples/avatars/atlas.jpg" },
  { id: "aura-2-aurora-en", name: "Aurora", gender: "Female", description: "Cheerful, Expressive, Energetic", avatar: "https://static.deepgram.com/examples/avatars/aurora.jpg" },
  { id: "aura-2-callista-en", name: "Callista", gender: "Female", description: "Smooth, Melodic, Caring", avatar: "https://static.deepgram.com/examples/avatars/callista.jpg" },
  { id: "aura-2-cordelia-en", name: "Cordelia", gender: "Female", description: "Approachable, Warm, Polite", avatar: "https://static.deepgram.com/examples/avatars/cordelia.jpg" },
  { id: "aura-2-delia-en", name: "Delia", gender: "Female", description: "Casual, Friendly, Cheerful, Breathy", avatar: "https://static.deepgram.com/examples/avatars/delia.jpg" },
  { id: "aura-2-draco-en", name: "Draco", gender: "Male", description: "Warm, Approachable, Trustworthy", avatar: "https://static.deepgram.com/examples/avatars/draco.jpg" },
  { id: "aura-2-electra-en", name: "Electra", gender: "Female", description: "Professional, Engaging, Knowledgeable", avatar: "https://static.deepgram.com/examples/avatars/electra.jpg" },
  { id: "aura-2-harmonia-en", name: "Harmonia", gender: "Female", description: "Empathetic, Clear, Calm, Confident", avatar: "https://static.deepgram.com/examples/avatars/harmonia.jpg" },
  { id: "aura-2-helena-en", name: "Helena", gender: "Female", description: "Caring, Natural, Positive, Friendly", avatar: "https://static.deepgram.com/examples/avatars/helena.jpg" },
  { id: "aura-2-hera-en", name: "Hera", gender: "Female", description: "Smooth, Warm, Professional", avatar: "https://static.deepgram.com/examples/avatars/hera.jpg" },
  { id: "aura-2-hermes-en", name: "Hermes", gender: "Male", description: "Expressive, Engaging, Professional", avatar: "https://static.deepgram.com/examples/avatars/hermes.jpg" },
  { id: "aura-2-hyperion-en", name: "Hyperion", gender: "Male", description: "Natural, Engaging, Melodic, Breathy", avatar: "https://static.deepgram.com/examples/avatars/hyperion.jpg" },
  { id: "aura-2-jupiter-en", name: "Jupiter", gender: "Male", description: "Expressive, Knowledgeable, Baritone", avatar: "https://static.deepgram.com/examples/avatars/jupiter.jpg" },
  { id: "aura-2-luna-en", name: "Luna", gender: "Female", description: "Friendly, Natural, Engaging", avatar: "https://static.deepgram.com/examples/avatars/luna.jpg" },
  { id: "aura-2-mars-en", name: "Mars", gender: "Male", description: "Smooth, Patient, Trustworthy", avatar: "https://static.deepgram.com/examples/avatars/mars.jpg" },
  { id: "aura-2-minerva-en", name: "Minerva", gender: "Female", description: "Positive, Friendly, Natural", avatar: "https://static.deepgram.com/examples/avatars/minerva.jpg" },
  { id: "aura-2-neptune-en", name: "Neptune", gender: "Male", description: "Professional, Patient, Polite", avatar: "https://static.deepgram.com/examples/avatars/neptune.jpg" },
  { id: "aura-2-odysseus-en", name: "Odysseus", gender: "Male", description: "Calm, Smooth, Comfortable", avatar: "https://static.deepgram.com/examples/avatars/odysseus.jpg" },
  { id: "aura-2-ophelia-en", name: "Ophelia", gender: "Female", description: "Expressive, Enthusiastic, Cheerful", avatar: "https://static.deepgram.com/examples/avatars/ophelia.jpg" },
  { id: "aura-2-orion-en", name: "Orion", gender: "Male", description: "Approachable, Comfortable, Calm", avatar: "https://static.deepgram.com/examples/avatars/orion.jpg" },
  { id: "aura-2-orpheus-en", name: "Orpheus", gender: "Male", description: "Professional, Clear, Confident, Trustworthy", avatar: "https://static.deepgram.com/examples/avatars/orpheus.jpg" },
  { id: "aura-2-pandora-en", name: "Pandora", gender: "Female", description: "Smooth, Calm, Melodic, Breathy", avatar: "https://static.deepgram.com/examples/avatars/pandora.jpg" },
  { id: "aura-2-phoebe-en", name: "Phoebe", gender: "Female", description: "Energetic, Warm, Casual", avatar: "https://static.deepgram.com/examples/avatars/phoebe.jpg" },
  { id: "aura-2-pluto-en", name: "Pluto", gender: "Male", description: "Smooth, Calm, Empathetic, Baritone", avatar: "https://static.deepgram.com/examples/avatars/pluto.jpg" },
  { id: "aura-2-saturn-en", name: "Saturn", gender: "Male", description: "Knowledgeable, Confident, Baritone", avatar: "https://static.deepgram.com/examples/avatars/saturn.jpg" },
  { id: "aura-2-selene-en", name: "Selene", gender: "Female", description: "Expressive, Engaging, Energetic", avatar: "https://static.deepgram.com/examples/avatars/selene.jpg" },
  { id: "aura-2-thalia-en", name: "Thalia", gender: "Female", description: "Clear, Confident, Energetic", avatar: "https://static.deepgram.com/examples/avatars/thalia.jpg" },
  { id: "aura-2-zeus-en", name: "Zeus", gender: "Male", description: "Deep, Trustworthy, Smooth", avatar: "https://static.deepgram.com/examples/avatars/zeus.jpg" }
];

export function Dashboard() {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // View & Modal State
  const [showInvitePage, setShowInvitePage] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isHiding, setIsHiding] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const playVoicePreview = (e: React.MouseEvent, persona: any) => {
    e.stopPropagation();
    if (playingVoice === persona.id && audioRef.current) {
      audioRef.current.pause();
      setPlayingVoice(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setPlayingVoice(persona.id);
    
    // Using Deepgram's free static samples to save API credits
    const audioUrl = `https://static.deepgram.com/examples/Aura-2-${persona.name.toLowerCase()}.wav`;
    const audio = new Audio(audioUrl);
    
    audio.play().catch(err => {
      console.error("Audio preview failed. Sample might not exist on CDN:", err);
      setPlayingVoice(null);
    });
    
    audio.onended = () => setPlayingVoice(null);
    audioRef.current = audio;
  };

  // Date calculation for min/max limits
  const today = new Date();
  const minDate = today.toISOString().split("T")[0];

  // Generate array of next 7 days for the custom picker
  const getNext7Days = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  };

  // Helper function to calculate the minimum time (Current time for testing)
  const getMinTime = (selectedDate: string) => {
    if (selectedDate === minDate) {
      const now = new Date();
      // 1 hour buffer removed for testing purposes
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
    return "00:00";
  };

  const [inviteForm, setInviteForm] = useState({
    candidate_name: "",
    candidate_email: "",
    position: "",
    interview_type: "Technical",
    technical_format: "Questions Only",
    difficulty: "Medium",
    duration: 15,
    date: minDate,
    time: getMinTime(minDate),
    expiration: "24",
    interviewer_voice: "aura-2-thalia-en",
  });

  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [timeError, setTimeError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const { user } = useAuthStore();

  const fetchInterviews = async () => {
    try {
      const { data, error } = await supabase
        .from("interviews")
        .select("*, interview_evaluations(overall_score)")
        .neq("is_hidden", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // ==========================================
      // THE ZOMBIE SWEEPER (ENHANCED & PATCHED)
      // ==========================================
      if (data && data.length > 0) {
        const now = Date.now();
        const incompleteIds: string[] = [];
        const partialIds: string[] = [];

        data.forEach((interview) => {
          if (
            interview.status === "active" ||
            interview.status === "incomplete"
          ) {
            const lastHb = interview.engine_state?.last_heartbeat;

            if (!lastHb) {
              if (interview.status === "active")
                incompleteIds.push(interview.id);
            } else {
              const lastHbTime = new Date(lastHb).getTime();
              const diff = now - lastHbTime;

              // If disconnected for > 15 mins (900000 ms), mark partially_completed
              if (diff > 900000 && interview.status !== "partially_completed") {
                partialIds.push(interview.id);
              }
              // If disconnected for > 90 secs (increased for browser throttling), mark incomplete
              else if (
                diff > 90000 &&
                diff <= 900000 &&
                interview.status === "active"
              ) {
                incompleteIds.push(interview.id);
              }
            }
          }
        });

        if (incompleteIds.length > 0 || partialIds.length > 0) {
          if (incompleteIds.length > 0) {
            await supabase
              .from("interviews")
              .update({ status: "incomplete" })
              .in("id", incompleteIds);
          }
          if (partialIds.length > 0) {
            await supabase
              .from("interviews")
              .update({ status: "partially_completed" })
              .in("id", partialIds);
          }

          const { data: cleanData, error: cleanError } = await supabase
            .from("interviews")
            .select("*, interview_evaluations(overall_score)")
            .neq("is_hidden", true)
            .order("created_at", { ascending: false });

          if (!cleanError && cleanData) {
            setInterviews(cleanData);
            return;
          }
        }
      }

      // CRITICAL FIX: Ensure state updates if no zombies were found
      setInterviews(data || []);
      // ==========================================
    } catch (error) {
      console.error("Error fetching interviews:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchInterviews();

    // Auto-poll every 15 seconds to run the Zombie Sweeper and keep the UI perfectly synced
    const intervalId = setInterval(() => {
      fetchInterviews();
    }, 15000);

    return () => clearInterval(intervalId);
  }, []);

  const loadDetails = async (id: string) => {
    setLoading(true);
    setSelectedId(id);
    setShowInvitePage(false);
    try {
      const { data: interviewData } = await supabase
        .from("interviews")
        .select("*")
        .eq("id", id)
        .single();
      const { data: messagesData } = await supabase
        .from("interview_messages")
        .select("*")
        .eq("interview_id", id)
        .order("timestamp", { ascending: true });
      const { data: evalData } = await supabase
        .from("interview_evaluations")
        .select("*")
        .eq("interview_id", id)
        .single();
      const { data: codeData } = await supabase
        .from("coding_submissions")
        .select("*")
        .eq("interview_id", id)
        .order("created_at", { ascending: false });

      setDetails({
        interview: interviewData,
        transcripts: messagesData || [],
        evalData: evalData || null,
        codeSubmissions: codeData || [],
      });
    } catch (err) {
      console.error("Failed to load details:", err);
    }
    setLoading(false);
  };

  const closeDetails = () => {
    setSelectedId(null);
    setDetails(null);
  };

  const handleDateChange = (newDate: string) => {
    const minRequiredTime = getMinTime(newDate);

    // Auto-adjust time if the newly selected date makes the current time invalid
    let newTime = inviteForm.time;
    if (newDate === minDate && inviteForm.time < minRequiredTime) {
      newTime = minRequiredTime;
      setTimeError(`Time automatically adjusted to current time.`);
    } else {
      setTimeError("");
    }

    setInviteForm({ ...inviteForm, date: newDate, time: newTime });
  };

  const handleClockTimeChange = (newTime: string) => {
    const minRequiredTime = getMinTime(inviteForm.date);

    if (inviteForm.date === minDate && newTime < minRequiredTime) {
      setTimeError(`For today, time must be after ${minRequiredTime}`);
    } else {
      setTimeError("");
    }
    setInviteForm({ ...inviteForm, time: newTime });
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert("You must be logged in");

    // Final validation check: Silent Auto-Bump
    // If the time slipped into the past while filling the form, silently bump it to 'now'
    let finalTime = inviteForm.time;
    const currentMinTime = getMinTime(minDate);

    if (inviteForm.date === minDate && finalTime < currentMinTime) {
      finalTime = currentMinTime;
      // Update form state silently so the UI reflects the corrected time
      setInviteForm((prev) => ({ ...prev, time: finalTime }));
      setTimeError(""); // Clear any ghost errors
    }

    setIsCreating(true);
    try {
      // Use the corrected finalTime instead of inviteForm.time
      const scheduledAtDate = new Date(`${inviteForm.date}T${finalTime}`);
      const scheduledAt = scheduledAtDate.toISOString();

      // Calculate a beautiful local time string with the Timezone appended (e.g., "May 27, 2026, 12:55 PM (Asia/Kolkata)")
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const displayTime = `${scheduledAtDate.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} (${userTimezone})`;

      // Calculate Expiration
      const expiresAtDate = new Date(scheduledAtDate);
      expiresAtDate.setHours(
        expiresAtDate.getHours() + parseInt(inviteForm.expiration),
      );
      const expiresAt = expiresAtDate.toISOString();

      const newOtp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate 6-digit PIN

      const interviewPayload = {
        created_by: user.id,
        candidate_name: inviteForm.candidate_name,
        candidate_email: inviteForm.candidate_email,
        position: inviteForm.position || "Software Engineer",
        interview_type: inviteForm.interview_type,
        technical_format:
          inviteForm.interview_type === "Technical"
            ? inviteForm.technical_format
            : null,
        difficulty: inviteForm.difficulty,
        duration: Number(inviteForm.duration),
        scheduled_at: scheduledAt,
        expires_at: expiresAt,
        status: "pending",
        otp: newOtp,
        engine_state: { interviewer_voice: inviteForm.interviewer_voice },
      };

      // Get the current Supabase session token to securely authenticate the backend request
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token)
        throw new Error("Authentication token missing. Please sign in again.");

      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/interviews/create`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            interviewData: interviewPayload,
            origin: window.location.origin,
            displayTime: displayTime,
          }),
        },
      );

      // Handle non-JSON or error responses gracefully before parsing JSON
      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        let errorMessage = "Failed to create interview";
        try {
          const parsedError = JSON.parse(errorText);
          errorMessage = parsedError.error || errorMessage;
        } catch (e) {
          errorMessage = `Backend Error (Status ${res.status}): ${errorText || "No response text available."}`;
        }
        throw new Error(errorMessage);
      }

      const responseData = await res.json();

      const link = `${window.location.origin}?id=${responseData.interview.id}`;
      setGeneratedLink(link);
      setGeneratedOtp(newOtp);
      fetchInterviews();

      if (!responseData.emailSent) {
        alert(
          "The interview was created, but the email failed to send. Check backend logs.",
        );
      }
    } catch (err: any) {
      alert("Error generating link: " + err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyExistingLink = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const link = `${window.location.origin}?id=${id}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCancelInterview = async (id: string) => {
    if (
      !confirm(
        "Are you sure you want to cancel this interview? This action cannot be undone.",
      )
    )
      return;
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from("interviews")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw error;

      // Update local state to reflect cancellation immediately
      if (details && details.interview.id === id) {
        setDetails({
          ...details,
          interview: { ...details.interview, status: "cancelled" },
        });
      }
      fetchInterviews();
    } catch (err: any) {
      alert("Failed to cancel interview: " + err.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const confirmHideInterview = async () => {
    if (!deleteConfirmId) return;
    setIsHiding(true);
    try {
      const { error } = await supabase
        .from("interviews")
        .update({ is_hidden: true })
        .eq("id", deleteConfirmId);

      if (error) throw error;
      fetchInterviews();
      setDeleteConfirmId(null);
    } catch (err: any) {
      alert("Failed to remove interview: " + err.message);
    } finally {
      setIsHiding(false);
    }
  };

  const resetInvitePage = () => {
    setShowInvitePage(false);
    setShowTimeModal(false);
    setGeneratedLink(null);
    setGeneratedOtp(null);
    setInviteForm({
      candidate_name: "",
      candidate_email: "",
      position: "",
      interview_type: "Technical",
      technical_format: "Questions Only",
      difficulty: "Medium",
      duration: 15,
      date: minDate,
      time: getMinTime(minDate),
      expiration: "24",
      interviewer_voice: "aura-2-thalia-en",
    });
    setTimeError("");
  };

  if (loading && !interviews.length && !selectedId) {
    return (
      <div className="text-zinc-400 p-8 text-center animate-pulse">
        Loading dashboard data...
      </div>
    );
  }

  // --- 1. DEDICATED INVITE PAGE VIEW ---
  if (showInvitePage) {
    return (
      <div className="max-w-4xl mx-auto animate-fade-in w-full pb-12 relative">
        <button
          onClick={resetInvitePage}
          className="flex items-center space-x-2 text-zinc-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> <span>Back to Leaderboard</span>
        </button>

        <div className="glass-panel p-10 rounded-2xl border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center">
              <LinkIcon className="w-7 h-7 mr-3 text-indigo-400" />
              Schedule New Interview
            </h2>
            <p className="text-zinc-400 mb-10">
              Configure the assessment parameters and generate a secure
              invitation link for your candidate.
            </p>

            {!generatedLink ? (
              <form onSubmit={handleCreateInvite} className="space-y-8">
                {/* Candidate Info Section */}
                <div className="space-y-5">
                  <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest border-b border-white/5 pb-2">
                    Candidate Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                        Candidate Name
                      </label>
                      <input
                        required
                        type="text"
                        value={inviteForm.candidate_name}
                        onChange={(e) =>
                          setInviteForm({
                            ...inviteForm,
                            candidate_name: e.target.value,
                          })
                        }
                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 outline-none focus:border-indigo-500 transition-colors"
                        placeholder="e.g. Jane Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                        Candidate Email
                      </label>
                      <input
                        required
                        type="email"
                        value={inviteForm.candidate_email}
                        onChange={(e) =>
                          setInviteForm({
                            ...inviteForm,
                            candidate_email: e.target.value,
                          })
                        }
                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 outline-none focus:border-indigo-500 transition-colors"
                        placeholder="jane@example.com"
                      />
                    </div>
                  </div>
                </div>

                {/* Role Info Section */}
                <div className="space-y-5">
                  <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest border-b border-white/5 pb-2">
                    Interview Details
                  </h3>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                      Job Title / Role
                    </label>
                    <input
                      required
                      type="text"
                      list="job-roles"
                      value={inviteForm.position}
                      onChange={(e) =>
                        setInviteForm({
                          ...inviteForm,
                          position: e.target.value,
                        })
                      }
                      className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 outline-none focus:border-indigo-500 transition-colors"
                      placeholder="e.g. Senior React Developer"
                    />
                    <datalist id="job-roles">
                      <option value="Software Engineer" />
                      <option value="Senior Software Engineer" />
                      <option value="Staff Software Engineer" />
                      <option value="Principal Engineer" />
                      <option value="Tech Lead" />
                      <option value="Engineering Manager" />

                      <option value="Frontend Engineer" />
                      <option value="React Developer" />
                      <option value="Angular Developer" />
                      <option value="Vue.js Developer" />
                      <option value="Next.js Developer" />
                      <option value="Svelte Developer" />
                      <option value="UI Engineer" />
                      <option value="Web Developer" />
                      <option value="HTML/CSS Developer" />

                      <option value="Backend Engineer" />
                      <option value="Node.js Developer" />
                      <option value="Python Developer" />
                      <option value="Java Developer" />
                      <option value="Golang Developer" />
                      <option value="Rust Developer" />
                      <option value="C++ Engineer" />
                      <option value="C# / .NET Developer" />
                      <option value="PHP Developer" />
                      <option value="Laravel Developer" />
                      <option value="Ruby on Rails Developer" />
                      <option value="Django Developer" />

                      <option value="Full Stack Engineer" />
                      <option value="MERN Stack Developer" />
                      <option value="MEAN Stack Developer" />
                      <option value="LAMP Stack Developer" />

                      <option value="Mobile Developer" />
                      <option value="iOS Developer" />
                      <option value="Android Developer" />
                      <option value="React Native Developer" />
                      <option value="Flutter Developer" />
                      <option value="Swift Developer" />
                      <option value="Kotlin Developer" />

                      <option value="Data Scientist" />
                      <option value="Data Engineer" />
                      <option value="Machine Learning Engineer" />
                      <option value="AI Engineer" />
                      <option value="Data Analyst" />
                      <option value="Big Data Engineer" />
                      <option value="Database Administrator (DBA)" />
                      <option value="NLP Engineer" />
                      <option value="Computer Vision Engineer" />

                      <option value="DevOps Engineer" />
                      <option value="Site Reliability Engineer (SRE)" />
                      <option value="Cloud Architect" />
                      <option value="AWS Solutions Architect" />
                      <option value="Azure Cloud Engineer" />
                      <option value="GCP Cloud Engineer" />
                      <option value="Kubernetes Administrator" />
                      <option value="Platform Engineer" />

                      <option value="QA Engineer" />
                      <option value="SDET (Software Development Engineer in Test)" />
                      <option value="QA Automation Engineer" />
                      <option value="Manual Tester" />
                      <option value="Performance Test Engineer" />

                      <option value="Cybersecurity Analyst" />
                      <option value="Security Engineer" />
                      <option value="Penetration Tester" />
                      <option value="DevSecOps Engineer" />

                      <option value="Product Manager" />
                      <option value="Project Manager" />
                      <option value="Scrum Master" />
                      <option value="Agile Coach" />
                      <option value="Business Analyst" />

                      {/* Design */}
                      <option value="UI/UX Designer" />
                      <option value="Product Designer" />
                      <option value="UX Researcher" />

                      <option value="Blockchain Developer" />
                      <option value="Smart Contract Engineer" />
                      <option value="Game Developer (Unity/Unreal)" />
                      <option value="Embedded Systems Engineer" />
                      <option value="Salesforce Developer" />
                      <option value="SAP Consultant" />
                      <option value="WordPress Developer" />
                      <option value="Shopify Developer" />
                    </datalist>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                        Interview Type
                      </label>
                      <select
                        value={inviteForm.interview_type}
                        onChange={(e) =>
                          setInviteForm({
                            ...inviteForm,
                            interview_type: e.target.value,
                          })
                        }
                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                      >
                        <option value="Technical">Technical</option>
                        <option value="Behavioral">Behavioral</option>
                        <option value="HR Screen">HR Screen</option>
                      </select>
                    </div>

                    {inviteForm.interview_type === "Technical" && (
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                          Technical Format
                        </label>
                        <select
                          value={inviteForm.technical_format}
                          onChange={(e) =>
                            setInviteForm({
                              ...inviteForm,
                              technical_format: e.target.value,
                            })
                          }
                          className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                        >
                          <option value="Mix">Mix (Questions + Coding)</option>
                          <option value="Questions Only">Questions Only</option>
                          <option value="Coding Round Only">
                            Coding Round Only (No Questions)
                          </option>
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                        Difficulty Level
                      </label>
                      <select
                        value={inviteForm.difficulty}
                        onChange={(e) =>
                          setInviteForm({
                            ...inviteForm,
                            difficulty: e.target.value,
                          })
                        }
                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                      >
                        <option value="Junior">Junior</option>
                        <option value="Medium">Medium</option>
                        <option value="Senior">Senior</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* AI Persona Section */}
                <div className="space-y-5">
                  <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest border-b border-white/5 pb-2">
                    AI Interviewer Persona
                  </h3>
                  {(() => {
                    const selected = AI_PERSONAS.find(p => p.id === inviteForm.interviewer_voice) || AI_PERSONAS.find(p => p.id === "aura-2-thalia-en")!;
                    return (
                      <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl p-5 flex items-center justify-between shadow-inner">
                        <div className="flex items-center space-x-4">
                          <img src={selected.avatar} alt={selected.name} className="w-14 h-14 rounded-full border border-zinc-700 object-cover" />
                          <div>
                            <h4 className="text-white font-bold text-base flex items-center">
                              {selected.name} 
                              <span className="ml-2 px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] uppercase tracking-wider rounded border border-indigo-500/20">{selected.gender}</span>
                            </h4>
                            <p className="text-xs text-zinc-400 mt-1">{selected.description}</p>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={() => setShowVoiceModal(true)}
                          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors border border-white/5"
                        >
                          Change Voice
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* Schedule Section via Modal Trigger */}
                <div className="space-y-5">
                  <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest border-b border-white/5 pb-2">
                    Schedule & Expiration
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                        Duration
                      </label>
                      <select
                        value={inviteForm.duration}
                        onChange={(e) =>
                          setInviteForm({
                            ...inviteForm,
                            duration: Number(e.target.value),
                          })
                        }
                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                      >
                        <option value={15}>15 Minutes</option>
                        <option value={30}>30 Minutes</option>
                        <option value={45}>45 Minutes</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                        Valid For
                      </label>
                      <select
                        value={inviteForm.expiration}
                        onChange={(e) =>
                          setInviteForm({
                            ...inviteForm,
                            expiration: e.target.value,
                          })
                        }
                        className="w-full bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-200 outline-none focus:border-indigo-500 transition-colors appearance-none cursor-pointer"
                      >
                        <option value="1">1 Hour</option>
                        <option value="24">24 Hours</option>
                        <option value="48">48 Hours</option>
                        <option value="72">72 Hours</option>
                        <option value="168">1 Week</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
                        Start Time
                      </label>
                      <div className="flex items-center justify-between bg-zinc-950/50 border border-zinc-800 rounded-xl px-4 py-2.5 h-[50px]">
                        <div className="flex items-center space-x-3 text-zinc-300">
                          <Clock className="w-4 h-4 text-indigo-400" />
                          <span className="font-medium text-sm">
                            {new Date(
                              `${inviteForm.date}T${inviteForm.time}`,
                            ).toLocaleString([], {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowTimeModal(true)}
                          className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-lg transition-colors border border-white/5"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-4 pt-6 border-t border-white/5">
                  <button
                    type="button"
                    onClick={resetInvitePage}
                    className="px-6 py-3 text-zinc-400 hover:text-white transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || !!timeError}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] disabled:opacity-50 flex items-center"
                  >
                    {isCreating
                      ? "Generating Secure Link..."
                      : "Generate Invite Link"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-8 animate-fade-in py-12">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center max-w-2xl mx-auto">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    Interview Scheduled Successfully
                  </h3>
                  <p className="text-emerald-400/80 mb-8">
                    Share this unique link and Access PIN with the candidate.
                  </p>

                  <div className="flex flex-col space-y-4 mb-2">
                    <div className="flex items-center space-x-3 bg-zinc-950/80 border border-zinc-800 rounded-xl p-3 shadow-inner">
                      <input
                        readOnly
                        value={generatedLink}
                        className="flex-1 bg-transparent text-zinc-300 text-sm outline-none px-3 font-mono"
                      />
                      <button
                        onClick={copyToClipboard}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white font-medium transition-colors flex items-center space-x-2"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />{" "}
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" /> <span>Copy Link</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-center space-x-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 shadow-inner">
                      <Lock className="w-5 h-5 text-amber-400" />
                      <span className="text-amber-400/80 font-medium">
                        Access PIN:
                      </span>
                      <span className="text-2xl font-black text-amber-400 font-mono tracking-widest ml-2">
                        {generatedOtp}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={resetInvitePage}
                    className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-colors"
                  >
                    Return to Dashboard
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TIME PICKER MODAL */}
        {showTimeModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 relative overflow-hidden">
              <div className="flex justify-between items-center p-5 border-b border-white/5">
                <h3 className="font-bold text-white flex items-center">
                  <Calendar className="w-4 h-4 mr-2 text-indigo-400" /> Pick
                  Date & Time
                </h3>
                <button
                  type="button"
                  onClick={() => setShowTimeModal(false)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-6">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
                    Select Date
                  </label>
                  <div className="flex space-x-2 overflow-x-auto custom-scrollbar pb-2">
                    {getNext7Days().map((d) => {
                      const dateStr = d.toISOString().split("T")[0];
                      const isSelected = inviteForm.date === dateStr;
                      const dayName = d.toLocaleDateString("en-US", {
                        weekday: "short",
                      });
                      const dayNum = d.getDate();
                      return (
                        <button
                          key={dateStr}
                          type="button"
                          onClick={() => handleDateChange(dateStr)}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl min-w-[72px] transition-all border ${isSelected ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-indigo-500/50 hover:bg-zinc-800"}`}
                        >
                          <span className="text-[10px] uppercase font-bold tracking-wider mb-1 opacity-80">
                            {dayName}
                          </span>
                          <span className="text-xl font-black">{dayNum}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2 flex justify-between">
                    <span>Time</span>
                    {inviteForm.date === minDate && (
                      <span className="text-zinc-500 lowercase">
                        (current time or later)
                      </span>
                    )}
                  </label>
                  <ClockTimePicker
                    value={inviteForm.time}
                    onChange={handleClockTimeChange}
                  />
                  {timeError && (
                    <p className="text-amber-400 text-[11px] mt-1.5 flex items-start">
                      <AlertCircle className="w-3 h-3 mr-1 shrink-0 mt-0.5" />{" "}
                      {timeError}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-5 border-t border-white/5 bg-white/5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowTimeModal(false)}
                  disabled={!!timeError}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
                >
                  Confirm Schedule
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VOICE SELECTOR MODAL */}
        {showVoiceModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
            <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-5xl shadow-2xl relative flex flex-col max-h-[85vh]">
              <div className="flex justify-between items-center p-6 border-b border-white/5 shrink-0">
                <h3 className="font-bold text-white text-xl flex items-center">
                  Select AI Persona
                </h3>
                <button 
                  type="button" 
                  onClick={() => { 
                    setShowVoiceModal(false); 
                    if (audioRef.current) audioRef.current.pause(); 
                    setPlayingVoice(null); 
                  }} 
                  className="text-zinc-500 hover:text-white transition-colors p-1"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {AI_PERSONAS.map((persona) => (
                    <div
                      key={persona.id}
                      onClick={() => {
                        setInviteForm({ ...inviteForm, interviewer_voice: persona.id });
                        setShowVoiceModal(false);
                        if (audioRef.current) audioRef.current.pause();
                        setPlayingVoice(null);
                      }}
                      className={`cursor-pointer rounded-xl border p-4 transition-all flex flex-col items-center text-center relative group ${
                        inviteForm.interviewer_voice === persona.id
                          ? "bg-indigo-600/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                          : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800"
                      }`}
                    >
                      <button 
                        type="button"
                        onClick={(e) => playVoicePreview(e, persona)}
                        className={`absolute top-3 right-3 p-2 rounded-full transition-all ${
                          playingVoice === persona.id 
                            ? 'bg-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.5)] animate-pulse' 
                            : 'bg-zinc-950 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 opacity-50 group-hover:opacity-100'
                        }`}
                        title="Listen to preview"
                      >
                        {playingVoice === persona.id ? <Square className="w-3 h-3 fill-current" /> : <Volume2 className="w-3 h-3" />}
                      </button>

                      <img src={persona.avatar} alt={persona.name} className="w-16 h-16 rounded-full mb-3 bg-zinc-800 object-cover" />
                      <h4 className="text-white font-bold text-sm mb-1">{persona.name}</h4>
                      <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-semibold mb-2">{persona.gender}</span>
                      <p className="text-xs text-zinc-400 leading-relaxed">{persona.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- 2. DETAIL VIEW ---
  if (selectedId && details) {
    const { interview, transcripts, evalData, codeSubmissions } = details;
    return (
      <div className="max-w-6xl mx-auto animate-fade-in w-full pb-12">
        <button
          onClick={closeDetails}
          className="flex items-center space-x-2 text-zinc-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> <span>Back to Leaderboard</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/10">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white mb-1">
                  {interview.candidate_name || "Anonymous Candidate"}
                </h2>
                <a
                  href={`mailto:${interview.candidate_email}`}
                  className="text-indigo-400 hover:text-indigo-300 text-sm mb-4 inline-block"
                >
                  {interview.candidate_email}
                </a>

                <div className="flex flex-wrap gap-2 mb-2 mt-2">
                  {(() => {
                    const isExpired =
                      interview.status === "pending" &&
                      interview.expires_at &&
                      new Date() > new Date(interview.expires_at);
                    const displayStatus = isExpired
                      ? "expired"
                      : interview.status;
                    return (
                      <span
                        className={`px-2 py-1 text-xs rounded-md border font-bold tracking-wider uppercase ${
                          displayStatus === "completed"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : displayStatus === "active"
                              ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              : displayStatus === "cancelled"
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : displayStatus === "expired"
                                  ? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}
                      >
                        {displayStatus}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div className="space-y-3 mb-6 bg-zinc-950/50 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">Job Role</span>
                  <span className="text-zinc-200 font-medium flex items-center">
                    <Briefcase className="w-3 h-3 mr-1.5 opacity-70" />{" "}
                    {interview.position}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">Interview Type</span>
                  <span className="text-zinc-200 font-medium">
                    {interview.interview_type} ({interview.difficulty})
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-zinc-500">Scheduled Time</span>
                  <span className="text-zinc-200 font-medium">
                    {interview.scheduled_at
                      ? new Date(interview.scheduled_at).toLocaleString([], {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "N/A"}
                  </span>
                </div>
                {interview.expires_at && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-zinc-500">Link Expires</span>
                    <span className="text-zinc-200 font-medium">
                      {new Date(interview.expires_at).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                )}
                {["pending", "active", "incomplete"].includes(
                  interview.status,
                ) &&
                  (!interview.expires_at ||
                    new Date() <= new Date(interview.expires_at)) &&
                  interview.otp && (
                    <div className="flex justify-between items-center text-sm pt-2 mt-2 border-t border-white/5">
                      <span className="text-zinc-500">
                        Candidate Access PIN
                      </span>
                      <span className="text-amber-400 font-mono font-bold tracking-widest text-base">
                        {interview.otp}
                      </span>
                    </div>
                  )}
              </div>

              {["pending", "active", "incomplete"].includes(interview.status) &&
                (!interview.expires_at ||
                  new Date() <= new Date(interview.expires_at)) && (
                  <div className="flex flex-col gap-3 mb-8 p-4 bg-zinc-950/50 rounded-xl border border-white/5">
                    <button
                      onClick={(e) => copyExistingLink(e, interview.id)}
                      className="flex items-center justify-center space-x-2 w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors text-sm font-medium"
                    >
                      {copiedId === interview.id ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span>Link Copied!</span>
                        </>
                      ) : (
                        <>
                          <LinkIcon className="w-4 h-4" />
                          <span>Copy Invite Link</span>
                        </>
                      )}
                    </button>

                    {(() => {
                      const timeUntilStart =
                        new Date(interview.scheduled_at).getTime() - Date.now();
                      const isCancelable = timeUntilStart > 15 * 60 * 1000; // strictly greater than 15 mins

                      return isCancelable ? (
                        <button
                          onClick={() => handleCancelInterview(interview.id)}
                          disabled={isCancelling}
                          className="flex items-center justify-center space-x-2 w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-sm font-medium border border-red-500/20 disabled:opacity-50"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>
                            {isCancelling
                              ? "Cancelling..."
                              : "Cancel Interview"}
                          </span>
                        </button>
                      ) : (
                        <div className="text-center text-xs text-zinc-500 italic mt-1">
                          Cancellation locked (under 15 mins to start).
                        </div>
                      );
                    })()}
                  </div>
                )}

              {evalData ? (
                <div className="space-y-6">
                  <div className="text-center p-4 bg-zinc-950/50 rounded-xl border border-indigo-500/20">
                    <div className="text-4xl font-black text-white mb-1">
                      {evalData.overall_score}
                      <span className="text-lg text-zinc-500">/10</span>
                    </div>
                    <div className="text-xs text-zinc-400 uppercase tracking-widest">
                      Overall Score
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-3">
                      Skill Breakdown
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-300">Communication</span>
                        <span className="font-mono text-indigo-400 font-bold">
                          {evalData.communication_score}/10
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-300">Technical</span>
                        <span className="font-mono text-indigo-400 font-bold">
                          {evalData.technical_score}/10
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-300">Problem Solving</span>
                        <span className="font-mono text-indigo-400 font-bold">
                          {evalData.coding_score}/10
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-500/80 uppercase tracking-wider mb-2 mt-4">
                      Top Strengths
                    </h3>
                    <ul className="space-y-2">
                      {evalData.strengths?.map((s: string, i: number) => (
                        <li
                          key={i}
                          className="text-sm text-zinc-300 flex items-start"
                        >
                          <span className="text-emerald-500 mr-2">✦</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-red-400/80 uppercase tracking-wider mb-2">
                      Areas to Improve
                    </h3>
                    <ul className="space-y-2">
                      {evalData.weaknesses?.map((w: string, i: number) => (
                        <li
                          key={i}
                          className="text-sm text-zinc-300 flex items-start"
                        >
                          <span className="text-red-400 mr-2">✦</span>
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-zinc-500 italic text-sm p-4 bg-zinc-900/50 rounded-xl border border-white/5">
                  No evaluation generated yet.
                </div>
              )}

              {codeSubmissions && codeSubmissions.length > 0 && (
                <div className="mt-8 border-t border-white/10 pt-6">
                  <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center">
                    <Code2 className="w-4 h-4 mr-2" /> Code Submitted
                  </h3>
                  <div className="space-y-4">
                    {codeSubmissions.map((sub: any, i: number) => (
                      <div
                        key={i}
                        className="bg-zinc-950 rounded-xl border border-white/5 overflow-hidden shadow-inner"
                      >
                        <div className="flex justify-between items-center px-4 py-2 bg-zinc-900/50 border-b border-white/5">
                          <span className="text-xs text-indigo-400 font-mono font-medium">
                            {sub.language}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {new Date(sub.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="p-4 overflow-x-auto custom-scrollbar">
                          <pre className="text-[13px] leading-relaxed font-mono text-zinc-300">
                            {sub.code}
                          </pre>
                        </div>
                        {sub.output && (
                          <div className="px-4 py-3 bg-black/60 border-t border-white/5">
                            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
                              Execution Output:
                            </span>
                            <pre className="text-xs font-mono text-zinc-400">
                              {sub.output}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/10 h-[800px] flex flex-col">
            <div className="flex items-center space-x-2 mb-6 border-b border-white/5 pb-4">
              <MessageSquare className="w-5 h-5 text-zinc-400" />
              <h3 className="font-semibold text-zinc-200">
                Conversation History
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-4">
              {transcripts
                ?.filter((m: any) => m.speaker !== "system")
                .map((msg: any, index: number) => (
                  <div
                    key={index}
                    className={`flex flex-col ${msg.speaker === "candidate" ? "items-end" : "items-start"}`}
                  >
                    <span
                      className={`text-[11px] font-bold mb-1.5 uppercase tracking-wider ${msg.speaker === "candidate" ? "text-indigo-400" : "text-zinc-500"}`}
                    >
                      {msg.speaker === "candidate"
                        ? "Candidate"
                        : "AI Interviewer"}
                    </span>
                    <div
                      className={`p-4 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-md ${
                        msg.speaker === "candidate"
                          ? "bg-indigo-600 text-white rounded-tr-sm"
                          : "bg-zinc-800/80 border border-white/5 text-zinc-200 rounded-tl-sm"
                      }`}
                    >
                      <pre className="whitespace-pre-wrap font-sans">
                        {msg.cleaned_transcript || msg.raw_transcript}
                      </pre>
                      {msg.audio_url && msg.speaker === "candidate" && (
                        <audio
                          controls
                          src={msg.audio_url}
                          className="h-8 w-full mt-3 rounded-md opacity-90 filter invert sepia hue-rotate-180"
                        />
                      )}
                    </div>
                  </div>
                ))}

              {(!transcripts || transcripts.length === 0) && (
                <div className="h-full flex items-center justify-center text-zinc-500 italic">
                  No conversation recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN LIST VIEW ---
  return (
    <div className="max-w-6xl mx-auto w-full animate-fade-in pb-12 relative">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
            <Users className="w-8 h-8 mr-3 text-indigo-400" /> Candidate Tracker
          </h1>
          <p className="text-zinc-400">
            Manage your interview invitations and review candidate results.
          </p>
        </div>
        <button
          onClick={() => {
            setShowInvitePage(true);
            setGeneratedLink(null);
            setInviteForm({
              ...inviteForm,
              candidate_name: "",
              candidate_email: "",
              position: "",
              interview_type: "Technical",
              technical_format: "Questions Only",
              difficulty: "Medium",
              date: minDate,
              time: getMinTime(minDate),
            });
            setTimeError("");
          }}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" /> <span>Schedule Interview</span>
        </button>
      </div>

      <div className="glass-panel rounded-2xl border border-white/10 relative">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/5 [&>th:first-child]:rounded-tl-2xl [&>th:last-child]:rounded-tr-2xl">
              <th className="p-5 text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                Candidate
              </th>
              <th className="p-5 text-sm font-semibold text-zinc-400 uppercase tracking-wider relative group cursor-help">
                <div className="flex items-center space-x-1.5">
                  <span>Status</span>
                  <Info className="w-3.5 h-3.5 opacity-60 hover:opacity-100 transition-opacity" />

                  {/* Tooltip Legend */}
                  <div className="absolute left-0 top-full mt-2 w-64 bg-zinc-900 border border-white/10 rounded-xl p-4 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <h4 className="text-white text-xs font-bold mb-3 uppercase tracking-wider">
                      Status Guide
                    </h4>
                    <ul className="space-y-2 text-xs text-zinc-400 normal-case">
                      <li>
                        <strong className="text-blue-400 font-semibold">
                          Active:
                        </strong>{" "}
                        Candidate is online.
                      </li>
                      <li>
                        <strong className="text-orange-400 font-semibold">
                          Incomplete:
                        </strong>{" "}
                        Candidate disconnected. (5-min rejoin window).
                      </li>
                      <li>
                        <strong className="text-indigo-400 font-semibold">
                          Partially Completed:
                        </strong>{" "}
                        Session abandoned. Window expired.
                      </li>
                      <li>
                        <strong className="text-emerald-400 font-semibold">
                          Completed:
                        </strong>{" "}
                        Finished successfully.
                      </li>
                      <li>
                        <strong className="text-amber-400 font-semibold">
                          Pending:
                        </strong>{" "}
                        Waiting for candidate.
                      </li>
                      <li>
                        <strong className="text-red-400 font-semibold">
                          Cancelled:
                        </strong>{" "}
                        Terminated by recruiter.
                      </li>
                      <li>
                        <strong className="text-zinc-400 font-semibold">
                          Expired:
                        </strong>{" "}
                        Time window elapsed.
                      </li>
                    </ul>
                  </div>
                </div>
              </th>
              <th className="p-5 text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                Type
              </th>
              <th className="p-5 text-sm font-semibold text-zinc-400 uppercase tracking-wider">
                Scheduled
              </th>
              <th className="p-5 text-sm font-semibold text-zinc-400 uppercase tracking-wider text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {interviews.map((int) => (
              <tr
                key={int.id}
                className="hover:bg-white/5 transition-colors group [&:last-child>td:first-child]:rounded-bl-2xl [&:last-child>td:last-child]:rounded-br-2xl"
              >
                <td className="p-5">
                  <div className="font-medium text-zinc-200">
                    {int.candidate_name || "Anonymous"}
                  </div>
                  <div className="text-xs text-zinc-500 flex items-center mt-1">
                    <Briefcase className="w-3 h-3 mr-1" />
                    {int.position}
                  </div>
                </td>
                <td className="p-5">
                  {(() => {
                    const isExpired =
                      int.status === "pending" &&
                      int.expires_at &&
                      new Date() > new Date(int.expires_at);
                    const displayStatus = isExpired ? "expired" : int.status;

                    const formatStatus = (s: string) =>
                      s === "partially_completed" ? "Partially Completed" : s;

                    return (
                      <span
                        className={`px-3 py-1.5 text-xs rounded-full font-medium capitalize ${
                          displayStatus === "completed"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : displayStatus === "active"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : displayStatus === "cancelled"
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : displayStatus === "expired"
                                  ? "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20"
                                  : displayStatus === "partially_completed"
                                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                    : displayStatus === "incomplete"
                                      ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {formatStatus(displayStatus)}
                      </span>
                    );
                  })()}
                </td>
                <td className="p-5">
                  <div className="text-sm text-zinc-300">
                    {int.interview_type}
                  </div>
                  <div className="text-xs text-zinc-500">{int.difficulty}</div>
                </td>
                <td className="p-5 text-sm text-zinc-400 flex items-center">
                  <Clock className="w-4 h-4 mr-2 opacity-50" />
                  {int.scheduled_at
                    ? new Date(int.scheduled_at).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "N/A"}
                </td>
                <td className="p-5 text-right">
                  <div className="flex items-center justify-end space-x-3">
                    {["pending", "active", "incomplete"].includes(int.status) &&
                      (!int.expires_at ||
                        new Date() <= new Date(int.expires_at)) && (
                        <button
                          onClick={(e) => copyExistingLink(e, int.id)}
                          title="Copy Invite Link"
                          className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-colors"
                        >
                          {copiedId === int.id ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <LinkIcon className="w-4 h-4" />
                          )}
                        </button>
                      )}

                    {/* ONLY SHOW TRASH IF INTERVIEW CANNOT BE CANCELLED */}
                    {(() => {
                      const timeUntilStart =
                        new Date(int.scheduled_at).getTime() - Date.now();
                      const isCancelable =
                        ["pending", "active", "incomplete"].includes(
                          int.status,
                        ) &&
                        (!int.expires_at ||
                          new Date() <= new Date(int.expires_at)) &&
                        timeUntilStart > 15 * 60 * 1000;

                      if (!isCancelable) {
                        return (
                          <button
                            onClick={() => setDeleteConfirmId(int.id)}
                            title="Remove from Dashboard"
                            className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        );
                      }
                      return null;
                    })()}

                    <button
                      onClick={() => loadDetails(int.id)}
                      className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg transition-all text-sm font-medium inline-flex items-center"
                    >
                      {int.status === "completed" ? "Review" : "Details"}{" "}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {interviews.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-zinc-500">
                  No interviews found. Schedule a session to begin!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-950 border border-red-500/20 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <Trash2 className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Remove Interview?
              </h3>
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                Are you sure you want to remove this interview? It will be
                hidden from your dashboard and the candidate will lose access to
                the assessment link.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={isHiding}
                  className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-medium transition-colors border border-white/5"
                >
                  Go Back
                </button>
                <button
                  onClick={confirmHideInterview}
                  disabled={isHiding}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)] disabled:opacity-50 flex items-center justify-center"
                >
                  {isHiding ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Yes, Remove"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
