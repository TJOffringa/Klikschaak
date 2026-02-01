import './styles/main.css';
import './styles/multiplayer.css';
import { initLanguage } from './i18n/translations';
import { initGame } from './game/actions';
import { renderBoard, updateUI } from './ui/render';
import { initDragAndDrop } from './ui/dragdrop';
import { initAuthUI } from './ui/authUI';

// Initialize language from localStorage or browser settings
initLanguage();

// Initialize game on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initGame();
  initDragAndDrop();
  initAuthUI();
  updateStaticTexts();
});

function updateStaticTexts(): void {
  // This is handled by the render module after language switch
  // Initial render uses default texts from HTML
}

// Export for use in HTML onclick handlers
export { initGame, renderBoard, updateUI };
