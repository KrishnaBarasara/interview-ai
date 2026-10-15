-- ==========================================
-- AI INTERVIEW PLATFORM - MASTER SCHEMA
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Interviews Table
CREATE TABLE IF NOT EXISTS public.interviews (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    candidate_name TEXT NOT NULL,
    candidate_email TEXT NOT NULL,
    position TEXT NOT NULL,
    interview_type TEXT NOT NULL,
    technical_format TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    duration INTEGER NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'incomplete', 'cancelled')),
    otp TEXT NOT NULL,
    engine_state JSONB DEFAULT '{}'::jsonb,
    is_hidden BOOLEAN DEFAULT false, -- Added for dashboard soft-delete
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Interview Messages Table (Transcripts)
CREATE TABLE IF NOT EXISTS public.interview_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('system', 'ai', 'candidate', 'interviewer')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Interview Evaluations Table (Scores & Feedback)
CREATE TABLE IF NOT EXISTS public.interview_evaluations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE,
    overall_score NUMERIC NOT NULL,
    strengths TEXT[] DEFAULT '{}',
    weaknesses TEXT[] DEFAULT '{}',
    feedback TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Coding Submissions Table
CREATE TABLE IF NOT EXISTS public.coding_submissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    code TEXT NOT NULL,
    output TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coding_submissions ENABLE ROW LEVEL SECURITY;

-- Note: All INSERT and UPDATE operations are now securely handled by the 
-- Cloudflare Worker backend using the SUPABASE_SERVICE_ROLE_KEY.
-- The frontend is only granted SELECT (Read) access via the Anon key.

-- Read Policies
CREATE POLICY "Allow public read access to interviews" 
    ON public.interviews FOR SELECT USING (true);

CREATE POLICY "Allow public read access to messages" 
    ON public.interview_messages FOR SELECT USING (true);

CREATE POLICY "Allow public read access to evaluations" 
    ON public.interview_evaluations FOR SELECT USING (true);

CREATE POLICY "Allow public read access to coding submissions" 
    ON public.coding_submissions FOR SELECT USING (true);
