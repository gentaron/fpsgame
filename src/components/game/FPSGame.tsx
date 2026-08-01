'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/store/game-store';

// Shared player world position
const playerWorldPos = new THREE.Vector3(0, 0, 0);
let playerRotY = 0;
let playerFacingAngle = 0;

// ============ PRELOAD GLB ============
useGLTF.preload('/yuma.glb');

// ============ THIRD-PERSON CAMERA ============
function ThirdPersonCamera() {
  const { camera, gl } = useThree();
  const mouseDown = useRef(false);
  const prevMouse = useRef({ x: 0, y: 0 });
  const yaw = useRef(0);
  const pitch = useRef(0.3);
  const CAMERA_DISTANCE = 7;
  const CAMERA_HEIGHT = 3.5;
  const SENSITIVITY = 0.003;

  useEffect(() => {
    const canvas = gl.domElement;
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 || e.button === 2) {
        mouseDown.current = true;
        prevMouse.current = { x: e.clientX, y: e.clientY };
      }
    };
    const onMouseUp = () => { mouseDown.current = false; };
    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDown.current) return;
      const dx = e.clientX - prevMouse.current.x;
      const dy = e.clientY - prevMouse.current.y;
      prevMouse.current = { x: e.clientX, y: e.clientY };
      yaw.current -= dx * SENSITIVITY;
      pitch.current = Math.max(-0.2, Math.min(1.2, pitch.current + dy * SENSITIVITY));
    };
    const onContextMenu = (e: Event) => e.preventDefault();

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('contextmenu', onContextMenu);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }, [gl]);

  useFrame(() => {
    const px = playerWorldPos.x;
    const pz = playerWorldPos.z;
    const camX = px + Math.sin(yaw.current) * CAMERA_DISTANCE;
    const camZ = pz + Math.cos(yaw.current) * CAMERA_DISTANCE;
    const camY = CAMERA_HEIGHT + pitch.current * 3;

    camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.15);
    camera.lookAt(px, 1.2, pz);
    playerRotY = yaw.current;
  });

  return null;
}

