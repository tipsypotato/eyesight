import { failStartup, loadEyeEngine, setStartupStage } from './startup';

setStartupStage('interface');
// Start both downloads together; the viewport reports engine failures when it mounts.
void loadEyeEngine().catch(() => {});
void import('./main').catch(() => failStartup());
