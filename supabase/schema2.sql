-- Add audio_url to transcripts
alter table public.transcripts add column if not exists audio_url text;

-- Create the Storage bucket for recordings (if it doesn't exist)
insert into storage.buckets (id, name, public) 
values ('recordings', 'recordings', true) 
on conflict (id) do nothing;

-- Enable public access so the Dashboard can play the audio
create policy "Allow public access to recordings" 
on storage.objects for select to anon 
using ( bucket_id = 'recordings' );

-- Allow anonymous uploads to the recordings bucket
create policy "Allow anonymous uploads to recordings" 
on storage.objects for insert to anon 
with check ( bucket_id = 'recordings' );
