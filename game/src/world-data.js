// The island of Costa Verde: one causeway city, two hills, a beach strip, a dock.
// Everything here is authored by hand as data — no generator, no external assets.

export const CITY = {
  name: 'PUERTO CELESTE',
  island: 'COSTA VERDE',
  // Block grid: streets run on a rotated lattice so the sun sets down the avenues.
  block: 52,          // metres per block
  streets: 9,         // blocks per side
  avenue: 15,         // arterial width
  lane: 8,            // side street width
};

export const PALETTE = {
  sky:      [0xfff0c0, 0xffb070, 0xd0507e, 0x7a4a92, 0x2e2450],
  sun:      0xfff2c4,
  sea:      0x1f6f8f,
  sand:     0xe8d3a8,
  asphalt:  0x3b3942,
  pavement: 0xb9a992,
  wall:     [0xf6dfae, 0xe8a06a, 0xd9696b, 0xf2c14e, 0xa8c8b8, 0xe4e0d4, 0xc98a9e, 0x8fb6c9],
  trim:     [0xffffff, 0xf7e7c0, 0x2f3a44],
  glass:    0x2b3340,
  palm:     0x2f6b3a,
  palmDark: 0x1e4b28,
  car:      [0xb23b32, 0x2f5f8f, 0xf0f0ea, 0x2a2a2e, 0xd8a63c, 0x2f7a5a, 0x8a4f9e],
  skin:     [0x8a5a3a, 0xc08a5e, 0x5e3a26, 0xd8a878],
};

// Nine jobs. Each one is a place to be, someone to meet, and a reason to hurry.
export const JOBS = [
  { id: 'pier',        at: 'pier',        who: 'MARISOL', title: 'A favour for Marisol',
    brief: 'Drive to the pier before the boat sails',
    line: 'The boat sails in three minutes. I need that manifest, Nico.', cash: 4200 },
  { id: 'garage',      at: 'garage',      who: 'TEO',     title: 'The wrong car',
    brief: 'Bring Teo the car he did not steal',
    line: 'That is not the car. That is never the car. Take it back.',  cash: 3600 },
  { id: 'rooftop',     at: 'hotel',       who: 'LUPE',    title: 'Room 1204',
    brief: 'Reach the hotel roof without a police escort',
    line: 'Twelve floors, no lift, and the lift is full of cops.',      cash: 5100 },
  { id: 'market',      at: 'market',      who: 'CHUY',    title: 'Fruit and favours',
    brief: 'Collect Chuy\'s envelope at the night market',
    line: 'Buy a mango. Pay for it with the envelope. Nobody looks twice.', cash: 2900 },
  { id: 'docks',       at: 'docks',       who: 'MARISOL', title: 'What the crates held',
    brief: 'Follow the van from the docks and do not be seen',
    line: 'Do not stop it. Follow it. I want to know where it sleeps.',  cash: 6400 },
  { id: 'hilltop',     at: 'chapel',      who: 'PADRE',   title: 'The padre\'s debt',
    brief: 'Deliver the padre\'s payment to the hilltop',
    line: 'The Lord forgives. The men on the hill invoice.',            cash: 3300 },
  { id: 'helipad',     at: 'helipad',     who: 'LUPE',    title: 'A car with no roof',
    brief: 'Steal the convertible on the helipad and escape',
    line: 'Roof down, plates changed, and be gone before the rotor stops.', cash: 7200 },
  { id: 'beach',       at: 'beach',       who: 'CHUY',    title: 'Low tide',
    brief: 'Meet Chuy at the far end of the beach at low tide',
    line: 'Low tide, far end, bring nothing that rings.',               cash: 3000 },
  { id: 'observatory', at: 'observatory', who: 'MARISOL', title: 'Nobody leaves clean',
    brief: 'Reach the observatory and settle the week',
    line: 'Nine jobs, Nico. After this one the island is yours.',        cash: 12400 },
];

// Named places, used by the mission markers, the map and the street banner.
export const PLACES = [
  { id: 'pier',        name: 'MUELLE VIEJO',    x: -210, z:  200, kind: 'pier' },
  { id: 'garage',      name: 'TALLER TEO',      x:  120, z: -140, kind: 'garage' },
  { id: 'hotel',       name: 'HOTEL MIRALÉ',    x:  -60, z:  -20, kind: 'tower' },
  { id: 'market',      name: 'MERCADO NOCTURNO', x:  180, z:   60, kind: 'market' },
  { id: 'docks',       name: 'DOCA SECA',       x: -230, z: -180, kind: 'docks' },
  { id: 'chapel',      name: 'CAPILLA ALTA',    x:   40, z: -230, kind: 'chapel' },
  { id: 'helipad',     name: 'HELIPUERTO SUR',  x:  230, z: -230, kind: 'helipad' },
  { id: 'beach',       name: 'PLAYA LARGA',     x:  250, z:  230, kind: 'beach' },
  { id: 'observatory', name: 'OBSERVATORIO',    x:    0, z:    0, kind: 'observatory' },
];

export const SPAWNS = {
  player: { x: 6, z: 150 },
  cars: [
    { x:  18, z: 150, colour: 0, kind: 'coupe' },
    { x: -30, z: 150, colour: 2, kind: 'sedan' },
    { x:  60, z:  92, colour: 4, kind: 'van' },
    { x: -70, z:  40, colour: 1, kind: 'sedan' },
    { x:  96, z: -60, colour: 5, kind: 'coupe' },
    { x: -96, z: -96, colour: 3, kind: 'van' },
    { x: 150, z:  96, colour: 6, kind: 'sedan' },
    { x: -150, z: 120, colour: 2, kind: 'coupe' },
    { x:  200, z: -30, colour: 0, kind: 'sedan' },
    { x: -200, z: -60, colour: 4, kind: 'van' },
  ],
};
