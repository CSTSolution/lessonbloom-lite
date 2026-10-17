#!/usr/bin/env bash
# Deploy LessonBloom to Cloud Run (one service: API + web) with Vertex AI, Firestore and Cloud Storage.
# Usage: ./deploy.sh            (first run also enables APIs and creates the bucket and database)
# Needs: gcloud auth login, Owner on the project. Costs: pay-per-use, within free tiers at demo scale.
set -euo pipefail
PROJECT=${PROJECT:?set PROJECT=<your-project-id>}
REGION=${REGION:-asia-southeast1}
SERVICE=${SERVICE:-lessonbloom}
BUCKET=${BUCKET:-lessonbloom-media-${PROJECT:8:8}}
SA=lessonbloom-run@${PROJECT}.iam.gserviceaccount.com
gcloud config set project "$PROJECT" >/dev/null

echo "== APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  aiplatform.googleapis.com firestore.googleapis.com storage.googleapis.com texttospeech.googleapis.com secretmanager.googleapis.com

echo "== Service account"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 || gcloud iam service-accounts create lessonbloom-run --display-name "LessonBloom on Cloud Run"
# firebaseauth.admin: the server creates accounts and resets passwords after the emailed code checks out
for ROLE in roles/aiplatform.user roles/datastore.user roles/firebaseauth.admin; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" --role "$ROLE" --condition=None >/dev/null
done

echo "== Firestore (Native mode)"
gcloud firestore databases describe --database='(default)' >/dev/null 2>&1 || gcloud firestore databases create --location="$REGION" --type=firestore-native

echo "== Bucket (private)"
gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 || gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member "serviceAccount:$SA" --role roles/storage.objectAdmin >/dev/null

echo "== Admin key (Secret Manager; local copy in ~/.config/lessonbloom/admin-key, never in the repo)"
KEYFILE="$HOME/.config/lessonbloom/admin-key"
if ! gcloud secrets describe lb-admin-key >/dev/null 2>&1; then
  mkdir -p "$(dirname "$KEYFILE")"; umask 077
  [ -s "$KEYFILE" ] || openssl rand -base64 36 | tr -d '/+=\n' | cut -c1-40 > "$KEYFILE"
  gcloud secrets create lb-admin-key --replication-policy=automatic --data-file="$KEYFILE" >/dev/null
fi
gcloud secrets add-iam-policy-binding lb-admin-key --member "serviceAccount:$SA" --role roles/secretmanager.secretAccessor >/dev/null

echo "== SMTP key for the code emails (optional; from the SMTP_KEY environment variable on the first run, never printed or committed)"
if ! gcloud secrets describe lb-smtp-key >/dev/null 2>&1 && [ -n "${SMTP_KEY:-}" ]; then
  printf %s "$SMTP_KEY" | gcloud secrets create lb-smtp-key --replication-policy=automatic --data-file=- >/dev/null
fi
SMTP_SECRET=""
if gcloud secrets describe lb-smtp-key >/dev/null 2>&1; then
  gcloud secrets add-iam-policy-binding lb-smtp-key --member "serviceAccount:$SA" --role roles/secretmanager.secretAccessor >/dev/null
  SMTP_SECRET=",LB_SMTP_KEY=lb-smtp-key:latest"
fi

# Firebase web config (public by design) from Project settings > Your apps; enables teacher sign-in
FBCFG="$HOME/.config/lessonbloom/firebase-web.json"
FB_ENV=""
[ -s "$FBCFG" ] && FB_ENV="|LB_FIREBASE_CONFIG=$(tr -d '\n ' < "$FBCFG")|LB_ADMIN_EMAILS=${ADMIN_EMAILS:-}"

echo "== Build permission (newer projects build as the default compute account)"
NUM=$(gcloud projects describe "$PROJECT" --format="value(projectNumber)")
gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:${NUM}-compute@developer.gserviceaccount.com" --role roles/run.builder --condition=None >/dev/null

echo "== Deploy (Cloud Build from source)"
# --no-cpu-throttling: lessons are generated in the background after the request returns.
gcloud run deploy "$SERVICE" --source . --region "$REGION" --service-account "$SA" --allow-unauthenticated \
  --cpu 2 --memory 2Gi --timeout 900 --concurrency 20 --min-instances 0 --max-instances 3 --no-cpu-throttling \
  --set-secrets "LB_ADMIN_KEY=lb-admin-key:latest${SMTP_SECRET}" --set-env-vars "^|^GOOGLE_GENAI_USE_VERTEXAI=true|GOOGLE_CLOUD_PROJECT=$PROJECT|GOOGLE_CLOUD_LOCATION=global|LB_BUCKET=$BUCKET|LB_MONTH_USD=${MONTH_USD:-40}|LB_DAY_USD=${DAY_USD:-10}|LB_MODEL_IMAGE=${IMAGE_MODEL:-gemini-3.1-flash-image}|SMTP_USER=${SMTP_USER:-}|SMTP_SERVER=${SMTP_SERVER:-}|LB_MAIL_FROM=${LB_MAIL_FROM:-}${FB_ENV}"

gcloud run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)'
