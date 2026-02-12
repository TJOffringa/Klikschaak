import './styles/main.css';
import './styles/multiplayer.css';
import './styles/analysis.css';
import { initLanguage } from './i18n/translations';
import { initGame } from './game/actions';
import { renderBoard, updateUI } from './ui/render';
import { initDragAndDrop } from './ui/dragdrop';
import { initAuthUI } from './ui/authUI';
import { initAnalysisButton } from './ui/analysisUI.js';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

// Initialize language from localStorage or browser settings
initLanguage();

// Configure native status bar when running in an app
if (Capacitor.isNativePlatform()) {
  StatusBar.setBackgroundColor({ color: '#1a1a2e' });
  StatusBar.setStyle({ style: Style.Dark });
  document.body.style.paddingTop = '40px';
  document.body.style.paddingBottom = '20px';
}

// Initialize game on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initGame();
  initDragAndDrop();
  initAuthUI();
  initAnalysisButton();
  updateStaticTexts();
});

function updateStaticTexts(): void {
  // This is handled by the render module after language switch
  // Initial render uses default texts from HTML
}

// Export for use in HTML onclick handlers
export { initGame, renderBoard, updateUI };
