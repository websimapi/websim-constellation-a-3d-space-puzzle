import * as THREE from 'three';
import { CONFIG } from './config.js';

export class ConstellationManager {
  constructor(scene, room) {
    this.scene = scene;
    this.room = room;
    this.discoveredConstellations = new Map(); // Key: constellation ID, Value: constellation data
    this.activeConnections = []; // Current player's active connections
    this.connectionLines = new THREE.Group(); // Group for all connection lines
    this.scene.add(this.connectionLines);
    
    // Load existing constellations from the database
    this.loadDiscoveredConstellations();
    
    // Setup connection line materials
    this.lineMaterial = new THREE.LineBasicMaterial({ 
      color: CONFIG.connectionColor,
      linewidth: CONFIG.connectionLineWidth
    });
    
    this.playerLineMaterial = new THREE.LineBasicMaterial({ 
      color: CONFIG.playerConnectionColor,
      linewidth: CONFIG.connectionLineWidth
    });
    
    this.completedLineMaterial = new THREE.LineBasicMaterial({ 
      color: CONFIG.completedConnectionColor,
      linewidth: CONFIG.connectionLineWidth + 1
    });
  }
  
  async loadDiscoveredConstellations() {
    // Get all constellations from the database
    const constellations = await this.room.collection('constellation').getList();
    
    // Add each constellation to our local map
    constellations.forEach(constellation => {
      this.discoveredConstellations.set(constellation.id, constellation);
    });
    
    // Subscribe to constellation changes
    this.room.collection('constellation').subscribe(constellations => {
      // Update our local map
      this.discoveredConstellations.clear();
      constellations.forEach(constellation => {
        this.discoveredConstellations.set(constellation.id, constellation);
      });
      
      // Redraw all constellations
      this.drawDiscoveredConstellations();
    });
  }
  
  addConnection(star1, star2) {
    // Don't add duplicate connections
    for (const conn of this.activeConnections) {
      if ((conn.star1 === star1 && conn.star2 === star2) ||
          (conn.star1 === star2 && conn.star2 === star1)) {
        return false;
      }
    }
    
    // Check if distance is valid
    const distance = star1.position.distanceTo(star2.position);
    if (distance > CONFIG.maxConnectionDistance) {
      return false;
    }
    
    // Add connection
    this.activeConnections.push({ star1, star2 });
    
    // Update presence with active connections
    this.updateConnectionPresence();
    
    // Draw connection line
    this.drawPlayerConnections();
    
    return true;
  }
  
  clearConnections() {
    this.activeConnections = [];
    this.updateConnectionPresence();
    this.drawPlayerConnections();
  }
  
  updateConnectionPresence() {
    // Format connections for presence
    const connections = this.activeConnections.map(conn => ({
      star1: {
        position: {
          x: conn.star1.position.x,
          y: conn.star1.position.y,
          z: conn.star1.position.z
        },
        chunkCoords: conn.star1.userData.chunkCoords,
        starIndex: conn.star1.userData.starIndex
      },
      star2: {
        position: {
          x: conn.star2.position.x,
          y: conn.star2.position.y,
          z: conn.star2.position.z
        },
        chunkCoords: conn.star2.userData.chunkCoords,
        starIndex: conn.star2.userData.starIndex
      }
    }));
    
    // Update presence
    this.room.party.updatePresence({ connections });
  }
  
  drawPlayerConnections() {
    // Clear previous player connections
    this.clearConnectionLines('player');
    
    // Draw active connections
    this.activeConnections.forEach(conn => {
      this.drawLine(
        conn.star1.position,
        conn.star2.position,
        this.playerLineMaterial,
        'player'
      );
    });
  }
  
  drawOtherPlayersConnections(presence) {
    // Clear previous other players' connections
    this.clearConnectionLines('others');
    
    // Draw connections from all other players
    for (const clientId in presence) {
      if (clientId === this.room.party.client.id) continue;
      
      const playerData = presence[clientId];
      if (!playerData.connections) continue;
      
      playerData.connections.forEach(conn => {
        const start = new THREE.Vector3(
          conn.star1.position.x,
          conn.star1.position.y,
          conn.star1.position.z
        );
        
        const end = new THREE.Vector3(
          conn.star2.position.x,
          conn.star2.position.y,
          conn.star2.position.z
        );
        
        const otherPlayerMaterial = new THREE.LineBasicMaterial({ 
          color: CONFIG.otherPlayersConnectionColor,
          linewidth: CONFIG.connectionLineWidth
        });
        
        this.drawLine(start, end, otherPlayerMaterial, 'others');
      });
    }
  }
  
