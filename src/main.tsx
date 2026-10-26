import { createRoot } from 'react-dom/client';
import App, { ErrorBoundary } from './ui/App';
import { eyeStore } from './state/store';
import './styles/app.css';

eyeStore.getState().startPage();
createRoot(document.getElementById('root')!).render(<ErrorBoundary><App/></ErrorBoundary>);
