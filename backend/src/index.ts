export interface Env {
	SUPABASE_URL: string;
	SUPABASE_SERVICE_ROLE_KEY: string; // <-- Updated
	OPENAI_API_KEY: string;
	ASSEMBLYAI_API_KEY: string;
	RESEND_API_KEY: string;
	DEEPGRAM_API_KEY: string;
}

function getSystemPrompt(interviewType: string, technicalFormat: string) {
	const baseDirectives = `CRITICAL VOICE INSTRUCTIONS:
- BE HUMAN & CONVERSATIONAL: Act naturally. Empathize, react, and sound like a real person.
- DYNAMIC TOPIC MANAGEMENT: You are conducting a time-limited interview and must provide the hiring manager with a well-rounded evaluation. Do NOT get stuck on endless follow-up questions about a single topic or project. Listen to the candidate's answer, ask maybe one relevant follow-up, and then confidently pivot to a completely new topic (e.g., architecture, problem-solving, behavioral) to extract maximum knowledge.
- STRICTLY PLAIN TEXT: Do not use markdown, bolding, lists, or JSON formatting. Output ONLY the exact plain-English words you want to speak next.
- NEVER read raw code syntax out loud. Speak about code conceptually.`;

	if (interviewType !== 'Technical') {
		return `You are an expert HR/Behavioral interviewer. Focus on past experiences, soft skills, and cultural fit.\n\n${baseDirectives}`;
	}

	if (technicalFormat === 'Questions Only') {
		return `You are an expert Software Engineering interviewer conducting a "Questions Only" conceptual assessment.
CRITICAL RULES:
1. TOPIC TRANSITIONS: Explore topics naturally based on the candidate's answers, but force pivots to new topics to ensure broad coverage.
2. NO CODING: NEVER ask the candidate to write code. This is purely verbal architecture and conceptual Q&A.\n\n${baseDirectives}`;
	}

	if (technicalFormat === 'Coding Round Only') {
		return `You are an expert Software Engineering interviewer conducting a STRICTLY "Coding Round Only" assessment.
SYSTEM ARCHITECTURE:
- The user has a visual Code Editor on their screen.
- You MUST immediately present a clear, standard LeetCode-style algorithmic/logic problem.
- Explicitly tell the user: "Please open the code editor on your screen to write, run, and submit your solution."
- WAIT. The system will inject a block starting with "I have completed the code..." when they hit submit.

CRITICAL RULES:
1. VERBAL CHATTER VS SUBMISSION: If the user is just thinking out loud without the explicit code payload, DO NOT evaluate them. Reply naturally.
2. CODE REVIEW: ONLY when you receive the explicit injected code block, review efficiency and execution output.\n\n${baseDirectives}`;
	}

	// Default to 'Mix'
	return `You are an expert Software Engineering interviewer conducting a Mixed assessment (Verbal Q&A + Coding).
SYSTEM ARCHITECTURE:
- Engage in a natural conversation first. Pivot topics dynamically.
- Then, explicitly transition to the coding phase and present an algorithmic problem.
- Explicitly tell the user: "Please open the code editor on your screen to write, run, and submit your solution."
- WAIT. The system will automatically inject their code and terminal output into the chat for you to read.\n\n${baseDirectives}`;
}

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		const url = new URL(request.url);
		const path = url.pathname;

		try {
			// ROUTE: SECURE BINARY PROXY
			// ==========================================
			if (request.method === 'GET' && path === '/api/stream') {
				const upgradeHeader = request.headers.get('Upgrade');
				if (!upgradeHeader || upgradeHeader !== 'websocket') return new Response('Expected Upgrade: websocket', { status: 426 });

				const interviewId = url.searchParams.get('interviewId');
				const clientId = url.searchParams.get('clientId');

				const tokenRes = await fetch('https://streaming.assemblyai.com/v3/token?expires_in_seconds=600', {
					headers: { Authorization: env.ASSEMBLYAI_API_KEY },
				});
				const { token } = (await tokenRes.json()) as { token: string };

				const webSocketPair = new WebSocketPair();
				const [clientWs, serverWs] = Object.values(webSocketPair);
				serverWs.accept();

				const aaiUrl = `wss://streaming.assemblyai.com/v3/ws?token=${token}&speech_model=universal-streaming-english&sample_rate=16000&format_turns=true&end_utterance_silence_threshold=500`;
				const aaiWs = new WebSocket(aaiUrl) as any;
				let messageBuffer: any[] = [];
				let isAaiReady = false;

				let silenceTimer: any = null;
				let turnsMap = new Map<number, string>();

				const cleanup = () => {
					if (silenceTimer) clearTimeout(silenceTimer);
					if (aaiWs.readyState === WebSocket.OPEN) aaiWs.close();
					if (serverWs.readyState === WebSocket.OPEN) serverWs.close();
				};

				aaiWs.onopen = () => {
					isAaiReady = true;
					messageBuffer.forEach((msg) => aaiWs.send(msg));
					messageBuffer = [];
				};

				serverWs.addEventListener('message', (event) => {
					// Intercept client-side pings to verify database lock
					if (typeof event.data === 'string') {
						try {
							const parsed = JSON.parse(event.data);
							if (parsed.type === 'ping') {
								if (interviewId && clientId) {
									fetch(`${env.SUPABASE_URL}/rest/v1/interviews?id=eq.${interviewId}&select=engine_state`, {
										headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
									})
										.then((res) => res.json())
										.then((data: any) => {
											// If the lock has been taken by another client, SEVER THE CONNECTION
											if (data[0]?.engine_state?.session_client_id && data[0].engine_state.session_client_id !== clientId) {
												serverWs.send(JSON.stringify({ type: 'InterviewControl', action: 'KillSession' }));
												cleanup();
											} else {
												serverWs.send(JSON.stringify({ type: 'pong' }));
											}
										})
										.catch(() => serverWs.send(JSON.stringify({ type: 'pong' })));
								} else {
									serverWs.send(JSON.stringify({ type: 'pong' }));
								}
								return; // Do NOT forward ping to AssemblyAI
							}
						} catch (e) {
							// Not JSON, continue to normal handling
						}
					}

					if (isAaiReady && aaiWs.readyState === WebSocket.OPEN) {
						aaiWs.send(event.data);
					} else {
						messageBuffer.push(event.data);
					}
				});

				aaiWs.onmessage = (event: any) => {
					if (serverWs.readyState !== WebSocket.OPEN) return;
					try {
						const data = JSON.parse(event.data as string);
						if (data.type === 'Turn') {
							if (silenceTimer) clearTimeout(silenceTimer);

							// 1. Save the new chunk of words
							if (data.transcript && data.turn_order !== undefined) {
								turnsMap.set(data.turn_order, data.transcript);
							}

							// 2. Combine all chunks spoken so far into one continuous sentence
							const accumulatedText = Array.from(turnsMap.entries())
								.sort((a, b) => a[0] - b[0])
								.map((entry) => entry[1])
								.join(' ')
								.trim();

							// 3. Send the full, growing sentence to the frontend CC
							if (accumulatedText) {
								serverWs.send(JSON.stringify({ type: 'LiveTranscript', text: accumulatedText }));
							}

							// 4. Wait for silence to submit (optimized to 3.5s to prevent premature cutoff)
							silenceTimer = setTimeout(() => {
								if (accumulatedText) {
									serverWs.send(JSON.stringify({ type: 'InterviewControl', action: 'SubmitAnswer', text: accumulatedText }));
									turnsMap.clear();
								}
							}, 3500);
						}
					} catch (e) {
						console.error('[Proxy] Parse error', e);
					}
				};

				serverWs.addEventListener('close', cleanup);
				aaiWs.addEventListener('close', cleanup);
				serverWs.addEventListener('error', cleanup);
				aaiWs.addEventListener('error', cleanup);

				return new Response(null, { status: 101, webSocket: clientWs });
			}

			// ==========================================
			// ROUTE: HEARTBEAT & RELEASE LOCK
			// ==========================================
			const hbMatch = path.match(/^\/api\/heartbeat\/([a-zA-Z0-9-]+)$/);
			if (request.method === 'POST' && hbMatch) {
				const interviewId = hbMatch[1];
				const { clientId } = (await request.json().catch(() => ({}))) as any;
				const intRes = await fetch(`${env.SUPABASE_URL}/rest/v1/interviews?id=eq.${interviewId}&select=engine_state`, {
					headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
				});
				const intData = (await intRes.json()) as any[];
				if (intData[0] && intData[0].engine_state?.session_client_id === clientId) {
					const newState = { ...intData[0].engine_state, last_heartbeat: new Date().toISOString() };
					await fetch(`${env.SUPABASE_URL}/rest/v1/interviews?id=eq.${interviewId}`, {
						method: 'PATCH',
						headers: {
							apikey: env.SUPABASE_SERVICE_ROLE_KEY,
							Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ engine_state: newState }),
					});
				}
				return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
			}

			const relMatch = path.match(/^\/api\/release\/([a-zA-Z0-9-]+)$/);
			if (request.method === 'POST' && relMatch) {
				const interviewId = relMatch[1];
				const { clientId } = (await request.json().catch(() => ({}))) as any;

				const intRes = await fetch(`${env.SUPABASE_URL}/rest/v1/interviews?id=eq.${interviewId}&select=engine_state,status`, {
					headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
				});
				const intData = (await intRes.json()) as any[];

				// Only apply the abandoned status if they were currently active and owned the lock
				if (intData[0] && intData[0].engine_state?.session_client_id === clientId && intData[0].status === 'active') {
					const newState = { ...intData[0].engine_state, last_heartbeat: null };
					// Instantly mark as incomplete
					await fetch(`${env.SUPABASE_URL}/rest/v1/interviews?id=eq.${interviewId}`, {
						method: 'PATCH',
						headers: {
							apikey: env.SUPABASE_SERVICE_ROLE_KEY,
							Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ status: 'incomplete', engine_state: newState }),
					});
				}
				return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
			}

			// ==========================================
			// ROUTE: START INTERVIEW (STRICT LOCK ENFORCED)
			// ==========================================
			if (request.method === 'POST' && path === '/api/start') {
				const body = (await request.json().catch(() => ({}))) as any;
				const { interviewId, email, otp } = body;

				if (!interviewId) throw new Error('Anonymous sessions are disabled.');

				const intRes = await fetch(`${env.SUPABASE_URL}/rest/v1/interviews?id=eq.${interviewId}&select=*`, {
					headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
				});
				const intData = (await intRes.json()) as any[];

				if (!intData || intData.length === 0) throw new Error('Interview not found');
				const info = intData[0];

				// --- SMART BACKEND SECURITY GATES ---
				if (info.status === 'completed') {
					return new Response(JSON.stringify({ error: 'This interview has already been completed.' }), {
						status: 403,
						headers: corsHeaders,
					});
				}
				if (info.is_hidden) {
					return new Response(JSON.stringify({ error: 'This interview is no longer available.' }), { status: 403, headers: corsHeaders });
				}
				if (info.candidate_email.toLowerCase() !== email?.toLowerCase() || info.otp !== otp) {
					return new Response(JSON.stringify({ error: 'Unauthorized: Invalid email or Access PIN.' }), {
						status: 401,
						headers: corsHeaders,
					});
				}
				if (info.scheduled_at && new Date().getTime() < new Date(info.scheduled_at).getTime()) {
					return new Response(JSON.stringify({ error: 'Unauthorized: This interview has not started yet.' }), {
						status: 403,
						headers: corsHeaders,
					});
				}
				// ------------------------------------

				const clientId = crypto.randomUUID();
				const nowIso = new Date().toISOString();

				// STRICT CHECK: ACTIVE SESSION LOCK & REJOIN WINDOW
				if (['active', 'incomplete', 'partially_completed'].includes(info.status)) {
					const lastHeartbeatStr = info.engine_state?.last_heartbeat;
					const lastHeartbeat = lastHeartbeatStr ? new Date(lastHeartbeatStr).getTime() : new Date(info.started_at).getTime();
					const now = new Date().getTime();
					const timeSinceHb = now - lastHeartbeat;

					// 1. Concurrency Lock: Prevent multiple joins if recently active (< 60s)
					if (info.status === 'active' && timeSinceHb < 60000) {
						return new Response(
							JSON.stringify({
								error:
									'This session is currently active. If you just disconnected, please wait 60 seconds for the connection to clear before rejoining.',
								type: 'SESSION_LOCKED',
							}),
							{ status: 409, headers: corsHeaders },
						);
					}

					// 2. 5-Minute Rejoin Expiration Lock
					if (timeSinceHb > 300000) {
						// Auto-mark as partially completed since the 5 minute window passed
						await fetch(`${env.SUPABASE_URL}/rest/v1/interviews?id=eq.${interviewId}`, {
							method: 'PATCH',
							headers: {
								apikey: env.SUPABASE_SERVICE_ROLE_KEY,
								Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({ status: 'partially_completed' }),
						});
						return new Response(
							JSON.stringify({
								error: 'Your 5-minute window to reconnect has expired. This assessment is permanently closed.',
								type: 'SESSION_EXPIRED',
							}),
							{ status: 403, headers: corsHeaders },
						);
					}

					// 3. Valid Rejoin (within 5 mins) -> Resume the session
					const history = await getMessages(env, interviewId);
					const formattedHistory = history
						.filter((msg: any) => msg.speaker !== 'system')
						.map((msg: any) => ({ role: msg.speaker, content: msg.cleaned_transcript }));
					const newState = { ...(info.engine_state || {}), session_client_id: clientId, last_heartbeat: nowIso };

					await fetch(`${env.SUPABASE_URL}/rest/v1/interviews?id=eq.${interviewId}`, {
						method: 'PATCH',
						headers: {
							apikey: env.SUPABASE_SERVICE_ROLE_KEY,
							Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ status: 'active', engine_state: newState }), // Ensure status goes back to active
					});

					return new Response(
						JSON.stringify({ interviewId, status: 'resumed', history: formattedHistory, clientId, startedAt: info.started_at }),
						{
							headers: { ...corsHeaders, 'Content-Type': 'application/json' },
						},
					);
				}

				// Otherwise, Initialize Pending Session
				const interviewType = info.interview_type || 'Technical';
				const technicalFormat = info.technical_format || 'Mix';
				const dynamicSystemPrompt = `${getSystemPrompt(interviewType, technicalFormat)}\n\nCONTEXT:\nCandidate: ${info.candidate_name}\nPosition: ${info.position}\nTotal Duration: ${info.duration} minutes\n\nDIRECTIVE: Initialize the interview. Welcome the candidate and begin.`;

				// Generate the initial greeting using the streamlined configuration
				const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
					body: JSON.stringify({
						model: 'gpt-5.4-mini',
						messages: [
							{ role: 'system', content: getSystemPrompt(interviewType, technicalFormat) },
							{
								role: 'user',
								content:
									'Give a brief, natural, and welcoming greeting. State your role briefly, and immediately ask the very first interview question to get things started. Keep the greeting short so we can dive into the interview. Output ONLY the exact plain-English words you will say. No JSON, no markdown.',
							},
						],
						temperature: 0.275,
						max_completion_tokens: 250,
					}),
				});

				if (!openAiRes.ok) {
					const errorText = await openAiRes.text();
					console.error('[/api/start] Exact OpenAI Rejection:', errorText);
					throw new Error(`OpenAI API error at start: ${errorText}`);
				}

				const openAiData = (await openAiRes.json()) as any;
				const firstQuestionText = openAiData.choices[0].message.content.trim();
				const greeting = firstQuestionText;

				// FIX: Merge the existing engine_state (which contains the recruiter's chosen voice) so it isn't deleted
				const initialState = {
					...(info.engine_state || {}),
					session_client_id: clientId,
					last_heartbeat: nowIso,
				};

				await fetch(`${env.SUPABASE_URL}/rest/v1/interviews?id=eq.${interviewId}`, {
					method: 'PATCH',
					headers: {
						apikey: env.SUPABASE_SERVICE_ROLE_KEY,
						Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ status: 'active', started_at: nowIso, engine_state: initialState }),
				});
				await insertMessage(env, interviewId, 'system', dynamicSystemPrompt);
				const aiMessageId = await insertMessage(env, interviewId, 'ai', greeting);
				const voiceModel = info.engine_state?.interviewer_voice || 'aura-2-thalia-en';

				// FIX: Pre-fetch Base64 audio for the first greeting to eliminate startup delay
				let audioBase64: string | null = null;
				try {
					const dgRes = await fetch(`https://api.deepgram.com/v1/speak?model=${voiceModel}&encoding=linear16&sample_rate=16000`, {
						method: 'POST',
						headers: { Authorization: `Token ${env.DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
						body: JSON.stringify({ text: greeting }),
					});
					if (dgRes.ok) {
						const arrayBuffer = await dgRes.arrayBuffer();
						const bytes = new Uint8Array(arrayBuffer);
						let binary = '';
						for (let i = 0; i < bytes.byteLength; i++) {
							binary += String.fromCharCode(bytes[i]);
						}
						audioBase64 = btoa(binary);
					}
				} catch (dgErr) {
					console.error('Deepgram greeting pre-fetch failed', dgErr);
				}

				return new Response(
					JSON.stringify({
						interviewId,
						status: 'started',
						greeting,
						clientId,
						startedAt: nowIso,
						messageId: aiMessageId,
						voice: voiceModel,
						audioBase64: audioBase64,
					}),
					{
						headers: { ...corsHeaders, 'Content-Type': 'application/json' },
					},
				);
			}

			// ==========================================
			// ROUTE: CREATE INTERVIEW & SEND EMAIL
			// ==========================================
			if (request.method === 'POST' && path === '/api/interviews/create') {
				const authHeader = request.headers.get('Authorization');
				if (!authHeader)
					return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders });

				const body = (await request.json()) as any;

				// 1. Insert into Supabase using the user's Auth token to respect RLS
				const insertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/interviews`, {
					method: 'POST',
					headers: {
						apikey: env.SUPABASE_SERVICE_ROLE_KEY,
						Authorization: authHeader,
						'Content-Type': 'application/json',
						Prefer: 'return=representation',
					},
					body: JSON.stringify(body.interviewData),
				});

				if (!insertRes.ok) {
					const errorData = await insertRes.text();
					throw new Error(`Supabase Insert Failed: ${errorData}`);
				}

				const insertedData = (await insertRes.json()) as any[];
				const interview = insertedData[0];
				const interviewLink = `${body.origin}?id=${interview.id}`;

				// 2. Send Beautiful Email via Resend
				const emailHtml = `
				<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
					<div style="background-color: #4f46e5; padding: 32px 24px; text-align: center;">
						<h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Interview Invitation</h1>
					</div>
					<div style="padding: 32px 24px; color: #374151;">
						<p style="font-size: 16px; margin-top: 0;">Hello <strong>${interview.candidate_name}</strong>,</p>
						<p style="font-size: 16px; line-height: 1.5;">You have been invited to complete a <strong>${interview.interview_type}</strong> assessment for the <strong>${interview.position}</strong> role at Albiorix Tech.</p>
						
						<table style="width: 100%; margin: 24px 0; border-collapse: collapse;">
							<tr>
								<td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; width: 40%;">Scheduled Time</td>
								<td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${body.displayTime}</td>
							</tr>
							<tr>
								<td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Duration</td>
								<td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${interview.duration} minutes</td>
							</tr>
						</table>

						<div style="background-color: #f9fafb; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 24px; text-align: center; margin: 32px 0;">
							<p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Your Access PIN</p>
							<div style="font-family: monospace; font-size: 36px; font-weight: 700; color: #4f46e5; letter-spacing: 0.15em;">${interview.otp}</div>
							<p style="margin: 16px 0 0 0; font-size: 14px; color: #6b7280;">You will need this PIN to verify your identity.</p>
						</div>

						<div style="text-align: center; margin: 32px 0;">
							<a href="${interviewLink}" style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Start Assessment</a>
						</div>

						<div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px;">
							<p style="margin: 0; font-size: 14px; color: #991b1b;"><strong>Important:</strong> Please ensure you are on a desktop or laptop computer with a working microphone in a quiet environment. Mobile devices are not supported.</p>
						</div>
						
						<p style="font-size: 16px; margin-bottom: 0;">Best of luck,<br/><strong>The Hiring Team</strong></p>
					</div>
				</div>
				`;

				const resendRes = await fetch('https://api.resend.com/emails', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${env.RESEND_API_KEY}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						from: 'onboarding@resend.dev',
						to: [interview.candidate_email],
						subject: `Interview Invitation: ${interview.position}`,
						html: emailHtml,
					}),
				});

				if (!resendRes.ok) {
					const resendErr = await resendRes.text();
					console.error('Resend Error:', resendErr);
					return new Response(JSON.stringify({ interview, emailSent: false, error: 'Email failed to send' }), { headers: corsHeaders });
				}

				return new Response(JSON.stringify({ interview, emailSent: true }), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			// ==========================================
			// ROUTE: BACKGROUND AUDIO UPLOAD (Fire & Forget)
			// ==========================================
			const audioUpMatch = path.match(/^\/api\/audio-upload\/([a-zA-Z0-9-]+)$/);
			if (request.method === 'POST' && audioUpMatch) {
				const interviewId = audioUpMatch[1];
				const { base64Audio, audioId } = (await request.json().catch(() => ({}))) as any;

				if (base64Audio && audioId) {
					ctx.waitUntil(
						(async () => {
							try {
								const fileName = `${interviewId}/${audioId}.webm`;
								const binaryString = atob(base64Audio);
								const bytes = new Uint8Array(binaryString.length);
								for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

								await fetch(`${env.SUPABASE_URL}/storage/v1/object/recordings/${fileName}`, {
									method: 'POST',
									headers: {
										apikey: env.SUPABASE_SERVICE_ROLE_KEY,
										Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
										'Content-Type': 'audio/webm',
									},
									body: bytes,
								});
							} catch (e) {
								console.error('[Backend] Background audio upload error:', e);
							}
						})(),
					);
				}
				return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
			}

			// ==========================================
			// ROUTE: CHAT WITH AI
			// ==========================================
			const chatMatch = path.match(/^\/api\/chat\/([a-zA-Z0-9-]+)$/);
			if (request.method === 'POST' && chatMatch) {
				const interviewId = chatMatch[1];
				const { message, base64Audio, clientId } = (await request.json().catch(() => ({}))) as any;

				const [intRes, history] = await Promise.all([
					fetch(
						`${env.SUPABASE_URL}/rest/v1/interviews?id=eq.${interviewId}&select=status,engine_state,position,interview_type,technical_format,duration,started_at`,
						{
							headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
						},
					),
					getMessages(env, interviewId),
				]);

				const intData = (await intRes.json()) as any[];
				if (!intData || intData.length === 0)
					return new Response(JSON.stringify({ error: 'Interview not found' }), { status: 404, headers: corsHeaders });
				if (intData[0].engine_state?.session_client_id && intData[0].engine_state.session_client_id !== clientId) {
					return new Response(JSON.stringify({ error: 'Session superseded', type: 'SESSION_CONFLICT' }), {
						status: 409,
						headers: corsHeaders,
					});
				}

				const transcript = message;
				let audioUrl = null;

				if (base64Audio) {
					const fileName = `${interviewId}/${Date.now()}.webm`;
					audioUrl = `${env.SUPABASE_URL}/storage/v1/object/public/recordings/${fileName}`;
					ctx.waitUntil(
						(async () => {
							try {
								const binaryString = atob(base64Audio);
								const bytes = new Uint8Array(binaryString.length);
								for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
								await fetch(`${env.SUPABASE_URL}/storage/v1/object/recordings/${fileName}`, {
									method: 'POST',
									headers: {
										apikey: env.SUPABASE_SERVICE_ROLE_KEY,
										Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
										'Content-Type': 'audio/webm',
									},
									body: bytes,
								});
							} catch (e) {}
						})(),
					);
				}

				const currentState = intData[0]?.engine_state || {};
				const voiceModel = currentState.interviewer_voice || 'aura-2-thalia-en';

				// Track message to DB immediately
				ctx.waitUntil(
					(async () => {
						try {
							await insertMessage(env, interviewId, 'candidate', transcript, audioUrl, transcript);
						} catch (e) {}
					})(),
				);

				// Brain B: Live Mouth
				const timeElapsedMinutes = (Date.now() - new Date(intData[0].started_at).getTime()) / 60000;
				const totalDuration = intData[0].duration || 15;
				const minutesRemaining = Math.max(0, totalDuration - timeElapsedMinutes);

				let isFinalTurn = false;
				let pacingDirective = `TIME MANAGEMENT: You have ${minutesRemaining.toFixed(1)} minutes remaining out of ${totalDuration} total minutes. `;
				if (minutesRemaining < 2) {
					pacingDirective += `The interview is almost over. You MUST gracefully wrap up the conversation, provide a brief encouraging closing statement, and say goodbye now. Do NOT ask any new questions.`;
					isFinalTurn = true;
				} else {
					pacingDirective += `Continue the interview naturally. Do not end the interview early.`;
					if (intData[0]?.technical_format === 'Coding Round Only') {
						pacingDirective += ` Wait if they are thinking. Only give new code problems if >8m remain.`;
					}
				}

				const textMessages = history.map((msg: any) => ({
					role: msg.speaker === 'ai' ? 'assistant' : msg.speaker === 'candidate' ? 'user' : 'system',
					content: msg.cleaned_transcript,
				}));
				textMessages.push({ role: 'user', content: transcript });

				// CRITICAL OVERRIDE: Forcing pure human text, stripping JSON leakage
				const rawPrompt = getSystemPrompt(intData[0]?.interview_type || 'Technical', intData[0]?.technical_format || 'Mix');
				const overridePrompt = `CRITICAL OVERRIDE: You are the live voice module. IGNORE ALL previous instructions to output JSON. DO NOT use brackets {}. DO NOT output 'spoken_response' or 'new_state' keys. Speak directly, naturally, and concisely to the candidate in plain human text ONLY.`;
				textMessages.push({ role: 'system', content: `${rawPrompt}\n\n${pacingDirective}\n\n${overridePrompt}` });

				const { readable, writable } = new TransformStream();
				const writer = writable.getWriter();
				const sendSSE = async (type: string, data: string) => {
					try {
						await writer.write(new TextEncoder().encode(`data: ${JSON.stringify({ type, data })}\n\n`));
					} catch (e) {}
				};

				ctx.waitUntil(
					(async () => {
						let fullAiText = '';
						let dgWs: WebSocket | null = null;
						try {
							console.log('[Chat Route] Starting AI generation turn.');

							let lastAudioChunkTime = Date.now();

							// Connect to Deepgram WS for Linear16 PCM Audio
							const dgReq = new Request(`https://api.deepgram.com/v1/speak?model=${voiceModel}&encoding=linear16&sample_rate=16000`, {
								headers: { Authorization: `Token ${env.DEEPGRAM_API_KEY}`, Upgrade: 'websocket' },
							});
							const dgRes = await fetch(dgReq);
							dgWs = dgRes.webSocket; // FIX: Assign to outer variable, removed 'const'
							if (!dgWs) throw new Error('Deepgram WS failed');

							dgWs.accept();
							let dgReady = true; 
							let isDeepgramDone = false; 
							let pendingWrites = 0;
							
							if (dgWs) {
								dgWs.addEventListener('close', () => { dgReady = false; console.log("[Deepgram] WS Closed."); });
								dgWs.addEventListener('error', (e) => { console.error("[Deepgram] WS Error:", e); });
								dgWs.addEventListener('message', async (event: any) => {
									if (typeof event.data === 'string') {
										if (event.data.includes('"type":"Flushed"') || event.data.includes('"Flushed"')) {
											isDeepgramDone = true;
										}
									} else {
										pendingWrites++;
										try {
											const bytes = new Uint8Array(event.data as ArrayBuffer);
											let binary = '';
											for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
											await sendSSE('audio', btoa(binary));
										} catch (err) {
											console.error("[Deepgram] Failed to forward audio chunk:", err);
										} finally {
											pendingWrites--;
										}
									}
								});
							}

							const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
								body: JSON.stringify({
									model: 'gpt-4o',
									messages: textMessages,
									stream: true,
								}),
							});

							const reader = openAiRes.body!.getReader();
							const decoder = new TextDecoder();
							let buffer = ""; 

							while (true) {
								const { done, value } = await reader.read();
								if (done) break;
								
								buffer += decoder.decode(value, { stream: true });
								const lines = buffer.split('\n');
								buffer = lines.pop() || "";
								
								for (const line of lines) {
									const trimmedLine = line.trim();
									if (trimmedLine.startsWith('data: ') && trimmedLine !== 'data: [DONE]') {
										try {
											const data = JSON.parse(trimmedLine.slice(6));
											const word = data.choices[0]?.delta?.content;
											if (word) {
												fullAiText += word; // FIX: Correctly updates the outer variable now
												await sendSSE('text', word);
												if (dgWs && dgReady && dgWs.readyState === 1) {
													dgWs.send(JSON.stringify({ type: 'Speak', text: word }));
												}
											}
										} catch (e: any) {
											console.error("[Stream Parse Error] Failed on line:", trimmedLine, "Error:", e.message);
										}
									}
								}
							}

							if (dgWs && dgReady && dgWs.readyState === 1) {
								console.log("[Deepgram] Sending Flush command.");
								dgWs.send(JSON.stringify({ type: 'Flush' }));
								
								let waitLoops = 0;
								while ((!isDeepgramDone || pendingWrites > 0) && waitLoops < 150) { 
									await new Promise(r => setTimeout(r, 100));
									waitLoops++;
								}
							}
						} catch (e: any) {
							console.error('[Chat Route] Fatal Error in stream processing:', e.message || e);
						} finally {
							console.log("[Chat Route] Finalizing turn. Sending 'end' SSE.");
							if (isFinalTurn) {
								await sendSSE('auto_end', ''); // Signal frontend to terminate gracefully
							}
							await sendSSE('end', '');
							await writer.close();
							if (dgWs && dgWs.readyState !== 3) {
								dgWs.close();
							}
							if (fullAiText.trim()) {
								await insertMessage(env, interviewId, 'ai', fullAiText);
							}
						}
					})(),
				);

				return new Response(readable, {
					headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
				});
			}

			// ==========================================
			// ROUTE: STREAM ZERO-LATENCY AUDIO (BUFFERED)
			// ==========================================
			const audioMatch = path.match(/^\/api\/audio\/([a-zA-Z0-9-]+)$/);
			if (request.method === 'GET' && audioMatch) {
				const messageId = audioMatch[1];
				const voiceModel = url.searchParams.get('voice') || 'aura-2-thalia-en';

				try {
					const msgRes = await fetch(`${env.SUPABASE_URL}/rest/v1/interview_messages?id=eq.${messageId}&select=cleaned_transcript`, {
						headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
					});
					const msgData = (await msgRes.json()) as any;
					const text = msgData[0]?.cleaned_transcript;

					if (!text) {
						return new Response('Message not found', { status: 404, headers: corsHeaders });
					}

					const dgRes = await fetch(`https://api.deepgram.com/v1/speak?model=${voiceModel}&encoding=mp3`, {
						method: 'POST',
						headers: {
							Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({ text }),
					});

					if (!dgRes.ok) {
						console.error(`[Worker] Deepgram API Error:`, await dgRes.text());
						return new Response('TTS Generation Failed', { status: 500, headers: corsHeaders });
					}

					// FIX: Stream the raw response body directly for Zero-Latency chunked playback
					return new Response(dgRes.body, {
						headers: {
							...corsHeaders,
							'Content-Type': 'audio/mpeg',
							'Cache-Control': 'no-store',
							'Transfer-Encoding': 'chunked',
						},
					});
				} catch (err) {
					console.error('[Worker] Audio Route Exception:', err);
					return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
				}
			}

			// ==========================================
			// ROUTE: GENERIC TTS PROXY (For first greeting)
			// ==========================================
			const ttsMatch = path.match(/^\/api\/tts$/);
			if ((request.method === 'POST' || request.method === 'GET') && ttsMatch) {
				try {
					let text, voiceModel;
					if (request.method === 'POST') {
						const body: any = await request.json();
						text = body.text;
						voiceModel = body.voice || 'aura-2-thalia-en';
					} else {
						text = url.searchParams.get('text');
						voiceModel = url.searchParams.get('voice') || 'aura-2-thalia-en';
					}

					if (!text) return new Response('Missing text', { status: 400, headers: corsHeaders });

					const dgRes = await fetch(`https://api.deepgram.com/v1/speak?model=${voiceModel}&encoding=mp3`, {
						method: 'POST',
						headers: { Authorization: `Token ${env.DEEPGRAM_API_KEY}`, 'Content-Type': 'application/json' },
						body: JSON.stringify({ text }),
					});

					if (!dgRes.ok) return new Response('TTS Proxy Failed', { status: 500, headers: corsHeaders });

					// STREAM DIRECTLY (Zero Latency)
					return new Response(dgRes.body, {
						headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg', 'Transfer-Encoding': 'chunked' },
					});
				} catch (err) {
					console.error('[Worker] TTS Proxy Exception:', err);
					return new Response('Internal Server Error', { status: 500, headers: corsHeaders });
				}
			}

			// ==========================================
			// ROUTE: SUBMIT CODE
			// ==========================================
			const codeMatch = path.match(/^\/api\/code\/([a-zA-Z0-9-]+)$/);
			if (request.method === 'POST' && codeMatch) {
				const interviewId = codeMatch[1];
				const { language, code, output, clientId } = (await request.json()) as any;

				// Verify Lock
				const intRes = await fetch(`${env.SUPABASE_URL}/rest/v1/interviews?id=eq.${interviewId}&select=engine_state`, {
					headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
				});
				const intData = (await intRes.json()) as any[];
				if (intData[0]?.engine_state?.session_client_id && intData[0].engine_state.session_client_id !== clientId) {
					return new Response(JSON.stringify({ error: 'Session superseded', type: 'SESSION_CONFLICT' }), {
						status: 409,
						headers: corsHeaders,
					});
				}

				await fetch(`${env.SUPABASE_URL}/rest/v1/coding_submissions`, {
					method: 'POST',
					headers: {
						apikey: env.SUPABASE_SERVICE_ROLE_KEY,
						Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ interview_id: interviewId, language, code, output }),
				});
				return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
			}

			// ==========================================
			// ROUTE: END INTERVIEW
			// ==========================================
			const endMatch = path.match(/^\/api\/end\/([a-zA-Z0-9-]+)$/);
			if (request.method === 'POST' && endMatch) {
				const interviewId = endMatch[1];
				const { clientId } = (await request.json().catch(() => ({}))) as any;

				// 1. Verify Lock and Status
				const intRes = await fetch(`${env.SUPABASE_URL}/rest/v1/interviews?id=eq.${interviewId}&select=status,engine_state`, {
					headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
				});
				const intData = (await intRes.json()) as any[];

				if (!intData || intData.length === 0) {
					return new Response(JSON.stringify({ error: 'Interview not found' }), { status: 404, headers: corsHeaders });
				}
				if (intData[0].status === 'completed') {
					return new Response(JSON.stringify({ error: 'Interview already completed' }), { status: 400, headers: corsHeaders });
				}
				if (intData[0].engine_state?.session_client_id && intData[0].engine_state.session_client_id !== clientId) {
					return new Response(JSON.stringify({ error: 'Unauthorized: Session lock mismatch', type: 'SESSION_CONFLICT' }), {
						status: 409,
						headers: corsHeaders,
					});
				}

				const history = await getMessages(env, interviewId);
				const evalMessages = history.map((msg: any) => ({
					role: msg.speaker === 'ai' ? 'assistant' : msg.speaker === 'candidate' ? 'user' : 'system',
					content: msg.cleaned_transcript,
				}));

				evalMessages.push({
					role: 'system',
					content: `The interview has concluded. You are an expert technical interviewer. Provide a brutally honest evaluation of the candidate based ONLY on the transcript.
					You MUST respond strictly in JSON format matching this exact structure:
					{
					  "overallRating": 0,
					  "communication": 0,
					  "technicalKnowledge": 0,
					  "problemSolving": 0,
					  "confidence": 0,
					  "strengths": ["...", "..."],
					  "weaknesses": ["...", "..."],
					  "summary": "..."
					}`,
				});

				const aiResponseJson = await callOpenAI(env, evalMessages, true);

				let cleanJson = aiResponseJson.trim();
				if (cleanJson.startsWith('```json')) cleanJson = cleanJson.substring(7);
				else if (cleanJson.startsWith('```')) cleanJson = cleanJson.substring(3);
				if (cleanJson.endsWith('```')) cleanJson = cleanJson.substring(0, cleanJson.length - 3);
				cleanJson = cleanJson.trim();

				const parsedEval = JSON.parse(cleanJson);

				await fetch(`${env.SUPABASE_URL}/rest/v1/interviews?id=eq.${interviewId}`, {
					method: 'PATCH',
					headers: {
						apikey: env.SUPABASE_SERVICE_ROLE_KEY,
						Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ status: 'completed', completed_at: new Date().toISOString() }),
				});

				await fetch(`${env.SUPABASE_URL}/rest/v1/interview_evaluations`, {
					method: 'POST',
					headers: {
						apikey: env.SUPABASE_SERVICE_ROLE_KEY,
						Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						interview_id: interviewId,
						overall_score: parsedEval.overallRating,
						communication_score: parsedEval.communication,
						technical_score: parsedEval.technicalKnowledge,
						coding_score: parsedEval.problemSolving,
						confidence_score: parsedEval.confidence,
						strengths: parsedEval.strengths,
						weaknesses: parsedEval.weaknesses,
						summary: parsedEval.summary,
					}),
				});

				const readableEval = `=== FINAL EVALUATION REPORT ===\n\nOverall Rating: ${parsedEval.overallRating}/10\n\nSummary: ${parsedEval.summary}\n\nStrengths:\n- ${parsedEval.strengths?.join('\n- ') || 'None noted'}\n\nWeaknesses:\n- ${parsedEval.weaknesses?.join('\n- ') || 'None noted'}`;
				await insertMessage(env, interviewId, 'system', readableEval);

				const finalHistory = await getMessages(env, interviewId);
				const displayHistory = finalHistory
					.filter((msg: any) => msg.speaker !== 'system' || msg.cleaned_transcript.includes('=== FINAL EVALUATION REPORT ==='))
					.map((msg: any) => ({ role: msg.speaker, content: msg.cleaned_transcript }));

				return new Response(JSON.stringify({ success: true, history: displayHistory }), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			}

			return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: corsHeaders });
		} catch (error: any) {
			return new Response(JSON.stringify({ error: error.message }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}
	},
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================
async function insertMessage(
	env: Env,
	interviewId: string,
	speaker: string,
	content: string,
	audioUrl: string | null = null,
	rawTranscript: string | null = null,
) {
	const body: any = { interview_id: interviewId, speaker, cleaned_transcript: content };
	if (audioUrl) body.audio_url = audioUrl;
	if (rawTranscript) body.raw_transcript = rawTranscript;
	const res = await fetch(`${env.SUPABASE_URL}/rest/v1/interview_messages`, {
		method: 'POST',
		headers: {
			apikey: env.SUPABASE_SERVICE_ROLE_KEY,
			Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
			'Content-Type': 'application/json',
			Prefer: 'return=representation', // ADDED THIS to get the ID back
		},
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`Failed to save message`);
	const data = (await res.json()) as any;
	return data[0]?.id; // Returns the UUID of the saved message
}

async function getMessages(env: Env, interviewId: string): Promise<any> {
	const res = await fetch(`${env.SUPABASE_URL}/rest/v1/interview_messages?interview_id=eq.${interviewId}&order=timestamp.asc`, {
		method: 'GET',
		headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
	});
	if (!res.ok) throw new Error('Failed to fetch messages');
	return await res.json();
}

async function callOpenAI(env: Env, messages: any[], jsonMode: boolean = false) {
	const body: any = {
		model: 'gpt-5.4-mini',
		messages: messages,
		temperature: 0.275, // Lower temperature for more consistent, analytical evaluation
		max_completion_tokens: 1000, 
	};
	
	// We deliberately DO NOT include the response_format flag here 
	// because gpt-5.4-mini will handle the JSON formatting via the system prompt.

	const res = await fetch('https://api.openai.com/v1/chat/completions', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
		body: JSON.stringify(body),
	});
	
	if (!res.ok) {
		const errorText = await res.text();
		console.error("[callOpenAI] API Error:", errorText);
		throw new Error(`Failed to communicate with OpenAI API: ${errorText}`);
	}
	
	const data = (await res.json()) as any;
	return data.choices[0].message.content.trim();
}