// ============ PLAYER CHARACTER ============
function PlayerCharacter() {
  const groupRef = useRef<THREE.Group>(null);
  const moveState = useRef({ forward: false, backward: false, left: false, right: false });
  const velocity = useRef(new THREE.Vector3());
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const walkPhase = useRef(0);
  const SPEED = 10;
  const FRICTION = 8;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': moveState.current.forward = true; break;
        case 'KeyS': case 'ArrowDown': moveState.current.backward = true; break;
        case 'KeyA': case 'ArrowLeft': moveState.current.left = true; break;
        case 'KeyD': case 'ArrowRight': moveState.current.right = true; break;
        case 'KeyR': useGameStore.getState().reload(); break;
        case 'Space': e.preventDefault(); useGameStore.getState().meleeAttack(); break;
        case 'KeyG': useGameStore.getState().throwGrenade(); break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': moveState.current.forward = false; break;
        case 'KeyS': case 'ArrowDown': moveState.current.backward = false; break;
        case 'KeyA': case 'ArrowLeft': moveState.current.left = false; break;
        case 'KeyD': case 'ArrowRight': moveState.current.right = false; break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const { isPlaying } = useGameStore.getState();
    if (!isPlaying) return;

    const dt = Math.min(delta, 0.1);
    const dir = new THREE.Vector3();
    if (moveState.current.forward) dir.z -= 1;
    if (moveState.current.backward) dir.z += 1;
    if (moveState.current.left) dir.x -= 1;
    if (moveState.current.right) dir.x += 1;

    const isMoving = dir.lengthSq() > 0;
    if (isMoving) dir.normalize();

    const euler = new THREE.Euler(0, playerRotY, 0, 'YXZ');
    dir.applyEuler(euler);

    velocity.current.x += dir.x * SPEED * dt;
    velocity.current.z += dir.z * SPEED * dt;
    velocity.current.x *= Math.max(0, 1 - FRICTION * dt);
    velocity.current.z *= Math.max(0, 1 - FRICTION * dt);

    groupRef.current.position.x += velocity.current.x * dt;
    groupRef.current.position.z += velocity.current.z * dt;
    groupRef.current.position.x = Math.max(-24, Math.min(24, groupRef.current.position.x));
    groupRef.current.position.z = Math.max(-24, Math.min(24, groupRef.current.position.z));
    groupRef.current.position.y = 0;

    if (isMoving) {
      const targetRot = Math.atan2(velocity.current.x, velocity.current.z);
      playerFacingAngle = targetRot;
      let diff = targetRot - groupRef.current.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      groupRef.current.rotation.y += diff * 0.15;
    }

    if (isMoving) {
      walkPhase.current += dt * 10;
      const swing = Math.sin(walkPhase.current) * 0.5;
      if (leftLegRef.current) leftLegRef.current.rotation.x = swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -swing;
      if (leftArmRef.current) leftArmRef.current.rotation.x = -swing * 0.6;
      if (rightArmRef.current) rightArmRef.current.rotation.x = swing * 0.6;
    } else {
      if (leftArmRef.current) leftArmRef.current.rotation.x *= 0.9;
      if (rightArmRef.current) rightArmRef.current.rotation.x *= 0.9;
      if (leftLegRef.current) leftLegRef.current.rotation.x *= 0.9;
      if (rightLegRef.current) rightLegRef.current.rotation.x *= 0.9;
    }

    playerWorldPos.copy(groupRef.current.position);
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[0.7, 0.9, 0.4]} />
        <meshStandardMaterial color="#3366aa" />
      </mesh>
      <mesh position={[0, 0.72, 0]} castShadow>
        <boxGeometry args={[0.72, 0.15, 0.42]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      <mesh position={[0, 1.85, 0]} castShadow>
        <boxGeometry args={[0.4, 0.45, 0.4]} />
        <meshStandardMaterial color="#eebb88" />
      </mesh>
      <mesh position={[0, 2.12, 0]} castShadow>
        <boxGeometry args={[0.46, 0.15, 0.46]} />
        <meshStandardMaterial color="#225522" />
      </mesh>
      <mesh position={[-0.08, 1.88, 0.2]}>
        <boxGeometry args={[0.08, 0.06, 0.02]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      <mesh position={[0.08, 1.88, 0.2]}>
        <boxGeometry args={[0.08, 0.06, 0.02]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      <group position={[-0.52, 1.45, 0]} ref={leftArmRef}>
        <mesh position={[0, -0.35, 0]} castShadow>
          <boxGeometry args={[0.22, 0.7, 0.22]} />
          <meshStandardMaterial color="#3366aa" />
        </mesh>
        <mesh position={[0, -0.72, 0]}>
          <boxGeometry args={[0.16, 0.12, 0.16]} />
          <meshStandardMaterial color="#eebb88" />
        </mesh>
        {/* Sword on left arm */}
        <MeleeWeapon />
      </group>
      <group position={[0.52, 1.45, 0]} ref={rightArmRef}>
        <mesh position={[0, -0.35, 0]} castShadow>
          <boxGeometry args={[0.22, 0.7, 0.22]} />
          <meshStandardMaterial color="#3366aa" />
        </mesh>
        <mesh position={[0, -0.72, 0]}>
          <boxGeometry args={[0.16, 0.12, 0.16]} />
          <meshStandardMaterial color="#eebb88" />
        </mesh>
        <TPSGun />
      </group>
      <group position={[-0.18, 0.65, 0]} ref={leftLegRef}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.28, 0.6, 0.28]} />
          <meshStandardMaterial color="#444466" />
        </mesh>
        <mesh position={[0, -0.63, 0.03]}>
          <boxGeometry args={[0.28, 0.12, 0.35]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
      </group>
      <group position={[0.18, 0.65, 0]} ref={rightLegRef}>
        <mesh position={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.28, 0.6, 0.28]} />
          <meshStandardMaterial color="#444466" />
        </mesh>
        <mesh position={[0, -0.63, 0.03]}>
          <boxGeometry args={[0.28, 0.12, 0.35]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
      </group>
      {/* Melee slash effect */}
      <MeleeSlashEffect />
    </group>
  );
}

