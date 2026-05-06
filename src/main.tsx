import { createRoot } from 'react-dom/client';

console.log("Sistem: main.tsx YUKLENDI!");

const rootElement = document.getElementById('root');
if (rootElement) {
  rootElement.innerHTML = '<h1 style="color: lime; font-family: sans-serif; padding: 20px;">REAKT MOTORU ÇALIŞIYOR!</h1>';
  console.log("Sistem: Ekrana yazi basildi.");
} else {
  console.error("Sistem: Root bulunamadi!");
}
