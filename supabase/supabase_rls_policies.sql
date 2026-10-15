-- ==========================================
-- SUPABASE SCHEMA & RLS POLICIES
-- Instructions: Copy and paste this entire file into the Supabase SQL Editor and hit "Run".
-- ==========================================

-- 1. Create the messages table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    interview_id UUID REFERENCES public.interviews(id) ON DELETE CASCADE,
    speaker TEXT NOT NULL, -- 'ai' or 'candidate'
    content TEXT NOT NULL,
    audio_url TEXT,
    raw_transcript TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS on all tables
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 3. Policies for 'interviews' table
-- Recruiters (Authenticated users) can view and create their own interviews
DROP POLICY IF EXISTS "Recruiters can insert interviews" ON public.interviews;
CREATE POLICY "Recruiters can insert interviews" 
ON public.interviews FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Recruiters can view their generated interviews" ON public.interviews;
CREATE POLICY "Recruiters can view their generated interviews" 
ON public.interviews FOR SELECT 
TO authenticated 
USING (auth.uid() = created_by);

-- Candidates (Anonymous users) can ONLY read/update an interview if they have the exact UUID
DROP POLICY IF EXISTS "Candidates can view specific interview details" ON public.interviews;
CREATE POLICY "Candidates can view specific interview details" 
ON public.interviews FOR SELECT 
TO anon 
USING (true); 

DROP POLICY IF EXISTS "Candidates can update interview state during session" ON public.interviews;
CREATE POLICY "Candidates can update interview state during session" 
ON public.interviews FOR UPDATE 
TO anon 
USING (true); 

-- 4. Policies for 'messages' table
-- Recruiters can read messages belonging to their scheduled interviews
DROP POLICY IF EXISTS "Recruiters can read candidate messages" ON public.messages;
CREATE POLICY "Recruiters can read candidate messages" 
ON public.messages FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.interviews 
    WHERE interviews.id = messages.interview_id 
    AND interviews.created_by = auth.uid()
  )
);

-- Candidates can insert and read messages for their specific interview session
DROP POLICY IF EXISTS "Candidates can insert messages" ON public.messages;
CREATE POLICY "Candidates can insert messages" 
ON public.messages FOR INSERT 
TO anon 
WITH CHECK (true);

DROP POLICY IF EXISTS "Candidates can read session messages" ON public.messages;
CREATE POLICY "Candidates can read session messages" 
ON public.messages FOR SELECT 
TO anon 
USING (true);
