// Galerie Fancy Theme - Preact SPA Entry Point

import '../styles/main.scss';
import { render } from 'preact';
import { App } from './components/App';

// Mount the app
const root = document.getElementById('root');
if (root) {
  render(<App />, root);
} else {
  console.error('Root element not found');
}
