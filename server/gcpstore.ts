// Store on Google Cloud: Firestore for lessons and anonymous submissions, Cloud Storage for
// images, audio, PDF and video. Cloud Run's service account authenticates both; no keys.
// Media is served through /media/... by the API, so the bucket stays private.
import { Firestore } from '@google-cloud/firestore';
import { Storage } from '@google-cloud/storage';
import type { Store } from './store.ts';
import type { Lesson, Submission } from './types.ts';

export class GcpStore implements Store {
  private db = new Firestore({ ignoreUndefinedProperties: true });
  private bucket;

  constructor(bucketName: string) {
    this.bucket = new Storage().bucket(bucketName);
  }

  async getLesson(id: string) {
    const d = await this.db.collection('lessons').doc(id).get();
    return d.exists ? (d.data() as Lesson) : null;
  }
  async putLesson(l: Lesson) {
    await this.db.collection('lessons').doc(l.id).set(l);
    if (l.shareId) await this.db.collection('shares').doc(l.shareId).set({ lessonId: l.id });
  }
  async findShare(shareId: string) {
    const d = await this.db.collection('shares').doc(shareId).get();
    return d.exists ? this.getLesson(d.get('lessonId')) : null;
  }
  async addSubmission(s: Submission) {
    await this.db.collection('shares').doc(s.shareId).collection('submissions').add(s);
  }
  async submissions(shareId: string) {
    const q = await this.db.collection('shares').doc(shareId).collection('submissions').orderBy('at').limit(2000).get();
    return q.docs.map((d) => d.data() as Submission);
  }
  async putFile(lessonId: string, name: string, data: Buffer, type: string) {
    await this.bucket.file(`${lessonId}/${name}`).save(data, { contentType: type, resumable: false });
    return `/media/${lessonId}/${name}`;
  }
  async getFile(lessonId: string, name: string) {
    const f = this.bucket.file(`${lessonId}/${name}`);
    const [exists] = await f.exists();
    return exists ? (await f.download())[0] : null;
  }
}
