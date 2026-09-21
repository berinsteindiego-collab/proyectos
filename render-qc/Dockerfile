FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.mjs qc-logic.mjs session-store.mjs renew-session.mjs ./

ENV NODE_ENV=production
ENV PORT=10000

CMD ["node", "server.mjs"]
