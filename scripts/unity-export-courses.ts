// Exports the parcours runs of shared/matches/parcoursCourses.ts as flat JSON for the Unity runs
// (Unity's JsonUtility: no optional fields, unset indices -1). Run after course changes:
//   npx tsx scripts/unity-export-courses.ts
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { course, COURSE_IDS, FINAL_IDS, type CourseId } from "../shared/matches/parcoursCourses";

export const UNITY_COURSE_IDS = [...COURSE_IDS, ...FINAL_IDS] as const;
export const UNITY_COURSE_DIR = new URL("../unity/GoldenSchmidtUnity/Assets/GSG/Resources/GSG/Courses/", import.meta.url);

export function flatCourse(id: CourseId) {
  const c = course(id);
  return {
    id: c.id, name: c.name, width: c.width, finishZ: c.finishZ, finishY: c.finishY, killY: c.killY, finishX: c.finishX ?? 0,
    limitMs: c.limitMs ?? 120000, elimination: !!c.elimination, knock: c.knock ?? 1, seesaws: c.seesaws,
    boxes: c.boxes.map(b => ({ x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, z0: b.z0, z1: b.z1, look: b.look, belt: b.belt ?? 0, beltX: b.beltX ?? 0,
      door: b.door ?? -1, tile: b.tile ?? -1, seesaw: b.seesaw ?? -1,
      moveAxis: b.move?.axis ?? "", moveAmp: b.move?.amp ?? 0, movePeriod: b.move?.period ?? 0, movePhase: b.move?.phase ?? 0,
      blinkPeriod: b.blink?.period ?? 0, blinkPhase: b.blink?.phase ?? 0, blinkOpen: b.blink?.open ?? 0, blinkFrom: b.blink?.from ?? 0 })),
    sweepers: c.sweepers.map(s => ({ x: s.x, z: s.z, y0: s.y0, y1: s.y1, length: s.length, speed: s.speed, phase: s.phase, from: s.from ?? 0 })),
    checkpoints: c.checkpoints.map(p => ({ z: p.z, y: p.y, x: p.x ?? 0 })),
    doorRows: c.doorRows.map(r => ({ z: r.z, doors: r.doors, real: r.real, xs: r.xs })),
    laneRows: (c.laneRows ?? []).map(r => ({ z: r.z, exitZ: r.exitZ, fronts: r.lanes.map(l => l.front), exits: r.lanes.map(l => l.exit), floors: r.lanes.map(l => l.floor), xs: r.lanes.map(l => l.x), through: r.through, dead: r.dead, trap: r.trap })),
    tileRows: c.tileRows.map(r => ({ z: r.z, tiles: r.tiles })),
    winds: c.winds, hasGoo: !!c.goo, gooStart: c.goo?.start ?? 0, gooRate: c.goo?.rate ?? 0, gooDelay: c.goo?.delay ?? 0, gooAccel: c.goo?.accel ?? 0,
    route: c.route ?? []
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const id of UNITY_COURSE_IDS) writeFileSync(new URL(`${id}.json`, UNITY_COURSE_DIR), JSON.stringify(flatCourse(id)));
  console.log(`Unity-Strecken exportiert: ${UNITY_COURSE_IDS.join(", ")}`);
}
