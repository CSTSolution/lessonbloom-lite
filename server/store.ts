// Storage behind one small document interface: LocalStore (JSON files under data/) for
// development and tests, GcpStore (Firestore + Cloud Storage) on Cloud Run.
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './config.ts';

export type Coll = 'teachers' | 'classes' | 'pupils' | 'lessons' | 'assignments' | 'attempts' | 'selfchecks' | 'cache';

export interface Store {
  get<T>(coll: Coll, id: string): Promise<T | null>;
  put<T extends { id: string }>(coll: Coll, doc: T): Promise<void>;
  putMany<T extends { id: string }>(coll: Coll, docs: T[]): Promise<void>;
  find<T>(coll: Coll, field: string, value: string): Promise<T[]>;     // equality filter
  list<T>(coll: Coll, limit?: number): Promise<T[]>;
  putFile(folder: string, name: string, data: Buffer, type: string): Promise<string>;   // returns a /media URL
  getFile(folder: string, name: string): Promise<Buffer | null>;
}

const safe = (s: string) => { if (!/^[\w.-]{1,120}$/.test(s)) throw new Error(`bad name: ${s}`); return s; };

export class LocalStore implements Store {
  private mem = new Map<string, Map<string, unknown>>();       // read cache; files are the truth
  constructor(private root = config.dataDir) {}

  private async coll(c: Coll): Promise<Map<string, unknown>> {
    let m = this.mem.get(c);
    if (m) return m;
    m = new Map();
    const dir = join(this.root, c);
    if (existsSync(dir)) for (const f of await readdir(dir)) if (f.endsWith('.json')) m.set(f.slice(0, -5), JSON.parse(await readFile(join(dir, f), 'utf8')));
    this.mem.set(c, m);
    return m;
  }
  async get<T>(c: Coll, id: string) { return ((await this.coll(c)).get(safe(id)) as T) ?? null; }
  async put<T extends { id: string }>(c: Coll, doc: T) {
    const dir = join(this.root, c), f = join(dir, `${safe(doc.id)}.json`);
    (await this.coll(c)).set(doc.id, structuredClone(doc));
    await mkdir(dir, { recursive: true });
    const tmp = `${f}.${process.pid}.${Math.random().toString(36).slice(2)}`;   // write-then-rename: never half a file
    await writeFile(tmp, JSON.stringify(doc));
    await rename(tmp, f);
  }
  async putMany<T extends { id: string }>(c: Coll, docs: T[]) { for (const d of docs) await this.put(c, d); }
  async find<T>(c: Coll, field: string, value: string) {
    return [...(await this.coll(c)).values()].filter((d) => (d as Record<string, unknown>)[field] === value).map((d) => structuredClone(d) as T);
  }
  async list<T>(c: Coll, limit = 1000) { return [...(await this.coll(c)).values()].slice(0, limit).map((d) => structuredClone(d) as T); }
  async putFile(folder: string, name: string, data: Buffer) {
    const dir = join(this.root, 'media', safe(folder));
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, safe(name)), data);
    return `/media/${folder}/${name}`;
  }
  async getFile(folder: string, name: string) {
    const f = join(this.root, 'media', safe(folder), safe(name));
    return existsSync(f) ? readFile(f) : null;
  }
}
