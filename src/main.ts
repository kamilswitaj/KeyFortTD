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
  window.__keyfortApp = controller;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
