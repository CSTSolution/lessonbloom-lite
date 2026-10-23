// The one seam between LessonBloom and the models. GeminiProvider talks to Gemini (AI
// Studio key or Vertex AI); MockProvider answers offline so everything runs without a key.

export type Task = 'intake' | 'lesson' | 'slide-edit' | 'exercises' | 'review' | 'cards' | 'error' | 'comments' | 'image-critic' | 'ocr' | 'guard';   // guard: the input pre-check (guard.ts)

export interface TextRequest {
  task: Task;
  tier: 'pro' | 'fast';
  system: string;
  prompt: string;
  schema: object;          // JSON schema the answer must follow
  input?: unknown;         // structured copy of what the prompt describes (the mock reads this)
}

export interface ImageRequest { prompt: string; key: string; aspect?: '4:3' | '1:1' | '16:9' }
export interface VisionRequest extends TextRequest { image?: Buffer; images?: { data: Buffer; mime: string }[] }   // images: photos in page order
export interface SpeechRequest { text: string; lang: 'vi' | 'en'; voice?: number }   // voice: 0 female North, 1 female South, 2 male North

import type { UsageEvent } from '../usage.ts';

export interface AI {
  name: string;
  onUsage?: (e: UsageEvent) => void;   // every model call reports what it used (admin page)
  json<T>(req: TextRequest): Promise<T>;
  image(req: ImageRequest): Promise<Buffer>;     // PNG or JPEG bytes
  see<T>(req: VisionRequest): Promise<T>;
  speak(req: SpeechRequest): Promise<Buffer>;    // WAV bytes
}
