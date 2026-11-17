/// <reference types="vite/client" />
import './styles/main.css';
import { AppController } from './ui/AppController';

declare global {
  interface Window {
    __keyfortApp?: AppController;
  }
}

function bootstrap(): void {
  const appRoot = document.getElementById('app');
  if (!appRoot) {
    throw new Error('Missing #app root element');
  }
  const controller = new AppController(appRoot);
  if (
    import.meta.env.DEV ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    window.__keyfortApp = controller;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
