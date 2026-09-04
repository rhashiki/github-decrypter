import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const PWA_CACHE_PREFIX = 'gd-studio-shell-';
const PWA_CACHE_NAME = `${PWA_CACHE_PREFIX}v28`;

function createServiceWorkerSource(shellFiles: readonly string[]): string {
  const uniqueShellFiles = [...new Set(shellFiles)].sort();
  return `'use strict';
const CACHE_PREFIX = ${JSON.stringify(PWA_CACHE_PREFIX)};
const CACHE_NAME = ${JSON.stringify(PWA_CACHE_NAME)};
const SHELL_FILES = ${JSON.stringify(uniqueShellFiles)};
const SHELL_URLS = SHELL_FILES.map((file) => new URL(file, self.registration.scope).href);
const SHELL_URL_SET = new Set(SHELL_URLS);
const INDEX_URL = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(INDEX_URL, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(INDEX_URL)) ?? Response.error()),
    );
    return;
  }

  requestUrl.search = '';
  requestUrl.hash = '';
  const shellUrl = requestUrl.href;
  if (!SHELL_URL_SET.has(shellUrl)) return;

  event.respondWith(
    caches.match(shellUrl).then(async (cached) => {
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(shellUrl, response.clone());
      }
      return response;
    }),
  );
});
`;
}

function studioPwaShellPlugin(): Plugin {
  return {
    name: 'gd-studio-pwa-shell',
    apply: 'build',
    generateBundle(_options, bundle) {
      const generatedFiles = Object.keys(bundle)
        .filter((fileName) => !fileName.endsWith('.map'))
        .map((fileName) => `./${fileName}`);
      const shellFiles = [
        './',
        './index.html',
        './manifest.webmanifest',
        './icons/icon-192.png',
        './icons/icon-512.png',
        ...generatedFiles,
      ];

      this.emitFile({
        type: 'asset',
        fileName: 'service-worker.js',
        source: createServiceWorkerSource(shellFiles),
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), studioPwaShellPlugin()],
  server: {
    host: '127.0.0.1',
    strictPort: false,
  },
  preview: {
    host: '127.0.0.1',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
