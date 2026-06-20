FROM node:24-slim

WORKDIR /app

# Install OpenClaw globally
RUN npm install -g openclaw@latest

# Create workspace directory
RUN mkdir -p /root/.openclaw/workspace

# Copy config
COPY openclaw.config.json /root/.openclaw/openclaw.json

# Only bind to loopback inside container — expose via reverse proxy
EXPOSE 18789

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://127.0.0.1:18789/api/health || exit 1

# Start gateway
CMD ["openclaw", "gateway", "--port", "18789", "--bind", "127.0.0.1"]
