FROM node:24-bookworm-slim

RUN npm install --global --omit=dev typescript@7.0.2 typescript-language-server@6.0.0 \
    && npm cache clean --force

WORKDIR /opt/decrypter-tools
COPY tool-worker.cjs /opt/decrypter-tools/tool-worker.cjs

ENV NODE_ENV=production \
    HOME=/tmp \
    DECRYPTER_WORKSPACE_ROOT=/workspace \
    PORT=8787

USER node
EXPOSE 8787
CMD ["node", "/opt/decrypter-tools/tool-worker.cjs"]
