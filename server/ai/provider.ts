// The one seam between LessonBloom and the models. GeminiProvider talks to Gemini (AI
// Studio key or Vertex AI); MockProvider answers offline so everything runs without a key.

export type Task = 'intake' | 'lesson' | 'slide-edit' | 'exercises' | 'review' | 'cards' | 'error' | 'comments' | 'image-critic';

export interface TextRequest {
  task: Task;
  tier: 'pro' | 'fast';
  system: string;
  prompt: string;
  schema: object;          // JSON schema the answer must follow
  input?: unknown;         // structured copy of what the prompt describes (the mock reads this)
}

export interface ImageRequest { prompt: string; key: string; aspect?: '4:3' | '1:1' | '16:9' }
export interface VisionRequest extends TextRequest { image: Buffer }
export interface SpeechRequest { text: string; lang: 'vi' | 'en' }

export interface AI {
  name: string;
  json<T>(req: TextRequest): Promise<T>;
  image(req: ImageRequest): Promise<Buffer>;     // PNG or JPEG bytes
  see<T>(req: VisionRequest): Promise<T>;
  speak(req: SpeechRequest): Promise<Buffer>;    // WAV bytes
}
