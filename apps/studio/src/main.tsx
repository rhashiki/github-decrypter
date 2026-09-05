import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@github-decrypter/ui/styles.css';
import { StudioApp } from './App.js';
import { registerStudioPwa } from './pwa.js';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('GitHub Decrypter Studio root element is missing.');

createRoot(root).render(
  <StrictMode>
    <StudioApp />
  </StrictMode>,
);

window.addEventListener('load', () => {
  void registerStudioPwa();
}, { once: true });
