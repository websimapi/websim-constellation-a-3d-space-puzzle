import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from './config.js';
import { StarGenerator } from './starGenerator.js';
import { SpaceChunkManager } from './spaceChunks.js';
import { ConstellationManager } from './constellationManager.js';
import { PlayerController } from './playerController.js';
import { UIManager } from './uiManager.js';

class ConstellationExplorer {
  constructor() {
    // Initialize multiplayer connection
    this.room = new WebsimSocket();
    
    // DOM elements
    this.canvas = document.getElementById('game-canvas');
    
    // Game state
    this.gameActive = false;
    this.selectedStar = null;
    this.isDragging = false;
    
    // Initialize Three.js
    this.initThreeJS();
    
    // Initialize UI manager
    this.uiManager = new UIManager(this.room);
    this.setupUICallbacks();
    
    // Initialize star generator
    this.starGenerator = new StarGenerator(this.scene);
    
    // Initialize chunk manager
    this.chunkManager = new SpaceChunkManager(this.scene, this.starGenerator);
    
    // Initialize constellation manager
    this.constellationManager = new ConstellationManager(this.scene, this.room);
    
    // Initialize player controller after creating the ship
    this.createPlayerShip();
    this.playerController = new PlayerController(
      this.scene, 
      this.camera, 
      this.shipGroup, 
      this.room
    );
    
    // Initialize raycaster for star selection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Setup subscriptions and event listeners
    this.setupEventListeners();
    
    // Start the render loop
    this.animate();
  }
  
  setupUICallbacks() {
    // Start game callback
    this.uiManager.onStartGame = (username) => {
      this.startGame(username);
    };
    
    // Save constellation callback
    this.uiManager.onSaveConstellation = (name) => {
      this.saveConstellation(name);
    };
    
    // Cancel constellation callback
    this.uiManager.onCancelConstellation = () => {
      this.cancelConstellation();
    };
  }
  
  setupEventListeners() {
    // Mouse events for star connections
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this.onMouseUp());
    
