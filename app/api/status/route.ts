import { env } from 'cloudflare:workers';
import type { EnvConfig } from '@/lib/agent';
export function GET(){const e=env as EnvConfig;return Response.json({modelReady:!!(e.FIREWORKS_API_KEY&&e.FIREWORKS_MODEL),transcriptionReady:!!e.ELEVENLABS_API_KEY,speechReady:!!(e.ELEVENLABS_API_KEY&&e.ELEVENLABS_VOICE_ID)},{headers:{'Cache-Control':'no-store'}});}
