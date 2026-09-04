import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StudioApp } from './App.js';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('GitHub Decrypter Studio root element is missing.');

createRoot(root).render(
  <StrictMode>
    <StudioApp />
  </StrictMode>,
);
