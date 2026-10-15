// Store on Google Cloud: Firestore documents + a private Cloud Storage bucket for media.
// Cloud Run's service account authenticates both; there are no keys in code or config.
// Media is served through the API (/media/...), so the bucket is never public.
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import type { Coll, Store } from './store.ts';

export class GcpStore implements Store {
  private db = new Firestore({ ignoreUndefinedProperties: true });
  private bucket;
  constructor(bucketName: string) { this.bucket = new Storage().bucket(bucketName); }

  async get<T>(c: Coll, id: string) {
    const d = await this.db.collection(c).doc(id).get();
    return d.exists ? (d.data() as T) : null;
  }
  async put<T extends { id: string }>(c: Coll, doc: T) { await this.db.collection(c).doc(doc.id).set(doc as object); }
  async putMany<T extends { id: string }>(c: Coll, docs: T[]) {
    for (let i = 0; i < docs.length; i += 400) {
      const b = this.db.batch();
      for (const d of docs.slice(i, i + 400)) b.set(this.db.collection(c).doc(d.id), d as object);
      await b.commit();
    }
  }
  async find<T>(c: Coll, field: string, value: string) {
    const q = await this.db.collection(c).where(field, '==', value).limit(5000).get();
    return q.docs.map((d) => d.data() as T);
  }
  async list<T>(c: Coll, limit = 1000) { return (await this.db.collection(c).limit(limit).get()).docs.map((d) => d.data() as T); }
  async putFile(folder: string, name: string, data: Buffer, type: string) {
    await this.bucket.file(`${folder}/${name}`).save(data, { contentType: type, resumable: false });
    return `/media/${folder}/${name}`;
  }
  async getFile(folder: string, name: string) {
    const f = this.bucket.file(`${folder}/${name}`);
    const [exists] = await f.exists();
    return exists ? (await f.download())[0] : null;
  }
}
