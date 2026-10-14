# One Cloud Run service: API + built web app. Debian's Chromium and ffmpeg render the lesson
# video (slides + Text-to-Speech) inside the container.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg chromium fonts-noto-core fonts-noto-color-emoji ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=8080 CHROMIUM_PATH=/usr/bin/chromium
COPY package*.json ./
RUN npm ci --omit=dev && npm install --no-save tsx@4
COPY server ./server
COPY --from=build /app/web/dist ./web/dist
EXPOSE 8080
CMD ["npx", "tsx", "server/main.ts"]