  drawDiscoveredConstellations() {
    // Clear previous constellation lines
    this.clearConnectionLines('discovered');
    
    // Draw all discovered constellations
    this.discoveredConstellations.forEach(constellation => {
      const connections = constellation.connections;
      const points = constellation.points;
      
      connections.forEach(conn => {
        const start = new THREE.Vector3(
          points[conn[0]].x,
          points[conn[0]].y,
          points[conn[0]].z
        );
        
        const end = new THREE.Vector3(
          points[conn[1]].x,
          points[conn[1]].y,
          points[conn[1]].z
        );
        
        this.drawLine(start, end, this.completedLineMaterial, 'discovered');
      });
    });
  }
  
  drawLine(start, end, material, group = 'default') {
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(start.x, start.y, start.z),
      new THREE.Vector3(end.x, end.y, end.z)
    ]);
    
    const line = new THREE.Line(lineGeometry, material);
    line.userData.group = group;
    this.connectionLines.add(line);
  }
  
  clearConnectionLines(group = null) {
    // Remove lines of specific group or all if group is null
    const linesToRemove = [];
    
    this.connectionLines.children.forEach(line => {
      if (!group || line.userData.group === group) {
        linesToRemove.push(line);
      }
    });
    
    linesToRemove.forEach(line => {
      this.connectionLines.remove(line);
    });
  }
  
  // Check if the current connections form a valid constellation
  checkForNewConstellation() {
    if (this.activeConnections.length < CONFIG.minStarsForConstellation - 1) {
      return false; // Not enough connections
    }
    
    // Build a graph of connected stars
    const starGraph = new Map();
    
    this.activeConnections.forEach(conn => {
      // Add star1 to graph
      if (!starGraph.has(conn.star1.uuid)) {
        starGraph.set(conn.star1.uuid, { 
          star: conn.star1,
          connections: new Set()
        });
      }
      starGraph.get(conn.star1.uuid).connections.add(conn.star2.uuid);
      
      // Add star2 to graph
      if (!starGraph.has(conn.star2.uuid)) {
        starGraph.set(conn.star2.uuid, { 
          star: conn.star2,
          connections: new Set()
        });
      }
      starGraph.get(conn.star2.uuid).connections.add(conn.star1.uuid);
    });
    
    // Check if the graph forms a single connected component
    const visited = new Set();
    const startNode = starGraph.keys().next().value;
    
    this.dfs(startNode, starGraph, visited);
    
    if (visited.size !== starGraph.size) {
      return false; // Not a single connected component
    }
    
    // Check if this matches any already discovered constellations
    for (const [id, constellation] of this.discoveredConstellations) {
      if (this.matchesExistingConstellation(starGraph, constellation)) {
        return { isNew: false, constellation };
      }
    }
    
    // It's a new constellation!
    return { 
      isNew: true, 
      starCount: starGraph.size,
      starGraph
    };
  }
  
  // Depth-first search to check connectivity
  dfs(nodeId, graph, visited) {
    if (visited.has(nodeId)) return;
    
    visited.add(nodeId);
    const node = graph.get(nodeId);
    
    node.connections.forEach(neighborId => {
      this.dfs(neighborId, graph, visited);
    });
  }
  
  // Check if current connections match an existing constellation
  matchesExistingConstellation(starGraph, constellation) {
    // This is a simplified check - a more robust implementation would use
    // graph isomorphism algorithms to check for structural equivalence
    
    // For now, just check if the number of stars and connections match
    if (starGraph.size !== constellation.points.length) {
      return false;
    }
    
    let totalConnections = 0;
    for (const node of starGraph.values()) {
      totalConnections += node.connections.size;
    }
    // Each connection is counted twice (once from each end)
    if (totalConnections / 2 !== constellation.connections.length) {
      return false;
    }
    
    // Further checks can be added here for more accurate matching
    
    return false; // For now, assume it's always new
  }
  
  // Save a new constellation to the database
  async saveConstellation(name, starGraph) {
    // Convert star graph to points and connections arrays
    const stars = Array.from(starGraph.values());
    const points = stars.map(node => {
      const pos = node.star.position;
      return { x: pos.x, y: pos.y, z: pos.z };
    });
    
    const connections = [];
    const starToIndex = new Map();
    
    stars.forEach((node, index) => {
      starToIndex.set(node.star.uuid, index);
    });
    
    for (let i = 0; i < stars.length; i++) {
      const node = stars[i];
      const nodeId = node.star.uuid;
      
      node.connections.forEach(connectedId => {
        // Only add each connection once
        if (nodeId < connectedId) {
          connections.push([
            starToIndex.get(nodeId),
            starToIndex.get(connectedId)
          ]);
        }
      });
    }
    
    // Create the constellation record
    const constellation = await this.room.collection('constellation').create({
      name,
      points,
      connections,
      discoverer: this.room.party.client.username,
      discoveryDate: new Date().toISOString()
    });
    
    return constellation;
  }
}