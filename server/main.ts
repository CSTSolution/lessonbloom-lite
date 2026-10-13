// Server entry: API + the built web app (web/dist) from one Cloud Run service.
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { GeminiProvider } from './ai/gemini.ts';
import { MockProvider } from './ai/mock.ts';
import { createApp } from './app.ts';
import { config } from './config.ts';
import { LocalStore } from './store.ts';

const mock = process.env.LB_MOCK === '1' || !(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_USE_VERTEXAI);
const ai = mock ? new MockProvider() : new GeminiProvider();
const app = createApp(ai, new LocalStore());

app.use('/assets/*', serveStatic({ root: './web/dist' }));
app.get('*', serveStatic({ path: './web/dist/index.html' }));   // single-page app routes (/, /lesson/:id, /s/:share)

serve({ fetch: app.fetch, port: config.port }, (i) => console.log(`LessonBloom on http://localhost:${i.port} (${ai.name})`));
