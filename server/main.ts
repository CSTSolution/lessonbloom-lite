// Server entry: API + the built web app (web/dist) from one Cloud Run service.
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { GeminiProvider } from './ai/gemini.ts';
import { MockProvider } from './ai/mock.ts';
import { createApp } from './app.ts';
import { config } from './config.ts';
import { GcpStore } from './gcpstore.ts';
import { LocalStore } from './store.ts';

const mock = process.env.LB_MOCK === '1' || !(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_USE_VERTEXAI);
const ai = mock ? new MockProvider() : new GeminiProvider();
// LB_BUCKET set (Cloud Run): Firestore + Cloud Storage. Otherwise files under data/.
const store = process.env.LB_BUCKET ? new GcpStore(process.env.LB_BUCKET) : new LocalStore();
const app = createApp(ai, store);

app.use('/assets/*', serveStatic({ root: './web/dist' }));
app.get('*', serveStatic({ path: './web/dist/index.html' }));   // single-page app routes (/, /lesson/:id, /s/:share)

serve({ fetch: app.fetch, port: config.port }, (i) => console.log(`LessonBloom on :${i.port} (${ai.name}, ${process.env.LB_BUCKET ? 'firestore+gcs' : 'local files'})`));
