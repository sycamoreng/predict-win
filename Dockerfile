# syntax=docker/dockerfile:1.7

# ---------- Build stage ----------
FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

COPY package*.json ./

# Mount GH Packages token as a build-time secret. Token is only
# available during this RUN and is NOT persisted in any image layer.
RUN --mount=type=secret,id=gh_token,required=true \
    printf "@sycamoreng:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=%s\n" \
      "$(cat /run/secrets/gh_token)" > .npmrc && \
    npm ci && \
    rm -f .npmrc

COPY . .
RUN npm run build


# ---------- Runtime stage ----------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV NITRO_PORT=3000

# Drop npm from the runtime image. Not needed at runtime, and removes
# CVEs from npm's bundled deps (e.g. picomatch ReDoS).
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx

# Non-root user, matching Hub
RUN addgroup -g 1994 -S nodejs \
 && adduser  -u 1994 -S nuxt -G nodejs

COPY --from=builder --chown=nuxt:nodejs /app/.output ./.output

USER nuxt

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]