// ============ MELEE WEAPON (sword on left arm) ============
function MeleeWeapon() {
  return (
    <group position={[0, -0.75, -0.15]}>
      {/* Blade */}
      <mesh rotation={[0, 0, 0.2]} castShadow>
        <boxGeometry args={[0.04, 0.6, 0.08]} />
        <meshStandardMaterial color="#cccccc" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Guard */}
      <mesh position={[0, 0.32, 0]}>
        <boxGeometry args={[0.15, 0.04, 0.04]} />
        <meshStandardMaterial color="#ccaa44" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Handle */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[0.05, 0.15, 0.05]} />
        <meshStandardMaterial color="#5a3a1a" roughness={0.9} />
      </mesh>
    </group>
  );
}

// ============ MELEE SLASH VISUAL EFFECT ============
function MeleeSlashEffect() {
  const { isMeleeAttacking } = useGameStore();
  const slashRef = useRef<THREE.Group>(null);
  const phase = useRef(0);

  useFrame((_, delta) => {
    if (!slashRef.current) return;
    if (isMeleeAttacking) {
      phase.current += delta * 12;
      slashRef.current.rotation.y = -1.5 + phase.current * 2.5;
      slashRef.current.visible = true;
    } else {
      phase.current = 0;
      slashRef.current.visible = false;
    }
  });

  return (
    <group ref={slashRef} position={[0, 1.0, -0.8]} visible={false}>
      <mesh>
        <torusGeometry args={[1.2, 0.03, 4, 20, Math.PI * 0.7]} />
        <meshStandardMaterial color="#88ddff" emissive="#44aaff" emissiveIntensity={2} transparent opacity={0.8} />
      </mesh>
      <mesh>
        <torusGeometry args={[1.0, 0.02, 4, 20, Math.PI * 0.7]} />
        <meshStandardMaterial color="#aaddff" emissive="#66bbff" emissiveIntensity={3} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

// ============ MELEE ATTACK SYSTEM ============
function MeleeAttackSystem() {
  const { enemies, hitEnemy, removeEnemy, meleeAttack, isMeleeAttacking } = useGameStore();
  const hasProcessed = useRef(false);

  useFrame(() => {
    if (isMeleeAttacking && !hasProcessed.current) {
      hasProcessed.current = true;
      // Area damage: hit all enemies within 3 units of player
      const hitIds: string[] = [];
      enemies.forEach((enemy) => {
        const ePos = new THREE.Vector3(...enemy.position);
        const dist = ePos.distanceTo(playerWorldPos);
        if (dist < 3.0) {
          hitEnemy(enemy.id);
          hitIds.push(enemy.id);
        }
      });
      // Remove hit enemies after delay
      setTimeout(() => {
        hitIds.forEach((id) => removeEnemy(id));
      }, 150);
    }
    if (!isMeleeAttacking) {
      hasProcessed.current = false;
    }
  });

  return null;
}

// ============ GRENADE SYSTEM ============
function GrenadeSystem() {
  const { camera, scene } = useThree();
  const { throwGrenade, grenadeCount, hitEnemy, removeEnemy, enemies } = useGameStore();
  const grenades = useRef<{ mesh: THREE.Mesh; velocity: THREE.Vector3; timer: number; pos: THREE.Vector3 }[]>([]);
  const explosions = useRef<{ light: THREE.PointLight; timer: number }[]>([]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);

    // Subscribe to grenade throws
    const state = useGameStore.getState();

    // Update grenades
    for (let i = grenades.current.length - 1; i >= 0; i--) {
      const g = grenades.current[i];
      g.velocity.y -= 15 * dt; // gravity
      g.pos.add(g.velocity.clone().multiplyScalar(dt));
      g.mesh.position.copy(g.pos);
      g.timer -= dt;

      if (g.timer <= 0 || g.pos.y < 0) {
        // Explode
        scene.remove(g.mesh);
        grenades.current.splice(i, 1);

        // Create explosion
        const light = new THREE.PointLight('#ff6600', 20, 12);
        light.position.copy(g.pos);
        light.position.y = Math.max(0.5, g.pos.y);
        scene.add(light);
        explosions.current.push({ light, timer: 0.3 });

        // Damage enemies within 5 units
        const hitIds: string[] = [];
        enemies.forEach((enemy) => {
          const ePos = new THREE.Vector3(...enemy.position);
          const dist = ePos.distanceTo(g.pos);
          if (dist < 5.0) {
            hitEnemy(enemy.id);
            hitIds.push(enemy.id);
          }
        });
        setTimeout(() => {
          hitIds.forEach((id) => removeEnemy(id));
        }, 150);
      }
    }

    // Update explosions
    for (let i = explosions.current.length - 1; i >= 0; i--) {
      const ex = explosions.current[i];
      ex.timer -= dt;
      ex.light.intensity = Math.max(0, ex.timer / 0.3) * 20;
      if (ex.timer <= 0) {
        scene.remove(ex.light);
        explosions.current.splice(i, 1);
      }
    }
  });

  useEffect(() => {
    let prevCount = grenadeCount;
    const unsub = useGameStore.subscribe((s) => {
      if (s.grenadeCount < prevCount) {
        // Spawn grenade
        const geo = new THREE.SphereGeometry(0.12, 8, 8);
        const mat = new THREE.MeshStandardMaterial({ color: '#446633' });
        const mesh = new THREE.Mesh(geo, mat);
        const startPos = playerWorldPos.clone();
        startPos.y = 1.5;
        mesh.position.copy(startPos);
        scene.add(mesh);

        // Calculate throw direction (camera forward)
        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), playerFacingAngle);
        dir.y = 0.5;
        dir.normalize().multiplyScalar(18);

        grenades.current.push({
          mesh,
          velocity: dir,
          timer: 1.5,
          pos: startPos.clone(),
        });
      }
      prevCount = s.grenadeCount;
    });
    return unsub;
  }, [scene, grenadeCount, hitEnemy, removeEnemy, enemies]);

  return null;
}

