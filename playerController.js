import * as THREE from 'three';
import { CONFIG } from './config.js';

export class PlayerController {
  constructor(scene, camera, shipGroup, room) {
    this.scene = scene;
    this.camera = camera;
    this.shipGroup = shipGroup;
    this.room = room;
    
    // Input state
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.moveUp = false;
    this.moveDown = false;
    this.turnLeft = false;
    this.turnRight = false;
    this.turnUp = false;
    this.turnDown = false;
    
    // Set up input handlers
    this.setupInputHandlers();
    
    // Other player ships
    this.otherPlayerShips = {};
  }
  
  setupInputHandlers() {
    // Keyboard down events
    window.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      
      // Movement controls
      if (key === 'w' || key === 'arrowup') this.moveForward = true;
      if (key === 's' || key === 'arrowdown') this.moveBackward = true;
      if (key === 'a' || key === 'arrowleft') this.turnLeft = true;
      if (key === 'd' || key === 'arrowright') this.turnRight = true;
      if (key === 'q') this.turnUp = true;
      if (key === 'e') this.turnDown = true;
      if (key === 'shift') this.moveUp = true;
      if (key === 'control') this.moveDown = true;
    });
    
    // Keyboard up events
    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      
      // Movement controls
      if (key === 'w' || key === 'arrowup') this.moveForward = false;
      if (key === 's' || key === 'arrowdown') this.moveBackward = false;
      if (key === 'a' || key === 'arrowleft') this.turnLeft = false;
      if (key === 'd' || key === 'arrowright') this.turnRight = false;
      if (key === 'q') this.turnUp = false;
      if (key === 'e') this.turnDown = false;
      if (key === 'shift') this.moveUp = false;
      if (key === 'control') this.moveDown = false;
    });
  }
  
  update() {
    // Handle rotation
    if (this.turnLeft) this.shipGroup.rotateY(CONFIG.rotationSpeed);
    if (this.turnRight) this.shipGroup.rotateY(-CONFIG.rotationSpeed);
    if (this.turnUp) this.shipGroup.rotateX(CONFIG.rotationSpeed);
    if (this.turnDown) this.shipGroup.rotateX(-CONFIG.rotationSpeed);
    
    // Handle movement
    const moveSpeed = CONFIG.playerSpeed;
    
    // Create movement vector
    const movement = new THREE.Vector3();
    
    if (this.moveForward) movement.z -= moveSpeed;
    if (this.moveBackward) movement.z += moveSpeed;
    if (this.moveLeft) movement.x -= moveSpeed;
    if (this.moveRight) movement.x += moveSpeed;
    if (this.moveUp) movement.y += moveSpeed;
    if (this.moveDown) movement.y -= moveSpeed;
    
    // Apply movement in local space
    if (movement.length() > 0) {
      movement.applyQuaternion(this.shipGroup.quaternion);
      this.shipGroup.position.add(movement);
    }
    
    // Send position and rotation to other players
    this.updatePresence();
  }
  
  updatePresence() {
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
  
  createOtherPlayerShip(clientId, username) {
    // Create ship mesh
    const shipGeometry = new THREE.ConeGeometry(5, 15, 4);
    const shipMaterial = new THREE.MeshBasicMaterial({
      color: 0x7c4dff,
      wireframe: true
    });
    
    const ship = new THREE.Mesh(shipGeometry, shipMaterial);
    ship.rotation.x = Math.PI / 2;
    
    // Create username label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 128;
    
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = '28px Arial';
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.fillText(username || 'Player', canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.SpriteMaterial({ map: texture });
    const label = new THREE.Sprite(labelMaterial);
    label.scale.set(20, 10, 1);
    label.position.set(0, 10, 0);
    
    // Create a group for the ship
    const shipGroup = new THREE.Group();
    shipGroup.add(ship);
    shipGroup.add(label);
    this.scene.add(shipGroup);
    
    return { ship, label, group: shipGroup };
  }
  
  updateOtherPlayers(presence) {
    const currentPlayers = new Set(Object.keys(presence));
    
    // Remove disconnected players
    for (const clientId in this.otherPlayerShips) {
      if (!currentPlayers.has(clientId) && clientId !== this.room.party.client.id) {
        this.scene.remove(this.otherPlayerShips[clientId].group);
        delete this.otherPlayerShips[clientId];
      }
    }
    
    // Create or update other players
    for (const clientId in presence) {
      if (clientId === this.room.party.client.id) continue; // Skip self
      
      const playerData = presence[clientId];
      if (!playerData.position) continue;
      
      // Create ship if it doesn't exist
      if (!this.otherPlayerShips[clientId]) {
        const username = this.room.party.peers[clientId]?.username || 'Explorer';
        this.otherPlayerShips[clientId] = this.createOtherPlayerShip(clientId, username);
      }
      
      // Update position and rotation
      const shipData = this.otherPlayerShips[clientId];
      
      if (playerData.position) {
        shipData.group.position.set(
          playerData.position.x,
          playerData.position.y,
          playerData.position.z
        );
      }
      
      if (playerData.rotation) {
        shipData.group.rotation.set(
          playerData.rotation.x,
          playerData.rotation.y,
          playerData.rotation.z
        );
      }
    }
  }
}