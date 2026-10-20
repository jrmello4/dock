import './style.css';
import { AppUI } from './app';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('app');
  if (root) {
    const app = new AppUI(root);
    app.init();
  }
});
