import * as T from "three";
import type { CharacterId } from "../../shared/characters";
import { figureCharacter } from "../figures/character";
import { preloadFigures } from "../figures/catalog";
import { SceneKit } from "./sceneKit";

export const loadHomeCast = (ids: readonly CharacterId[]) => preloadFigures(ids);

/** A decorative greeting only: no input, randomness, game state or extra WebGL contexts. */
export function createHomeParty(host: HTMLElement, ids: readonly CharacterId[], onError: () => void) {
  const kit = new SceneKit(host, onError, { alpha: true });
  let frame = 0;
  let disposed = false;
  try {
    kit.scene.background = null;
    kit.scene.fog = null;
    kit.renderer.setClearColor(0, 0);
    kit.renderer.shadowMap.enabled = false;
    kit.renderer.toneMapping = T.NoToneMapping;
    kit.camera.fov = 32;
    kit.camera.position.set(0, 3.1, 7.2);
    kit.camera.lookAt(0, .7, 0);
    kit.camera.updateProjectionMatrix();

    const world = new T.Group();
    kit.scene.add(world);
    const base = kit.cylinder(world, 0x24133f, 0, -.12, 0, 1, 1);
    base.scale.set(3.55, .27, 1.35);
    const top = kit.cylinder(world, 0x57e4cb, 0, .04, 0, 1, 1);
    top.scale.set(3.55, .16, 1.35);
    const inset = kit.cylinder(world, 0x34c5b2, 0, .125, 0, 1, 1);
    inset.scale.set(3.25, .012, 1.13);

    const positions = [[-2.35, -.12], [-.85, .2], [.85, .25], [2.3, -.08]];
    const actors = ids.map((id, index) => {
      const figure = figureCharacter(world, id);
      const [x, z] = positions[index];
      figure.group.scale.setScalar(1.3);
      figure.group.position.set(x, .15, z);
      // Soft contact shadows keep the tiny scene inexpensive on phones.
      const shadow = kit.cylinder(world, 0x259f98, x, .145, z, .46, .008);
      shadow.scale.z = .65;
      return { figure, x, z, heading: [.3, .12, -.15, -.3][index] };
    });

    const die = new T.Group();
    world.add(die);
    kit.box(die, 0xffe44e, 0, 0, 0, .48, .48, .48);
    for (const [x, y] of [[-.12, -.12], [0, 0], [.12, .12]]) kit.ball(die, 0x24133f, x, y, .247, .038, .038, .012);
    for (const [x, z] of [[-.12, -.12], [.12, .12]]) kit.ball(die, 0x24133f, x, .247, z, .038, .012, .038);
    const card = kit.box(world, 0xff86c8, -1.6, .17, .85, .4, .025, .58);
    card.rotation.y = -.35;
    const cardMark = kit.box(world, 0xfff9ed, -1.6, .19, .85, .13, .012, .13);
    cardMark.rotation.y = .4;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const started = performance.now();
    let lastRender = -Infinity;
    const duration = 4600;

    function draw(now: number) {
      if (disposed) return;
      const elapsed = now - started;
      const still = media.matches || elapsed >= duration;
      // The greeting ends in a static pose; it never becomes a perpetual render loop.
      host.dataset.motion = still ? "still" : "greeting";
      for (const [index, actor] of actors.entries()) {
        const entrance = still ? 1 : T.MathUtils.smoothstep(elapsed, index * 100, 700 + index * 100);
        const hop = still ? 0 : Math.max(0, Math.sin(T.MathUtils.clamp((elapsed - 1350 - index * 180) / 650, 0, 1) * Math.PI));
        actor.figure.group.position.set(actor.x, .15 + hop * .24, actor.z);
        actor.figure.group.scale.setScalar(1.3 * (.8 + entrance * .2));
        const reaction = still ? 0 : Math.sin(T.MathUtils.clamp((elapsed - 900) / 2600, 0, 1) * Math.PI);
        actor.figure.pose(actor.heading + (index < 2 ? .28 : -.28) * reaction, 0, now, hop, false, still);
      }
      const toss = still ? 1 : T.MathUtils.clamp((elapsed - 900) / 1500, 0, 1);
      die.position.set(-.1 + toss * .3, .39 + Math.sin(toss * Math.PI) * 1.1, .8);
      die.rotation.set(.15 + (1 - toss) * Math.PI * 3, .3 + (1 - toss) * Math.PI * 2, .1);
      kit.render();
    }

    function tick(now: number) {
      frame = 0;
      if (disposed || document.hidden) return;
      const finished = media.matches || now - started >= duration;
      if (finished || now - lastRender >= 32) { draw(now); lastRender = now; }
      if (!finished) frame = requestAnimationFrame(tick);
    }
    function refresh() {
      cancelAnimationFrame(frame);
      frame = 0;
      if (!disposed && !document.hidden) tick(performance.now());
    }
    const resize = new ResizeObserver(refresh);
    resize.observe(host);
    media.addEventListener("change", refresh);
    document.addEventListener("visibilitychange", refresh);
    draw(started);
    frame = requestAnimationFrame(tick);
    return {
      dispose() {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(frame);
        resize.disconnect();
        media.removeEventListener("change", refresh);
        document.removeEventListener("visibilitychange", refresh);
        delete host.dataset.motion;
        kit.dispose();
      }
    };
  } catch (error) {
    cancelAnimationFrame(frame);
    kit.dispose();
    throw error;
  }
}