// ============ THIRD-PERSON GUN MODEL ============
function TPSGun() {
  const gunRef = useRef<THREE.Group>(null);
  const recoilRef = useRef(0);

  useFrame(() => {
    if (!gunRef.current) return;
    if (recoilRef.current > 0) {
      recoilRef.current *= 0.85;
      if (recoilRef.current < 0.001) recoilRef.current = 0;
    }
    gunRef.current.rotation.x = -recoilRef.current * 0.4;
    gunRef.current.position.z = -0.15 - 0.03 * recoilRef.current;
  });

  useEffect(() => {
    const unsub = useGameStore.subscribe((state, prev) => {
      if (state.ammo < prev.ammo) {
        recoilRef.current = 1;
      }
    });
    return unsub;
  }, []);

  const { isReloading } = useGameStore();
  const reloadOffset = isReloading ? 0.3 : 0;

  return (
    <group ref={gunRef} position={[0, -0.6 + reloadOffset, -0.15]}>
      <mesh castShadow>
        <boxGeometry args={[0.08, 0.1, 0.45]} />
        <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.02, -0.3]} castShadow>
        <cylinderGeometry args={[0.02, 0.025, 0.22, 8]} />
        <meshStandardMaterial color="#333333" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, -0.1, 0.08]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[0.06, 0.16, 0.07]} />
        <meshStandardMaterial color="#4a3520" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.1, -0.04]}>
        <boxGeometry args={[0.05, 0.14, 0.07]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.07, -0.18]}>
        <boxGeometry args={[0.02, 0.04, 0.02]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
    </group>
  );
}

