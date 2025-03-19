import * as THREE from 'three';
import { CONFIG } from './config.js';

// Simple seeded random number generator
class SeededRandom {
  constructor(seed) {
    this.seed = this.hashString(seed);
  }
  
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }
  
  // Get next random value
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  
  // Get random value in range
  nextRange(min, max) {
    return min + this.next() * (max - min);
  }
  
  // Get random integer in range
  nextInt(min, max) {
    return Math.floor(this.nextRange(min, max + 1));
  }
}

export class StarGenerator {
  constructor(scene) {
    this.scene = scene;
    this.starGeometry = new THREE.SphereGeometry(1, 8, 8);
    this.starMaterials = CONFIG.starColors.map(color => 
      new THREE.MeshBasicMaterial({ color })
    );
  }
  
  getChunkSeed(x, y, z) {
    return `${CONFIG.baseSeed}-${x}-${y}-${z}`;
  }
  
  generateStarsForChunk(chunkX, chunkY, chunkZ) {
    const stars = [];
    const seed = this.getChunkSeed(chunkX, chunkY, chunkZ);
    const random = new SeededRandom(seed);
    
    const chunkSize = CONFIG.chunkSize;
    const chunkOriginX = chunkX * chunkSize;
    const chunkOriginY = chunkY * chunkSize;
    const chunkOriginZ = chunkZ * chunkSize;
    
    // Generate stars for this chunk
    for (let i = 0; i < CONFIG.starsPerChunk; i++) {
      // Random position within the chunk
      const x = chunkOriginX + random.nextRange(0, chunkSize);
      const y = chunkOriginY + random.nextRange(0, chunkSize);
      const z = chunkOriginZ + random.nextRange(0, chunkSize);
      
      // Random material (color) and size
      const materialIndex = random.nextInt(0, this.starMaterials.length - 1);
      const starMaterial = this.starMaterials[materialIndex];
      const starSize = 0.5 + random.nextRange(0, 2);
      
      // Create star
      const star = new THREE.Mesh(this.starGeometry, starMaterial);
      star.position.set(x, y, z);
      star.scale.set(starSize, starSize, starSize);
      star.userData.chunkCoords = { x: chunkX, y: chunkY, z: chunkZ };
      star.userData.starIndex = i;
      star.userData.size = starSize;
      
      stars.push(star);
    }
    
    return stars;
  }
  
  addStarsToScene(stars) {
    stars.forEach(star => this.scene.add(star));
  }
  
  removeStarsFromScene(stars) {
    stars.forEach(star => this.scene.remove(star));
  }
  
  createSpecialStar(position, color = 0xffff00, size = 2) {
    const star = new THREE.Mesh(
      this.starGeometry,
      new THREE.MeshBasicMaterial({ color })
    );
    star.position.copy(position);
    star.scale.set(size, size, size);
    
    // Add glow effect
    const glowMaterial = new THREE.SpriteMaterial({
      map: this.createGlowTexture(),
      color: color,
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    
    const glow = new THREE.Sprite(glowMaterial);
    glow.scale.set(size * 4, size * 4, 1);
    star.add(glow);
    
    return star;
  }
  
  createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(
      32, 32, 0, 32, 32, 32
    );
    
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.3, 'rgba(255,255,255,0.3)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }
}