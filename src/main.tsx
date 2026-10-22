import { createRoot } from 'react-dom/client';
import App, { ErrorBoundary } from './ui/App';
import './styles/app.css';

createRoot(document.getElementById('root')!).render(<ErrorBoundary><App/></ErrorBoundary>);