// ============ SHOOTING (raycasting from camera center) ============
function ShootingSystem() {
  const { camera, scene } = useThree();
  const { shoot, hitEnemy, removeEnemy } = useGameStore();
  const raycaster = useRef(new THREE.Raycaster());
  const muzzleRef = useRef<THREE.PointLight>(null);
  const muzzleTimer = useRef(0);

  useFrame((_, delta) => {
    if (muzzleTimer.current > 0) {
      muzzleTimer.current -= delta;
      if (muzzleTimer.current <= 0 && muzzleRef.current) {
        muzzleRef.current.intensity = 0;
      }
    }
  });

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const state = useGameStore.getState();
      if (!state.isPlaying) return;
      if (state.ammo <= 0 || state.isReloading) {
        useGameStore.getState().reload();
        return;
      }
      shoot();

      if (muzzleRef.current) {
        muzzleRef.current.position.copy(playerWorldPos);
        muzzleRef.current.position.y = 1.0;
        muzzleRef.current.intensity = 8;
        muzzleTimer.current = 0.05;
      }

      raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
      const enemyMeshes: THREE.Object3D[] = [];
      scene.traverse((child) => {
        if ((child as THREE.Mesh).userData?.enemyId) {
          enemyMeshes.push(child);
        }
      });
      const intersects = raycaster.current.intersectObjects(enemyMeshes, true);
      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && !(obj as THREE.Mesh).userData?.enemyId) obj = obj.parent;
        if (obj && (obj as THREE.Mesh).userData?.enemyId) {
          const enemyId = (obj as THREE.Mesh).userData.enemyId;
          hitEnemy(enemyId);
          setTimeout(() => removeEnemy(enemyId), 150);
        }
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [camera, scene, shoot, hitEnemy, removeEnemy]);

  return <pointLight ref={muzzleRef} intensity={0} distance={8} color="#ffaa00" />;
}

// ============ ENVIRONMENT (BRIGHTER) ============
function Floor() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 256; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 16);
    return tex;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial map={texture} roughness={0.7} />
    </mesh>
  );
}

function Ceiling() {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 6, 0]}>
      <planeGeometry args={[50, 50]} />
      <meshStandardMaterial color="#3a3a3a" />
    </mesh>
  );
}

function Walls() {
  const wallData = [
    { pos: [0, 3, -25] as [number, number, number], rot: [0, 0, 0] as [number, number, number], color: '#5a5a5a' },
    { pos: [0, 3, 25] as [number, number, number], rot: [0, Math.PI, 0] as [number, number, number], color: '#5a5a5a' },
    { pos: [-25, 3, 0] as [number, number, number], rot: [0, Math.PI / 2, 0] as [number, number, number], color: '#505050' },
    { pos: [25, 3, 0] as [number, number, number], rot: [0, -Math.PI / 2, 0] as [number, number, number], color: '#505050' },
  ];
  return (
    <>
      {wallData.map((w, i) => (
        <mesh key={i} position={w.pos} rotation={w.rot} receiveShadow>
          <planeGeometry args={[50, 6]} />
          <meshStandardMaterial color={w.color} />
        </mesh>
      ))}
    </>
  );
}

function Obstacles() {
  const obstacles = [
    { pos: [5, 1.5, -8] as [number, number, number], size: [2, 3, 2] as [number, number, number], color: '#777777' },
    { pos: [-7, 1.5, -12] as [number, number, number], size: [3, 3, 1.5] as [number, number, number], color: '#886666' },
    { pos: [10, 1.5, 5] as [number, number, number], size: [1.5, 3, 4] as [number, number, number], color: '#667788' },
    { pos: [-12, 1.5, 8] as [number, number, number], size: [4, 3, 1.5] as [number, number, number], color: '#778866' },
    { pos: [0, 1.5, -15] as [number, number, number], size: [6, 3, 1] as [number, number, number], color: '#886677' },
    { pos: [-5, 1.5, 15] as [number, number, number], size: [2, 3, 2] as [number, number, number], color: '#777777' },
    { pos: [15, 1.5, -15] as [number, number, number], size: [2, 3, 3] as [number, number, number], color: '#668866' },
    { pos: [-15, 1.5, -5] as [number, number, number], size: [3, 3, 2] as [number, number, number], color: '#776688' },
  ];
  return (
    <>
      {obstacles.map((o, i) => (
        <mesh key={i} position={o.pos} castShadow receiveShadow>
          <boxGeometry args={o.size} />
          <meshStandardMaterial color={o.color} />
        </mesh>
      ))}
    </>
  );
}