    // Key press for constellation naming
    window.addEventListener('keydown', (e) => {
      if (e.key === 'n' && this.gameActive) {
        this.checkAndShowConstellationForm();
      }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
    
    // Subscribe to presence changes
    this.room.party.subscribePresence(presence => {
      if (this.playerController) {
        this.playerController.updateOtherPlayers(presence);
      }
      
      if (this.constellationManager) {
        this.constellationManager.drawOtherPlayersConnections(presence);
      }
      
      // Update player count in UI
      this.uiManager.updatePlayerCount(Object.keys(this.room.party.peers).length);
    });
    
    // Handle messages
    this.room.onmessage = (event) => {
      const data = event.data;
      
      switch (data.type) {
        case "connected":
          console.log(`Explorer connected: ${data.username} (${data.clientId})`);
          this.uiManager.createInfoPopup(`${data.username} has joined the exploration`, 3000);
          break;
          
        case "disconnected":
          console.log(`Explorer disconnected: ${data.username} (${data.clientId})`);
          break;
          
        case "constellation_discovered":
          // Show discovery notification
          this.uiManager.showDiscoveryScreen(data.name, data.discoverer);
          this.uiManager.createInfoPopup(`${data.discoverer} discovered "${data.name}"!`, 5000);
          break;
      }
    };
  }
  
  initThreeJS() {
    // Scene setup
    this.scene = new THREE.Scene();
    
    // Camera setup
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    
    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Create the cosmic background
    this.createCosmicBackground();
  }
  
  createCosmicBackground() {
    // Create a skybox with a gradient
    const vertexShader = `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    
    const fragmentShader = `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `;
    
    const uniforms = {
      topColor: { value: new THREE.Color(0x0077ff) },
      bottomColor: { value: new THREE.Color(0x000000) },
      offset: { value: 100 },
      exponent: { value: 0.6 }
    };
    
    const skyGeo = new THREE.SphereGeometry(CONFIG.starFieldRadius * 1.5, 32, 32);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: THREE.BackSide
    });
    
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);
  }
  
  createPlayerShip() {
    // Create a simple ship using a cone
    const shipGeometry = new THREE.ConeGeometry(5, 15, 4);
    const shipMaterial = new THREE.MeshBasicMaterial({
      color: 0x2979ff,
      wireframe: true
    });
    
    this.playerShip = new THREE.Mesh(shipGeometry, shipMaterial);
    this.playerShip.rotation.x = Math.PI / 2; // Orient the cone to point forward
    
    // Create a group for the camera to follow the ship
    this.shipGroup = new THREE.Group();
    this.shipGroup.add(this.playerShip);
    this.scene.add(this.shipGroup);
    
    // Add the camera to the ship group
    this.shipGroup.add(this.camera);
    this.camera.position.set(0, 25, 50);
    this.camera.lookAt(this.playerShip.position);
  }
  
  startGame(username) {
    // Hide welcome screen
    this.uiManager.hideWelcomeScreen();
    
    // Set game as active
    this.gameActive = true;
    
    // Update presence with initial position and username
    this.room.party.updatePresence({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      username: username
    });
    
    // Load initial chunks
    this.chunkManager.updateChunks(this.shipGroup.position);
    
    // Update sector coordinates in UI
    this.updateSectorDisplay();
  }
  
  updateSectorDisplay() {
    const pos = this.shipGroup.position;
    const chunkCoords = this.chunkManager.worldToChunkCoords(pos.x, pos.y, pos.z);
    this.uiManager.updateSectorCoordinates(chunkCoords.x, chunkCoords.y, chunkCoords.z);
  }
  
  checkAndShowConstellationForm() {
    // Check if current connections form a valid constellation
    const result = this.constellationManager.checkForNewConstellation();
    
    if (result && result.isNew && result.starCount >= CONFIG.minStarsForConstellation) {
      // Show constellation naming form
      this.uiManager.showConstellationForm(result.starCount);
      this.pendingConstellation = result.starGraph;
    } else if (result && !result.isNew) {
      // Already discovered
      this.uiManager.updateConstellationStatus(
        `Already discovered: ${result.constellation.name}`, 
        true
      );
    } else if (this.constellationManager.activeConnections.length > 0) {
      // Not enough stars or not a valid constellation
      this.uiManager.updateConstellationStatus(
        `Not a valid constellation (need ${CONFIG.minStarsForConstellation}+ connected stars)`, 
        true
      );
    }
  }
  
  async saveConstellation(name) {
    if (!this.pendingConstellation) return;
    
    try {
      // Save to database
      const constellation = await this.constellationManager.saveConstellation(
        name, 
        this.pendingConstellation
      );
      
      // Hide the form
      this.uiManager.hideConstellationForm();
      
      // Clear current connections
      this.constellationManager.clearConnections();
      
      // Notify other players
      this.room.send({
        type: "constellation_discovered",
        name: constellation.name,
        discoverer: this.room.party.client.username
      });
      
      // Show discovery screen
      this.uiManager.showDiscoveryScreen(
        constellation.name, 
        this.room.party.client.username
      );
      
      // Update status
      this.uiManager.updateConstellationStatus("Exploring");
      
      // Clear pending constellation
      this.pendingConstellation = null;
    } catch (error) {
      console.error("Error saving constellation:", error);
      this.uiManager.createInfoPopup("Failed to save constellation", 3000);
    }
  }
  
  cancelConstellation() {
    this.uiManager.hideConstellationForm();
    this.pendingConstellation = null;
  }
  
  onMouseDown(event) {
    if (!this.gameActive) return;
    
    // Calculate mouse position
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the picking ray with the camera and mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Get all loaded stars
    const stars = this.chunkManager.getAllLoadedStars();
    
    // Calculate objects intersecting the picking ray
    const intersects = this.raycaster.intersectObjects(stars);
    
    if (intersects.length > 0) {
      this.selectedStar = intersects[0].object;
      this.isDragging = true;
    }
  }
  
  onMouseMove(event) {
    if (!this.isDragging || !this.selectedStar || !this.gameActive) return;
    
    // Update mouse position
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the picking ray
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Get all loaded stars
    const stars = this.chunkManager.getAllLoadedStars();
    
    // Check for other stars
    const intersects = this.raycaster.intersectObjects(stars);
    
    if (intersects.length > 0 && intersects[0].object !== this.selectedStar) {
      const targetStar = intersects[0].object;
      
      // Try to add connection
      this.constellationManager.addConnection(this.selectedStar, targetStar);
      
      // Update the selected star to the new one for continuous connection drawing
      this.selectedStar = targetStar;
    }
  }
  
  onMouseUp() {
    this.isDragging = false;
    this.selectedStar = null;
  }
  
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    if (this.gameActive) {
      // Update player controls
      this.playerController.update();
      
      // Update chunks based on player position
      this.chunkManager.updateChunks(this.shipGroup.position);
      
      // Update sector display whenever position changes significantly
      if (this.frameCount % 30 === 0) {
        this.updateSectorDisplay();
      }
    }
    
    // Increment frame counter
    this.frameCount = (this.frameCount || 0) + 1;
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize the game when the DOM is fully loaded
window.addEventListener('DOMContentLoaded', () => {
  const explorer = new ConstellationExplorer();
});