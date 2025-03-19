// Game Configuration
export const CONFIG = {
  // Game settings
  gameTime: 120, // seconds
  minPlayers: 1,
  
  // Star field settings
  starCount: 500,
  starFieldRadius: 1000,
  
  // Constellation settings
  constellations: [
    {
      name: "Orion",
      difficulty: 1,
      points: [
        {x: 50, y: 100, z: -50},
        {x: 80, y: 60, z: -30},
        {x: 100, y: 80, z: 0},
        {x: 130, y: 40, z: 30},
        {x: 70, y: 20, z: 50},
        {x: 20, y: 30, z: 20},
        {x: 0, y: 0, z: 0}
      ],
      connections: [
        [0, 1], [1, 2], [2, 3], [2, 4], [2, 5], [5, 6]
      ]
    },
    {
      name: "Big Dipper",
      difficulty: 1,
      points: [
        {x: -40, y: 60, z: 30},
        {x: -10, y: 70, z: 50},
        {x: 20, y: 80, z: 60},
        {x: 40, y: 70, z: 40},
        {x: 60, y: 50, z: 20},
        {x: 40, y: 30, z: 10},
        {x: 60, y: 10, z: -10}
      ],
      connections: [
        [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]
      ]
    },
    {
      name: "Cassiopeia",
      difficulty: 2,
      points: [
        {x: -50, y: -30, z: -50},
        {x: -20, y: -10, z: -30},
        {x: 0, y: -40, z: -20},
        {x: 20, y: -10, z: -10},
        {x: 50, y: -30, z: 0}
      ],
      connections: [
        [0, 1], [1, 2], [2, 3], [3, 4]
      ]
    }
  ],
  
  // Player ship settings
  playerSpeed: 1.5,
  rotationSpeed: 0.05,
  
  // Visual settings
  starColors: [
    0xffffaf, // Warm white
    0xafffff, // Cool white
    0xffafaf, // Reddish
    0xafffaf, // Greenish
    0xafafff  // Bluish
  ],
  
  // Connection settings
  maxConnectionDistance: 150,
  connectionLineWidth: 2,
  connectionColor: 0x4fc3f7,
  playerConnectionColor: 0x2979ff,
  otherPlayersConnectionColor: 0x7c4dff,
  completedConnectionColor: 0x00e676
};