// ============ ENEMIES (yuma.glb) ============
function EnemyModel({ url, isHit }: { url: string; isHit: boolean }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const clone = scene.clone(true);
    // Tag all meshes for raycasting
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).castShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return <primitive object={cloned} />;
}

function Enemy({ id, position, isHit }: { id: string; position: [number, number, number]; isHit: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const bobPhase = useRef(Math.random() * Math.PI * 2);
  const modelScale = 1.0;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const { isPlaying, isGameOver } = useGameStore.getState();
    if (!isPlaying || isGameOver) return;

    const target = playerWorldPos;
    const dir = new THREE.Vector3(
      target.x - groupRef.current.position.x,
      0,
      target.z - groupRef.current.position.z
    );
    const dist = dir.length();
    if (dist > 2) {
      dir.normalize();
      const speed = 2.5;
      groupRef.current.position.x += dir.x * speed * delta;
      groupRef.current.position.z += dir.z * speed * delta;
      groupRef.current.lookAt(target.x, groupRef.current.position.y, target.z);
    }

    // Walking bob
    bobPhase.current += delta * 6;
    groupRef.current.position.y = Math.abs(Math.sin(bobPhase.current)) * 0.08;

    // Flash red on hit
    if (isHit) {
      groupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          mat.emissive = new THREE.Color('#ff0000');
          mat.emissiveIntensity = 0.8;
        }
      });
    } else {
      groupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && (child as THREE.Mesh).material) {
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (mat.emissiveIntensity > 0) {
            mat.emissiveIntensity = 0;
          }
        }
      });
    }
  });

  return (
    <group ref={groupRef} position={position} userData={{ enemyId: id }}>
      <group scale={[modelScale, modelScale, modelScale]}>
        <EnemyModel url="/yuma.glb" isHit={isHit} />
      </group>
    </group>
  );
}

// ============ ENEMY SPAWNER ============
function EnemySpawner() {
  const { spawnEnemy, isPlaying, isGameOver, enemies, nextWave, wave } = useGameStore();
  const lastSpawn = useRef(Date.now());
  const spawnedCount = useRef(0);
  const waveEnemyCount = useRef(5);

  const spawnPositions: [number, number, number][] = [
    [-20, 0, -20], [20, 0, -20], [-20, 0, 20], [20, 0, 20],
    [0, 0, -22], [0, 0, 22], [-22, 0, 0], [22, 0, 0],
    [-15, 0, -15], [15, 0, 15], [-15, 0, 15], [15, 0, -15],
  ];

  useFrame(() => {
    if (!isPlaying || isGameOver) return;
    const now = Date.now();

    if (spawnedCount.current >= waveEnemyCount.current && enemies.length === 0) {
      nextWave();
      spawnedCount.current = 0;
      waveEnemyCount.current = 5 + wave * 2;
      lastSpawn.current = now;
      // Replenish grenades on new wave
      useGameStore.setState({ grenadeCount: useGameStore.getState().maxGrenades });
      return;
    }

    const spawnInterval = Math.max(800, 2000 - wave * 150);
    if (now - lastSpawn.current > spawnInterval && spawnedCount.current < waveEnemyCount.current) {
      const pos = spawnPositions[Math.floor(Math.random() * spawnPositions.length)];
      const offset: [number, number, number] = [
        pos[0] + (Math.random() - 0.5) * 4,
        pos[1],
        pos[2] + (Math.random() - 0.5) * 4,
      ];
      spawnEnemy(offset);
      spawnedCount.current++;
      lastSpawn.current = now;
    }
  });

  return null;
}

