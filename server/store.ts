// Storage behind one interface: LocalStore (files under data/) for development, and the
// Google Cloud store (Firestore + Cloud Storage) when deployed. Pupil results are anonymous.
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './config.ts';
import type { Lesson, Submission } from './types.ts';

export interface Store {
  getLesson(id: string): Promise<Lesson | null>;
  putLesson(l: Lesson): Promise<void>;
  findShare(shareId: string): Promise<Lesson | null>;
  addSubmission(s: Submission): Promise<void>;
  submissions(shareId: string): Promise<Submission[]>;
  putFile(lessonId: string, name: string, data: Buffer, type: string): Promise<string>;   // returns a URL path
  getFile(lessonId: string, name: string): Promise<Buffer | null>;
}

const safe = (s: string) => { if (!/^[\w.-]+$/.test(s)) throw new Error(`bad name: ${s}`); return s; };

export class LocalStore implements Store {
  constructor(private root = config.dataDir) {}
  private dir(id: string) { return join(this.root, safe(id)); }

  async getLesson(id: string) {
    const f = join(this.dir(id), 'lesson.json');
    return existsSync(f) ? JSON.parse(await readFile(f, 'utf8')) as Lesson : null;
  }
  async putLesson(l: Lesson) {
    await mkdir(this.dir(l.id), { recursive: true });
    // write-then-rename: progress updates arrive concurrently and must never leave half a file
    const f = join(this.dir(l.id), 'lesson.json'), tmp = `${f}.${process.pid}.${Math.random().toString(36).slice(2)}`;
    await writeFile(tmp, JSON.stringify(l, null, 1));
    await rename(tmp, f);
    if (l.shareId) await writeFile(join(this.root, `share_${safe(l.shareId)}`), l.id);
  }
  async findShare(shareId: string) {
    const f = join(this.root, `share_${safe(shareId)}`);
    return existsSync(f) ? this.getLesson((await readFile(f, 'utf8')).trim()) : null;
  }
  async addSubmission(s: Submission) {
    await mkdir(this.root, { recursive: true });
    await appendFile(join(this.root, `subs_${safe(s.shareId)}.jsonl`), JSON.stringify(s) + '\n');
  }
  async submissions(shareId: string) {
    const f = join(this.root, `subs_${safe(shareId)}.jsonl`);
    return existsSync(f) ? (await readFile(f, 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l) as Submission) : [];
  }
  async putFile(lessonId: string, name: string, data: Buffer) {
    await mkdir(this.dir(lessonId), { recursive: true });
    await writeFile(join(this.dir(lessonId), safe(name)), data);
    return `/media/${lessonId}/${name}`;
  }
  async getFile(lessonId: string, name: string) {
    const f = join(this.dir(lessonId), safe(name));
    return existsSync(f) ? readFile(f) : null;
  }
}
