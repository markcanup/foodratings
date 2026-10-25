FROM docker.io/library/node:22-bookworm-slim

WORKDIR /app

RUN chown node:node /app
USER node

# Copy dependency manifests first so this layer is reused until they change.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# The build context is the repository root (the folder containing this file).
# Supabase settings are provided when the container starts, never baked in.
COPY --chown=node:node . ./

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