// ============ ENEMY AI ============
function EnemyAI() {
  const { enemies, damagePlayer, isPlaying, isGameOver } = useGameStore();
  const lastDamage = useRef<Record<string, number>>({});

  useFrame(() => {
    if (!isPlaying || isGameOver) return;
    const now = Date.now();

    enemies.forEach((enemy) => {
      const enemyPos = new THREE.Vector3(...enemy.position);
      const dist = enemyPos.distanceTo(playerWorldPos);
      if (dist < 2.5) {
        const last = lastDamage.current[enemy.id] || 0;
        if (now - last > 1000) {
          damagePlayer(10);
          lastDamage.current[enemy.id] = now;
        }
      }
    });
  });

  return null;
}

// ============ LIGHTING (BRIGHTER) ============
function Lighting() {
  return (
    <>
      <ambientLight intensity={0.7} />
      <hemisphereLight args={['#b1e1ff', '#b97a20', 0.5]} />
      <directionalLight
        position={[10, 15, 10]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[0, 5, 0]} intensity={1.0} color="#ffffff" />
      <pointLight position={[-15, 4, -15]} intensity={0.6} color="#ffcc88" />
      <pointLight position={[15, 4, 15]} intensity={0.6} color="#88ccff" />
      <pointLight position={[0, 4, -20]} intensity={0.4} color="#ffaaaa" />
      <pointLight position={[0, 4, 20]} intensity={0.4} color="#aaffaa" />
    </>
  );
}

// ============ MAIN SCENE ============
function GameScene() {
  const { enemies } = useGameStore();

  return (
    <>
      <ThirdPersonCamera />
      <PlayerCharacter />
      <ShootingSystem />
      <MeleeAttackSystem />
      <GrenadeSystem />
      <EnemySpawner />
      <EnemyAI />
      <Lighting />
      <fog attach="fog" args={['#667788', 15, 55]} />
      <Floor />
      <Ceiling />
      <Walls />
      <Obstacles />
      {enemies.map((enemy) => (
        <Enemy key={enemy.id} id={enemy.id} position={enemy.position} isHit={enemy.isHit} />
      ))}
    </>
  );
}

