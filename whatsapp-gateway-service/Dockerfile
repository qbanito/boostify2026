# syntax=docker/dockerfile:1
# Image for boostify-whatsapp-gateway (Node + OpenWA/Chromium).
FROM node:20-slim

# Chromium runtime deps for wa-automate's headless browser.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 \
    libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 \
    libgcc-s1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
    libx11-6 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 \
    libxkbcommon0 libxrandr2 wget xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# Use the system Chromium (skip Puppeteer's bundled download).
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./

EXPOSE 8002
CMD ["node", "server.js"]
