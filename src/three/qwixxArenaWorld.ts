import * as T from "three";
import { character, PLAYER_COLORS, SceneKit } from "./sceneKit";
import type { QwixxArenaAction, QwixxArenaPlayer } from "../components/QwixxArenaWorld";

const FELT = 0x243b65, WOOD = 0x76503b, BRASS = 0xd5ae68;

interface ArenaFrame { activeId: string; action: QwixxArenaAction; reducedMotion: boolean }

/** Persistent top-down table. The DOM dice remain above it so they stay tactile and accessible. */
export function createQwixxArenaWorld(host: HTMLElement, players: QwixxArenaPlayer[], read: () => ArenaFrame, onError: () => void) {
  const kit = new SceneKit(host, onError), world = new T.Group(); kit.scene.add(world);
  kit.scene.background = new T.Color(0x0d1528); kit.scene.fog = null;
  kit.box(world, 0x10172a, 0, -.42, 0, 30, .5, 24).castShadow = false;
  for (let plank = 0; plank < 18; plank++) kit.box(world, plank % 2 ? 0x5c4033 : 0x684738, -11.9 + plank * 1.4, -.13, 0, 1.34, .05, 24).castShadow = false;
  kit.cylinder(world, WOOD, 0, .18, 0, 5.6, .55);
  kit.cylinder(world, BRASS, 0, .48, 0, 5.31, .08);
  const felt = kit.cylinder(world, FELT, 0, .54, 0, 5.17, .08);
  felt.material = new T.MeshStandardMaterial({ color: FELT, roughness: 1, metalness: 0 });
  const stitch = kit.mesh(world, new T.TorusGeometry(4.82, .025, 5, 96), 0x8ca4c5, 0, .595, 0); stitch.rotation.x = Math.PI / 2;
  // Four faint scoring lanes make the tabletop recognisably Qwixx without competing with the real sheet.
  [0xe75a59, 0xf1c84b, 0x39a879, 0x4b7fd1].forEach((color, index) => {
    const lane = kit.box(world, color, 0, .605, -1.1 + index * .72, 5.5, .012, .13);
    lane.material = new T.MeshStandardMaterial({ color, transparent: true, opacity: .2, roughness: 1 }); lane.castShadow = false;
  });

  const actors = new Map<string, ReturnType<typeof character>>(), bases = new Map<string, T.Vector3>();
  players.forEach((player, index) => {
    const angle = index / players.length * Math.PI * 2 + Math.PI / 2;
    const base = new T.Vector3(Math.sin(angle) * 4.25, .66, Math.cos(angle) * 4.25); bases.set(player.id, base);
    const chair = new T.Group(); chair.position.set(Math.sin(angle) * 4.95, .1, Math.cos(angle) * 4.95); chair.rotation.y = angle + Math.PI; world.add(chair);
    kit.box(chair, WOOD, 0, .65, 0, 1.05, .16, .92); kit.box(chair, WOOD, 0, 1.22, .4, 1.05, 1.05, .13);
    const actor = character(kit, world, index, player.name, player.characterId); actor.group.scale.setScalar(.82); actor.group.position.copy(base); actor.group.rotation.y = angle + Math.PI;
    const ring = kit.mesh(actor.group, new T.TorusGeometry(.55, .055, 6, 28), PLAYER_COLORS[index % PLAYER_COLORS.length], 0, .035, 0); ring.rotation.x = Math.PI / 2; ring.name = "turn-ring";
    actors.set(player.id, actor);
  });

  kit.camera.position.set(0, 15.8, 0); kit.camera.up.set(0, 0, -1); kit.camera.lookAt(0, .4, 0);
  let previousElapsed = 0;
  return {
    render(elapsed: number) {
      const frame = read(), dt = previousElapsed ? Math.min(.05, Math.max(0, (elapsed - previousElapsed) / 1000)) : 1 / 60; previousElapsed = elapsed;
      actors.forEach((actor, id) => {
        const base = bases.get(id)!; const active = id === frame.activeId;
        const reaching = active && (frame.action === "gathering" || frame.action === "throwing");
        const inward = base.clone().setLength(reaching ? 3.45 : 4.25); inward.y = base.y;
        actor.group.position.lerp(inward, frame.reducedMotion ? 1 : 1 - Math.exp(-dt * (reaching ? 10 : 6)));
        actor.group.getObjectByName("turn-ring")!.visible = active;
        actor.pose(actor.group.rotation.y, 0, elapsed, 0, reaching, frame.reducedMotion);
      });
      host.dataset.activePlayer = frame.activeId; host.dataset.action = frame.action; kit.render();
    },
    dispose() { kit.dispose(); }
  };
}
