import { initLanguage } from './i18n/translations';
import { initGame } from './game/actions';
import { renderBoard, updateUI } from './ui/render';

// Initialize language from localStorage or browser settings
initLanguage();

// Initialize game on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initGame();
  updateStaticTexts();
});

function updateStaticTexts(): void {
  // This is handled by the render module after language switch
  // Initial render uses default texts from HTML
}

// Export for use in HTML onclick handlers
export { initGame, renderBoard, updateUI };