// ============ HUD OVERLAY ============
function HUD() {
  const {
    score, ammo, maxAmmo, health, maxHealth, kills, wave,
    isReloading, crosshairHit, isPlaying, isGameOver,
    meleeCooldown, grenadeCount, maxGrenades,
  } = useGameStore();

  if (!isPlaying && !isGameOver) return null;

  const healthPercent = (health / maxHealth) * 100;
  const healthColor = healthPercent > 60 ? '#4ade80' : healthPercent > 30 ? '#fbbf24' : '#ef4444';

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative w-8 h-8">
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-3 ${crosshairHit ? 'bg-red-500' : 'bg-white/80'}`} />
          <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-3 ${crosshairHit ? 'bg-red-500' : 'bg-white/80'}`} />
          <div className={`absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-3 ${crosshairHit ? 'bg-red-500' : 'bg-white/80'}`} />
          <div className={`absolute right-0 top-1/2 -translate-y-1/2 h-0.5 w-3 ${crosshairHit ? 'bg-red-500' : 'bg-white/80'}`} />
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full border-2 ${crosshairHit ? 'border-red-500 bg-red-500/50' : 'border-white/60 bg-transparent'}`} />
        </div>
      </div>

      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
          <div className="text-xs text-gray-300 uppercase tracking-wider">Score</div>
          <div className="text-2xl font-bold text-white font-mono">{score}</div>
        </div>
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10 text-center">
          <div className="text-xs text-gray-300 uppercase tracking-wider">Wave</div>
          <div className="text-2xl font-bold text-yellow-400 font-mono">{wave}</div>
        </div>
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10 text-right">
          <div className="text-xs text-gray-300 uppercase tracking-wider">Kills</div>
          <div className="text-2xl font-bold text-white font-mono">{kills}</div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
        {/* Health */}
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/10 min-w-[200px]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-400 text-sm font-bold">+</span>
            <span className="text-xs text-gray-300 uppercase tracking-wider">Health</span>
          </div>
          <div className="w-full bg-gray-600 rounded-full h-3 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${healthPercent}%`, backgroundColor: healthColor }} />
          </div>
          <div className="text-right text-sm font-mono mt-1" style={{ color: healthColor }}>{health} / {maxHealth}</div>
        </div>

        {/* Attack buttons row */}
        <div className="flex gap-3 items-end">
          {/* Melee */}
          <div className={`bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 border text-center ${meleeCooldown ? 'border-yellow-500/30' : 'border-cyan-400/30'}`}>
            <div className="text-[10px] text-gray-400 uppercase">Melee</div>
            <div className={`text-sm font-bold font-mono ${meleeCooldown ? 'text-gray-500' : 'text-cyan-400'}`}>SPACE</div>
          </div>

          {/* Grenade */}
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 border border-orange-400/30 text-center">
            <div className="text-[10px] text-gray-400 uppercase">Grenade</div>
            <div className="text-sm font-bold font-mono text-orange-400">G x{grenadeCount}</div>
          </div>

          {/* Ammo */}
          <div className="bg-black/50 backdrop-blur-sm rounded-lg px-6 py-3 border border-white/10 text-center">
            {isReloading ? (
              <div className="text-yellow-400 text-lg font-bold animate-pulse">RELOADING...</div>
            ) : (
              <>
                <div className="text-xs text-gray-300 uppercase tracking-wider mb-1">Ammo</div>
                <div className={`text-3xl font-bold font-mono ${ammo <= 5 ? 'text-red-400' : 'text-white'}`}>
                  {ammo}<span className="text-gray-400 text-lg"> / {maxAmmo}</span>
                </div>
              </>
            )}
            <div className="text-[10px] text-gray-500 mt-1">R to reload</div>
          </div>
        </div>
      </div>

      {/* Game Over */}
      {isGameOver && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center pointer-events-auto">
          <div className="text-center">
            <h2 className="text-5xl font-bold text-red-500 mb-4">GAME OVER</h2>
            <div className="text-xl text-gray-300 mb-2">Final Score: <span className="text-white font-bold">{score}</span></div>
            <div className="text-lg text-gray-400 mb-6">Wave: {wave} | Kills: {kills}</div>
            <button className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-lg transition-colors cursor-pointer"
              onClick={() => useGameStore.getState().resetGame()}>PLAY AGAIN</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ START SCREEN ============
function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
      <div className="text-center max-w-md px-6">
        <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">
          TPS <span className="text-red-500">ARENA</span>
        </h1>
        <p className="text-gray-400 mb-8">3D Third Person Shooter</p>

        <div className="bg-white/5 rounded-lg p-4 mb-8 border border-white/10 text-left">
          <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wider">Controls</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-400">Move</div>
            <div className="text-white font-mono">W A S D</div>
            <div className="text-gray-400">Camera</div>
            <div className="text-white font-mono">Right Drag</div>
            <div className="text-gray-400">Shoot</div>
            <div className="text-white font-mono">Left Click</div>
            <div className="text-gray-400">Melee</div>
            <div className="text-white font-mono">Space</div>
            <div className="text-gray-400">Grenade</div>
            <div className="text-white font-mono">G</div>
            <div className="text-gray-400">Reload</div>
            <div className="text-white font-mono">R</div>
          </div>
        </div>

        <button className="px-10 py-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-600/30 cursor-pointer"
          onClick={onStart}>CLICK TO START</button>
        <p className="text-gray-600 text-xs mt-4">Right-drag to rotate camera</p>
      </div>
    </div>
  );
}

// ============ EXPORTED COMPONENT ============
export default function TPSGame() {
  const [started, setStarted] = useState(false);
  const { startGame, resetGame, isPlaying, isGameOver } = useGameStore();

  const handleStart = useCallback(() => {
    resetGame();
    startGame();
    setStarted(true);
  }, [startGame, resetGame]);

  return (
    <div className="w-screen h-screen relative overflow-hidden bg-black" onContextMenu={(e) => e.preventDefault()}>
      <Canvas camera={{ fov: 60, near: 0.1, far: 100, position: [0, 4, 8] }} shadows gl={{ antialias: true }}>
        <GameScene />
      </Canvas>
      <HUD />
      {!started && <StartScreen onStart={handleStart} />}
    </div>
  );
}
