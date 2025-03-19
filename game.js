import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG } from './config.js';

class ConstellationGame {
  constructor() {
    // Initialize multiplayer connection
    this.room = new WebsimSocket();
    
    // DOM elements
    this.canvas = document.getElementById('game-canvas');
    this.welcomeScreen = document.getElementById('welcome-screen');
    this.gameUI = document.getElementById('game-ui');
    this.completionScreen = document.getElementById('completion-screen');
    this.usernameInput = document.getElementById('username-input');
    this.startButton = document.getElementById('start-button');
    this.playAgainButton = document.getElementById('play-again-button');
    this.timerDisplay = document.getElementById('time-left');
    this.playerCountDisplay = document.getElementById('player-count');
    this.completionPlayerCount = document.getElementById('completion-player-count');
    this.constellationName = document.getElementById('constellation-name');
    
    // Game state
    this.gameActive = false;
    this.currentConstellation = null;
    this.playerConnections = [];
    this.allConnections = new Map();
    this.timeRemaining = CONFIG.gameTime;
    this.timerInterval = null;
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initialize Three.js
    this.initThreeJS();
    
    // Initialize room state if you're the first player
    this.initializeRoomState();
    
    // Start the render loop
    this.animate();
  }
  
  initializeRoomState() {
    // Check if the room state is empty (you're the first player)
    if (Object.keys(this.room.party.roomState).length === 0) {
      // Initialize the room state with a random constellation
      const randomIndex = Math.floor(Math.random() * CONFIG.constellations.length);
      this.room.party.updateRoomState({
        constellationIndex: randomIndex,
        timeRemaining: CONFIG.gameTime,
        gameActive: false,
        connections: {},
        completedConnections: []
      });
    }
  }
  
  setupEventListeners() {
    // Start button click
    this.startButton.addEventListener('click', () => this.startGame());
    
    // Play again button click
    this.playAgainButton.addEventListener('click', () => this.resetGame());
    
    // Mouse events for star connections
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    
    // Keyboard controls
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    
    // Subscribe to room state changes
    this.room.party.subscribeRoomState(state => this.handleRoomStateChange(state));
    
    // Subscribe to presence changes
    this.room.party.subscribePresence(presence => this.handlePresenceChange(presence));
    
    // Handle messages
    this.room.onmessage = (event) => this.handleMessage(event);
  }
  
  initThreeJS() {
    // Scene setup
    this.scene = new THREE.Scene();
    
    // Camera setup
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.camera.position.z = 200;
    
    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Controls setup
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 50;
    this.controls.maxDistance = 500;
    
    // Handle window resize
    window.addEventListener('resize', () => this.onWindowResize());
    
    // Create the starfield
    this.createStarfield();
    
    // Create the player ship
    this.createPlayerShip();
    
    // Initialize raycaster for star selection
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.selectedStar = null;
    this.isDragging = false;
    
    // Create connection lines group
    this.connectionLines = new THREE.Group();
    this.scene.add(this.connectionLines);
  }
  
  createStarfield() {
    // Create a group for all stars
    this.starField = new THREE.Group();
    this.scene.add(this.starField);
    
    // Create the stars
    this.stars = [];
    const starGeometry = new THREE.SphereGeometry(1, 8, 8);
    
    for (let i = 0; i < CONFIG.starCount; i++) {
      // Random position within the star field radius
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const radius = CONFIG.starFieldRadius * Math.cbrt(Math.random()); // Cube root for more even distribution
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      // Random color and size
      const colorIndex = Math.floor(Math.random() * CONFIG.starColors.length);
      const starColor = CONFIG.starColors[colorIndex];
      const starSize = 0.5 + Math.random() * 2;
      
      const starMaterial = new THREE.MeshBasicMaterial({ color: starColor });
      const star = new THREE.Mesh(starGeometry, starMaterial);
      
      star.position.set(x, y, z);
      star.scale.set(starSize, starSize, starSize);
      
      this.starField.add(star);
      this.stars.push(star);
    }
    
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
    this.scene.add(this.playerShip);
    
    // Set initial position
    this.playerShip.position.set(0, 0, 150);
    
    // Create a group for the camera to follow the ship
    this.shipGroup = new THREE.Group();
    this.shipGroup.add(this.playerShip);
    this.scene.add(this.shipGroup);
    
    // Add the camera to the ship group
    this.shipGroup.add(this.camera);
    this.camera.position.set(0, 25, 50);
    this.camera.lookAt(this.playerShip.position);
  }
  
