# One Cloud Run service: API + built web app. Chromium and ffmpeg are included for the
# slide video and PDF export (Playwright's image ships Chromium with the right libraries).
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-noto-core fonts-noto-color-emoji ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=8080
COPY package*.json ./
RUN npm ci --omit=dev && npm install --no-save tsx@4
COPY server ./server
COPY --from=build /app/web/dist ./web/dist
EXPOSE 8080
CMD ["npx", "tsx", "server/main.ts"]
