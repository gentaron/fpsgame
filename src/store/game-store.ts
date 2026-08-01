import { create } from 'zustand';

export interface Enemy {
  id: string;
  position: [number, number, number];
  health: number;
  isHit: boolean;
}

interface GameState {
  score: number;
  ammo: number;
  maxAmmo: number;
  health: number;
  maxHealth: number;
  enemies: Enemy[];
  isPlaying: boolean;
  isGameOver: boolean;
  kills: number;
  wave: number;
  isReloading: boolean;
  crosshairHit: boolean;

  // Actions
  startGame: () => void;
  resetGame: () => void;
  shoot: () => void;
  reload: () => void;
  hitEnemy: (id: string) => void;
  damagePlayer: (amount: number) => void;
  spawnEnemy: (position: [number, number, number]) => void;
  removeEnemy: (id: string) => void;
  setEnemies: (enemies: Enemy[]) => void;
  setCrosshairHit: (hit: boolean) => void;
  nextWave: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  score: 0,
  ammo: 30,
  maxAmmo: 30,
  health: 100,
  maxHealth: 100,
  enemies: [],
  isPlaying: false,
  isGameOver: false,
  kills: 0,
  wave: 1,
  isReloading: false,
  crosshairHit: false,

  startGame: () => set({ isPlaying: true, isGameOver: false }),

  resetGame: () =>
    set({
      score: 0,
      ammo: 30,
      health: 100,
      enemies: [],
      isPlaying: false,
      isGameOver: false,
      kills: 0,
      wave: 1,
      isReloading: false,
    }),

  shoot: () => {
    const { ammo, isReloading } = get();
    if (ammo > 0 && !isReloading) {
      set({ ammo: ammo - 1 });
    }
  },

  reload: () => {
    const { isReloading, ammo, maxAmmo } = get();
    if (!isReloading && ammo < maxAmmo) {
      set({ isReloading: true });
      setTimeout(() => {
        set({ ammo: maxAmmo, isReloading: false });
      }, 1500);
    }
  },

  hitEnemy: (id: string) => {
    const { enemies, score } = get();
    const updated = enemies.map((e) =>
      e.id === id ? { ...e, health: e.health - 1, isHit: true } : e
    );
    set({ enemies: updated, score: score + 10, crosshairHit: true });
    setTimeout(() => set({ crosshairHit: false }), 100);
  },

  damagePlayer: (amount: number) => {
    const { health, maxHealth } = get();
    const newHealth = Math.max(0, health - amount);
    set({ health: newHealth });
    if (newHealth <= 0) {
      set({ isGameOver: true, isPlaying: false });
    }
  },

  spawnEnemy: (position: [number, number, number]) => {
    const id = `enemy-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((state) => ({
      enemies: [...state.enemies, { id, position, health: 1, isHit: false }],
    }));
  },

  removeEnemy: (id: string) => {
    const { enemies, kills } = get();
    set({
      enemies: enemies.filter((e) => e.id !== id),
      kills: kills + 1,
    });
  },

  setEnemies: (enemies: Enemy[]) => set({ enemies }),

  setCrosshairHit: (hit: boolean) => set({ crosshairHit: hit }),

  nextWave: () =>
    set((state) => ({ wave: state.wave + 1 })),
}));