  createOtherPlayerShip(clientId, color = 0x7c4dff) {
    const shipGeometry = new THREE.ConeGeometry(5, 15, 4);
    const shipMaterial = new THREE.MeshBasicMaterial({
      color: color,
      wireframe: true
    });
    
    const ship = new THREE.Mesh(shipGeometry, shipMaterial);
    ship.rotation.x = Math.PI / 2;
    this.scene.add(ship);
    
    // Create a label for the username
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 128;
    
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = '28px Arial';
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.fillText(this.room.party.peers[clientId]?.username || 'Player', canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.SpriteMaterial({ map: texture });
    const label = new THREE.Sprite(labelMaterial);
    label.scale.set(20, 10, 1);
    label.position.set(0, 10, 0);
    
    const shipGroup = new THREE.Group();
    shipGroup.add(ship);
    shipGroup.add(label);
    
    this.scene.add(shipGroup);
    
    return { ship, label, group: shipGroup };
  }
  
  loadConstellation(constellationIndex) {
    const constellation = CONFIG.constellations[constellationIndex];
    this.currentConstellation = constellation;
    this.constellationName.textContent = constellation.name;
    
    // Create constellation stars and add to the scene
    this.constellationStars = [];
    
    const starGeometry = new THREE.SphereGeometry(2, 16, 16);
    const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    
    constellation.points.forEach((point, index) => {
      const star = new THREE.Mesh(starGeometry, starMaterial);
      star.position.set(point.x, point.y, point.z);
      star.userData.index = index;
      this.scene.add(star);
      this.constellationStars.push(star);
    });
  }
  
  drawConnections() {
    // Clear previous connections
    while (this.connectionLines.children.length > 0) {
      this.connectionLines.remove(this.connectionLines.children[0]);
    }
    
    // Draw completed connections
    const state = this.room.party.roomState;
    if (state.completedConnections) {
      state.completedConnections.forEach(connIndex => {
        const conn = this.currentConstellation.connections[connIndex];
        if (conn) {
          const start = this.constellationStars[conn[0]].position;
          const end = this.constellationStars[conn[1]].position;
          this.drawLine(start, end, CONFIG.completedConnectionColor, 3);
        }
      });
    }
    
    // Draw connections from all players
    if (state.connections) {
      Object.entries(state.connections).forEach(([clientId, connections]) => {
        connections.forEach(conn => {
          if (conn.length === 2) {
            const start = this.constellationStars[conn[0]].position;
            const end = this.constellationStars[conn[1]].position;
            
            // Color based on whether it's the current player or another player
            const color = clientId === this.room.party.client.id ? 
              CONFIG.playerConnectionColor : CONFIG.otherPlayersConnectionColor;
              
            this.drawLine(start, end, color);
          }
        });
      });
    }
  }
  
  drawLine(start, end, color, lineWidth = CONFIG.connectionLineWidth) {
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: color,
      linewidth: lineWidth
    });
    
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(start.x, start.y, start.z),
      new THREE.Vector3(end.x, end.y, end.z)
    ]);
    
    const line = new THREE.Line(lineGeometry, lineMaterial);
    this.connectionLines.add(line);
  }
  
  startGame() {
    const username = this.usernameInput.value.trim() || `Explorer-${Math.floor(Math.random() * 1000)}`;
    
    // Update the room state to activate the game if it's not already active
    if (!this.room.party.roomState.gameActive) {
      this.room.party.updateRoomState({
        gameActive: true,
        timeRemaining: CONFIG.gameTime
      });
    }
    
    // Hide welcome screen and show game UI
    this.welcomeScreen.classList.add('hidden');
    this.gameUI.classList.remove('hidden');
    
    // Start the timer if you're the first player
    if (Object.keys(this.room.party.presence).length === 0) {
      this.startTimer();
    }
    
    // Update presence with initial position
    this.room.party.updatePresence({
      position: { x: 0, y: 0, z: 150 },
      rotation: { x: 0, y: 0, z: 0 },
      username: username
    });
  }
  
  resetGame() {
    // Reset the game state
    this.completionScreen.classList.add('hidden');
    this.gameUI.classList.remove('hidden');
    
    // Choose a new random constellation
    const randomIndex = Math.floor(Math.random() * CONFIG.constellations.length);
    
    // Update the room state
    this.room.party.updateRoomState({
      constellationIndex: randomIndex,
      timeRemaining: CONFIG.gameTime,
      gameActive: true,
      connections: {},
      completedConnections: []
    });
    
    // Restart the timer
    this.startTimer();
  }
  
  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    
    this.timerInterval = setInterval(() => {
      const currentTime = this.room.party.roomState.timeRemaining - 1;
      
      if (currentTime <= 0) {
        // Time's up
        clearInterval(this.timerInterval);
        this.gameOver(false);
      } else {
        // Update time in room state
        this.room.party.updateRoomState({
          timeRemaining: currentTime
        });
      }
    }, 1000);
  }
  
  gameOver(success) {
    // Clear the timer
    if (this.timerInterval) clearInterval(this.timerInterval);
    
    // Update UI
    this.gameUI.classList.add('hidden');
    this.completionScreen.classList.remove('hidden');
    
    if (success) {
      document.querySelector('#completion-screen h2').textContent = 'Constellation Complete!';
      this.completionPlayerCount.textContent = Object.keys(this.room.party.peers).length;
    } else {
      document.querySelector('#completion-screen h2').textContent = 'Time\'s Up!';
      this.completionPlayerCount.textContent = Object.keys(this.room.party.peers).length;
    }
  }
  
  checkCompletion() {
    // Check if all connections have been made
    const state = this.room.party.roomState;
    const totalConnections = this.currentConstellation.connections.length;
    
    if (state.completedConnections && state.completedConnections.length === totalConnections) {
      this.gameOver(true);
      return true;
    }
    
    return false;
  }
  
  onMouseDown(event) {
    if (!this.gameActive) return;
    
    // Calculate mouse position
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the picking ray with the camera and mouse position
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Calculate objects intersecting the picking ray
    const intersects = this.raycaster.intersectObjects(this.constellationStars);
    
    if (intersects.length > 0) {
      this.selectedStar = intersects[0].object;
      this.isDragging = true;
    }
  }
  
  onMouseMove(event) {
    if (!this.isDragging || !this.selectedStar) return;
    
    // Update mouse position
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the picking ray
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Check for other stars
    const intersects = this.raycaster.intersectObjects(this.constellationStars);
    
    if (intersects.length > 0 && intersects[0].object !== this.selectedStar) {
      const targetStar = intersects[0].object;
      
      // Check if this connection is valid (part of the constellation)
      const isValidConnection = this.checkValidConnection(
        this.selectedStar.userData.index,
        targetStar.userData.index
      );
      
      if (isValidConnection !== -1) {
        // Add to player's connections
        this.addConnection(this.selectedStar.userData.index, targetStar.userData.index, isValidConnection);
      }
    }
  }
  
  onMouseUp() {
    this.isDragging = false;
    this.selectedStar = null;
  }
  
  checkValidConnection(star1Index, star2Index) {
    // Check if this connection is part of the constellation
    for (let i = 0; i < this.currentConstellation.connections.length; i++) {
      const conn = this.currentConstellation.connections[i];
      
      if ((conn[0] === star1Index && conn[1] === star2Index) ||
          (conn[0] === star2Index && conn[1] === star1Index)) {
        return i; // Return the connection index
      }
    }
    
    return -1; // Not a valid connection
  }
  
  addConnection(star1Index, star2Index, connectionIndex) {
    const state = this.room.party.roomState;
    const clientId = this.room.party.client.id;
    
    // Check if this connection has already been completed
    if (state.completedConnections && state.completedConnections.includes(connectionIndex)) {
      return; // Already completed
    }
    
    // Initialize connections object if needed
    const connections = state.connections || {};
    const playerConnections = connections[clientId] || [];
    
    // Check if player already has this connection
    const hasConnection = playerConnections.some(conn => 
      (conn[0] === star1Index && conn[1] === star2Index) ||
      (conn[0] === star2Index && conn[1] === star1Index)
    );
    
    if (!hasConnection) {
      // Add connection to player's list
      const newPlayerConnections = [...playerConnections, [star1Index, star2Index]];
      
      // Update room state with the new connection
      const newConnections = {
        ...connections,
        [clientId]: newPlayerConnections
      };
      
      // Add to completed connections if not already there
      const completedConnections = state.completedConnections || [];
      if (!completedConnections.includes(connectionIndex)) {
        this.room.party.updateRoomState({
          connections: newConnections,
          completedConnections: [...completedConnections, connectionIndex]
        });
      } else {
        this.room.party.updateRoomState({
          connections: newConnections
        });
      }
    }
  }
  
  handleKeyDown(event) {
    const key = event.key.toLowerCase();
    
    // Move forward/backward
    if (key === 'w' || key === 'arrowup') {
      this.moveForward = true;
    }
    if (key === 's' || key === 'arrowdown') {
      this.moveBackward = true;
    }
    
    // Turn left/right
    if (key === 'a' || key === 'arrowleft') {
      this.turnLeft = true;
    }
    if (key === 'd' || key === 'arrowright') {
      this.turnRight = true;
    }
  }
  
  handleKeyUp(event) {
    const key = event.key.toLowerCase();
    
    // Move forward/backward
    if (key === 'w' || key === 'arrowup') {
      this.moveForward = false;
    }
    if (key === 's' || key === 'arrowdown') {
      this.moveBackward = false;
    }
    
    // Turn left/right
    if (key === 'a' || key === 'arrowleft') {
      this.turnLeft = false;
    }
    if (key === 'd' || key === 'arrowright') {
      this.turnRight = false;
    }
  }
  
  updatePlayerShip() {
    if (!this.playerShip) return;
    
    // Handle rotation
    if (this.turnLeft) {
      this.shipGroup.rotation.y += CONFIG.rotationSpeed;
    }
    if (this.turnRight) {
      this.shipGroup.rotation.y -= CONFIG.rotationSpeed;
    }
    
    // Handle movement
    const moveSpeed = CONFIG.playerSpeed;
    if (this.moveForward) {
      this.shipGroup.translateZ(-moveSpeed);
    }
    if (this.moveBackward) {
      this.shipGroup.translateZ(moveSpeed);
    }
    
    // Boundary checking - don't let the ship go too far
    const maxDistance = CONFIG.starFieldRadius * 0.8;
    const distanceFromCenter = this.shipGroup.position.length();
    
    if (distanceFromCenter > maxDistance) {
      // Scale the ship position back to the boundary
      this.shipGroup.position.normalize().multiplyScalar(maxDistance);
    }
    
    // Update presence with new position and rotation
    this.room.party.updatePresence({
      position: {
        x: this.shipGroup.position.x,
        y: this.shipGroup.position.y,
        z: this.shipGroup.position.z
      },
      rotation: {
        x: this.shipGroup.rotation.x,
        y: this.shipGroup.rotation.y,
        z: this.shipGroup.rotation.z
      }
    });
  }
  
  updateOtherPlayers() {
    const presence = this.room.party.presence;
    const currentPlayers = new Set(Object.keys(presence));
    
    // Remove players that disconnected
    for (const clientId in this.otherPlayerShips) {
      if (!currentPlayers.has(clientId) && clientId !== this.room.party.client.id) {
        // Remove the ship from the scene
        this.scene.remove(this.otherPlayerShips[clientId].group);
        delete this.otherPlayerShips[clientId];
      }
    }
    
    // Create or update player ships
    for (const clientId in presence) {
      if (clientId === this.room.party.client.id) continue; // Skip self
      
      const playerData = presence[clientId];
      
      if (!playerData.position) continue; // Skip if no position data
      
      // Create ship if it doesn't exist
      if (!this.otherPlayerShips[clientId]) {
        this.otherPlayerShips[clientId] = this.createOtherPlayerShip(clientId);
      }
      
      // Update position and rotation
      const ship = this.otherPlayerShips[clientId];
      if (playerData.position) {
        ship.group.position.set(
          playerData.position.x,
          playerData.position.y,
          playerData.position.z
        );
      }
      
      if (playerData.rotation) {
        ship.group.rotation.set(
          playerData.rotation.x,
          playerData.rotation.y,
          playerData.rotation.z
        );
      }
    }
    
    // Update player count display
    this.playerCountDisplay.textContent = Object.keys(this.room.party.peers).length;
  }
  
  handleRoomStateChange(state) {
    // Update local time display
    if (state.timeRemaining !== undefined) {
      this.timerDisplay.textContent = state.timeRemaining;
    }
    
    // Load constellation if it changed or if it's the first load
    if (state.constellationIndex !== undefined && 
        (!this.currentConstellation || 
         this.currentConstellation !== CONFIG.constellations[state.constellationIndex])) {
      
      // Remove previous constellation stars if they exist
      if (this.constellationStars) {
        this.constellationStars.forEach(star => this.scene.remove(star));
      }
      
      // Load the new constellation
      this.loadConstellation(state.constellationIndex);
    }
    
    // Update game active state
    if (state.gameActive !== undefined) {
      this.gameActive = state.gameActive;
    }
    
    // Draw connections
    if (this.currentConstellation && this.constellationStars) {
      this.drawConnections();
    }
    
    // Check for game completion
    if (this.gameActive && this.currentConstellation) {
      this.checkCompletion();
    }
  }
  
  handlePresenceChange(presence) {
    this.updateOtherPlayers();
  }
  
  handleMessage(event) {
    const data = event.data;
    
    switch (data.type) {
      case "connected":
        console.log(`Player connected: ${data.username} (${data.clientId})`);
        break;
        
      case "disconnected":
        console.log(`Player disconnected: ${data.username} (${data.clientId})`);
        // Handle player disconnection
        if (this.otherPlayerShips && this.otherPlayerShips[data.clientId]) {
          this.scene.remove(this.otherPlayerShips[data.clientId].group);
          delete this.otherPlayerShips[data.clientId];
        }
        break;
        
      default:
        // Handle custom message types if needed
        break;
    }
  }
  
  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    
    // Update controls
    this.controls.update();
    
    // Update player ship
    this.updatePlayerShip();
    
    // Render the scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize the game when the DOM is fully loaded
window.addEventListener('DOMContentLoaded', () => {
  // Initialize player ships tracking
  const game = new ConstellationGame();
  game.otherPlayerShips = {};
});

