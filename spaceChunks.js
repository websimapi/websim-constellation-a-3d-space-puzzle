import { CONFIG } from './config.js';

export class SpaceChunkManager {
  constructor(scene, starGenerator) {
    this.scene = scene;
    this.starGenerator = starGenerator;
    
    // Track loaded chunks
    this.loadedChunks = new Map(); // key: "x,y,z", value: array of stars
    
    // Most recent center chunk coordinates
    this.centerChunkX = 0;
    this.centerChunkY = 0;
    this.centerChunkZ = 0;
    
    // Set of visible chunk coordinates for quick lookup
    this.visibleChunkCoords = new Set();
  }
  
  // Convert world position to chunk coordinates
  worldToChunkCoords(x, y, z) {
    const chunkSize = CONFIG.chunkSize;
    return {
      x: Math.floor(x / chunkSize),
      y: Math.floor(y / chunkSize),
      z: Math.floor(z / chunkSize)
    };
  }
  
  // Get chunk key for storage in maps
  getChunkKey(x, y, z) {
    return `${x},${y},${z}`;
  }
  
  // Update chunks based on player position
  updateChunks(playerPosition) {
    // Get current chunk coordinates
    const { x, y, z } = this.worldToChunkCoords(
      playerPosition.x,
      playerPosition.y,
      playerPosition.z
    );
    
    // If player hasn't moved to a new chunk, do nothing
    if (x === this.centerChunkX && 
        y === this.centerChunkY && 
        z === this.centerChunkZ) {
      return;
    }
    
    // Save new center position
    this.centerChunkX = x;
    this.centerChunkY = y;
    this.centerChunkZ = z;
    
    // Calculate which chunks should be visible
    const newVisibleChunks = new Set();
    const renderDistance = CONFIG.renderDistance;
    
    for (let dx = -renderDistance; dx <= renderDistance; dx++) {
      for (let dy = -renderDistance; dy <= renderDistance; dy++) {
        for (let dz = -renderDistance; dz <= renderDistance; dz++) {
          const chunkX = x + dx;
          const chunkY = y + dy;
          const chunkZ = z + dz;
          const key = this.getChunkKey(chunkX, chunkY, chunkZ);
          
          newVisibleChunks.add(key);
          
          // Load chunk if it's not already loaded
          if (!this.loadedChunks.has(key)) {
            this.loadChunk(chunkX, chunkY, chunkZ);
          }
        }
      }
    }
    
    // Unload chunks that are no longer visible
    for (const [key, stars] of this.loadedChunks.entries()) {
      if (!newVisibleChunks.has(key)) {
        this.unloadChunk(key);
      }
    }
    
    // Update visible chunks set
    this.visibleChunkCoords = newVisibleChunks;
  }
  
  // Load a chunk and add its stars to the scene
  loadChunk(x, y, z) {
    const stars = this.starGenerator.generateStarsForChunk(x, y, z);
    this.starGenerator.addStarsToScene(stars);
    this.loadedChunks.set(this.getChunkKey(x, y, z), stars);
  }
  
  // Unload a chunk and remove its stars from the scene
  unloadChunk(key) {
    const stars = this.loadedChunks.get(key);
    if (stars) {
      this.starGenerator.removeStarsFromScene(stars);
      this.loadedChunks.delete(key);
    }
  }
  
  // Get all currently loaded stars
  getAllLoadedStars() {
    const allStars = [];
    for (const stars of this.loadedChunks.values()) {
      allStars.push(...stars);
    }
    return allStars;
  }
  
  // Get chunk coordinates for the given key
  chunkKeyToCoords(key) {
    const [x, y, z] = key.split(',').map(Number);
    return { x, y, z };
  }
  
  // Find chunk containing specific coordinates
  findChunkForPosition(position) {
    const chunkCoords = this.worldToChunkCoords(
      position.x, position.y, position.z
    );
    return this.getChunkKey(chunkCoords.x, chunkCoords.y, chunkCoords.z);
  }
}