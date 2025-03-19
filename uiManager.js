import * as THREE from 'three';
import { CONFIG } from './config.js';

export class UIManager {
  constructor(room) {
    this.room = room;
    
    // UI elements
    this.welcomeScreen = document.getElementById('welcome-screen');
    this.gameUI = document.getElementById('game-ui');
    this.constellationForm = document.getElementById('constellation-form');
    this.discoveryScreen = document.getElementById('discovery-screen');
    this.usernameInput = document.getElementById('username-input');
    this.startButton = document.getElementById('start-button');
    this.saveConstellationButton = document.getElementById('save-constellation-button');
    this.cancelConstellationButton = document.getElementById('cancel-constellation-button');
    this.continueExplorationButton = document.getElementById('continue-exploration-button');
    this.playerCountDisplay = document.getElementById('player-count');
    this.sectorCoordinates = document.getElementById('sector-coordinates');
    this.starCount = document.getElementById('star-count');
    this.constellationNameInput = document.getElementById('constellation-name-input');
    this.discoveryName = document.getElementById('discovery-name');
    this.discovererName = document.getElementById('discoverer-name');
    this.constellationStatus = document.getElementById('constellation-status');
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Callbacks
    this.onStartGame = null;
    this.onSaveConstellation = null;
    this.onCancelConstellation = null;
  }
  
  setupEventListeners() {
    // Start button
    this.startButton.addEventListener('click', () => {
      if (this.onStartGame) {
        const username = this.usernameInput.value.trim() || 
                        `Explorer-${Math.floor(Math.random() * 1000)}`;
        this.onStartGame(username);
      }
    });
    
    // Save constellation button
    this.saveConstellationButton.addEventListener('click', () => {
      if (this.onSaveConstellation) {
        const name = this.constellationNameInput.value.trim() || 
                    `Unnamed-${Math.floor(Math.random() * 1000)}`;
        this.onSaveConstellation(name);
      }
    });
    
    // Cancel constellation button
    this.cancelConstellationButton.addEventListener('click', () => {
      if (this.onCancelConstellation) {
        this.onCancelConstellation();
      }
    });
    
    // Continue exploration button
    this.continueExplorationButton.addEventListener('click', () => {
      this.hideDiscoveryScreen();
    });
  }
  
  showWelcomeScreen() {
    this.welcomeScreen.classList.remove('hidden');
    this.gameUI.classList.add('hidden');
    this.constellationForm.classList.add('hidden');
    this.discoveryScreen.classList.add('hidden');
  }
  
  hideWelcomeScreen() {
    this.welcomeScreen.classList.add('hidden');
    this.gameUI.classList.remove('hidden');
  }
  
  showConstellationForm(starCount) {
    this.starCount.textContent = starCount;
    this.constellationForm.classList.remove('hidden');
    this.constellationNameInput.value = '';
    this.constellationNameInput.focus();
  }
  
  hideConstellationForm() {
    this.constellationForm.classList.add('hidden');
  }
  
  showDiscoveryScreen(constellationName, discoverer) {
    this.discoveryName.textContent = constellationName;
    this.discovererName.textContent = discoverer;
    this.discoveryScreen.classList.remove('hidden');
  }
  
  hideDiscoveryScreen() {
    this.discoveryScreen.classList.add('hidden');
  }
  
  updatePlayerCount(count) {
    this.playerCountDisplay.textContent = count;
  }
  
  updateSectorCoordinates(x, y, z) {
    this.sectorCoordinates.textContent = `${x},${y},${z}`;
  }
  
  updateConstellationStatus(message, isHighlight = false) {
    this.constellationStatus.textContent = message;
    
    if (isHighlight) {
      this.constellationStatus.style.color = '#ffeb3b';
      // Reset after 3 seconds
      setTimeout(() => {
        this.constellationStatus.style.color = '';
      }, 3000);
    }
  }
  
  createInfoPopup(message, duration = 5000) {
    const popup = document.createElement('div');
    popup.className = 'info-popup';
    popup.textContent = message;
    
    document.body.appendChild(popup);
    
    setTimeout(() => {
      popup.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(popup);
      }, 300);
    }, duration);
  }
}