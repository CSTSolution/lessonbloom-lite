#!/usr/bin/env bash
# Deploy LessonBloom to Cloud Run (one service: API + web) with Vertex AI, Firestore and Cloud Storage.
# Usage: ./deploy.sh            (first run also enables APIs and creates the bucket and database)
# Needs: gcloud auth login, Owner on the project. Costs: pay-per-use, within free tiers at demo scale.
set -euo pipefail
PROJECT=${PROJECT:-your-project-id}
REGION=${REGION:-asia-southeast1}
SERVICE=${SERVICE:-lessonbloom}
BUCKET=${BUCKET:-lessonbloom-media-${PROJECT:8:8}}
SA=lessonbloom-run@${PROJECT}.iam.gserviceaccount.com
gcloud config set project "$PROJECT" >/dev/null

echo "== APIs"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  aiplatform.googleapis.com firestore.googleapis.com storage.googleapis.com texttospeech.googleapis.com

echo "== Service account"
gcloud iam service-accounts describe "$SA" >/dev/null 2>&1 || gcloud iam service-accounts create lessonbloom-run --display-name "LessonBloom on Cloud Run"
for ROLE in roles/aiplatform.user roles/datastore.user; do
  gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA" --role "$ROLE" --condition=None >/dev/null
done

echo "== Firestore (Native mode)"
gcloud firestore databases describe --database='(default)' >/dev/null 2>&1 || gcloud firestore databases create --location="$REGION" --type=firestore-native

echo "== Bucket (private)"
gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1 || gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member "serviceAccount:$SA" --role roles/storage.objectAdmin >/dev/null

echo "== Deploy (Cloud Build from source)"
# --no-cpu-throttling: lessons are generated in the background after the request returns.
gcloud run deploy "$SERVICE" --source . --region "$REGION" --service-account "$SA" --allow-unauthenticated \
  --cpu 2 --memory 2Gi --timeout 900 --concurrency 20 --min-instances 0 --max-instances 3 --no-cpu-throttling \
  --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=$PROJECT,GOOGLE_CLOUD_LOCATION=global,LB_BUCKET=$BUCKET,LB_MONTH_USD=${MONTH_USD:-40},LB_DAY_USD=${DAY_USD:-8}"

gcloud run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)'
