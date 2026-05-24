# OmniPlug CMS Core v1.4 production image.

FROM node:22-bookworm-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev --no-audit --no-fund; \
    else \
      npm install --omit=dev --no-audit --no-fund; \
    fi

FROM node:22-bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    tini ca-certificates sqlite3 \
 && rm -rf /var/lib/apt/lists/*

RUN groupadd -r app && useradd -r -g app -d /app -s /usr/sbin/nologin app

WORKDIR /app

COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --chown=app:app package.json package-lock.json* ./
COPY --chown=app:app src ./src
COPY --chown=app:app scripts ./scripts
COPY --chown=app:app keys ./keys

RUN mkdir -p /app/data /app/uploads /app/backups && \
    chmod +x /app/scripts/start.sh /app/scripts/backup.sh /app/scripts/restore.sh /app/scripts/set-platform-admin.js && \
    find /app/keys -type f -exec chmod 0644 {} + && \
    chown -R app:app /app/data /app/uploads /app/backups /app/scripts

USER app

ENV NODE_ENV=production
ENV PORT=4000
ENV DB_PATH=/app/data/cms.db
ENV UPLOAD_DIR=/app/uploads
ENV BACKUP_DIR=/app/backups

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# v1.4.3 QA fix: pass -s to tini so it registers as a child subreaper when
# Fly.io's machine init owns PID 1. Without this, the warning "Tini is not
# running as PID 1 and isn't registered as a child subreaper" appears at boot
# and orphan child processes (e.g. crashed migration scripts) wouldn't be reaped.
# Setting TINI_SUBREAPER env var has the same effect; -s is explicit and safer.
ENTRYPOINT ["/usr/bin/tini", "-s", "--"]
CMD ["./scripts/start.sh"]
