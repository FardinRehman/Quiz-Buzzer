import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initBrowserEngine } from './mock/browserEngine.js';

initBrowserEngine();

createRoot(document.getElementById('root')!).render(<App />);
