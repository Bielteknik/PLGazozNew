import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log("Sistem: main.tsx yüklendi.");

window.onerror = function(msg, url, line) {
  alert("HATA YAKALANDI: " + msg + "\nSatır: " + line);
  return false;
};

const rootElement = document.getElementById('root');
if (rootElement) {
  console.log("Sistem: Root element bulundu, render başlıyor.");
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  console.error("Sistem: Root element BULUNAMADI!");
}
