/**
 * Small deterministic 2D rigid-body solver for stacking games, after
 * Erin Catto's Box2D-Lite: oriented boxes, box–box clipping with feature
 * ids, sequential impulses with accumulated, clamped impulses and warm
 * starting, Coulomb friction and Baumgarte position correction.
 *
 * Everything the solver keeps between steps (positions, velocities and the
 * warm-start impulses) is plain JSON, so a room restored from storage
 * continues exactly like an uninterrupted one. Bodies are compounds of
 * boxes ("fixtures") that share one centre of mass.
 */
export interface Vec { x: number; y: number }
export interface Fixture { x: number; y: number; hw: number; hh: number }
export interface RigidBody {
  id: number;
  x: number; y: number; a: number;
  vx: number; vy: number; w: number;
  /** 0 for static bodies. */
  invMass: number; invI: number;
  fixtures: Fixture[];
}
/** Accumulated normal and tangent impulse per contact feature, for warm starting. */
export type WarmStart = Record<string, [number, number]>;
export interface SolverOptions { gravity: number; iterations: number; friction: number; bias: number; slop: number }

interface ClipVertex { v: Vec; fp: number }
interface Contact { p: Vec; n: Vec; sep: number; key: string; a: RigidBody; b: RigidBody; pn: number; pt: number; mn: number; mt: number; bias: number; r1: Vec; r2: Vec }
interface Box { pos: Vec; c: number; s: number; hw: number; hh: number }

const dot = (a: Vec, b: Vec) => a.x * b.x + a.y * b.y;
const cross = (a: Vec, b: Vec) => a.x * b.y - a.y * b.x;
const rot = (c: number, s: number, v: Vec): Vec => ({ x: c * v.x - s * v.y, y: s * v.x + c * v.y });
const rotT = (c: number, s: number, v: Vec): Vec => ({ x: c * v.x + s * v.y, y: -s * v.x + c * v.y });

/** Feature ids pack (inEdge1, outEdge1, inEdge2, outEdge2) into one number. */
const EDGE1 = 1, EDGE2 = 2, EDGE3 = 3, EDGE4 = 4, NO_EDGE = 0;
const fp = (in1: number, out1: number, in2: number, out2: number) => in1 | out1 << 3 | in2 << 6 | out2 << 9;
const fpPart = (f: number, i: number) => (f >> (i * 3)) & 7;
const fpSet = (f: number, i: number, v: number) => (f & ~(7 << (i * 3))) | v << (i * 3);
const flip = (f: number) => fp(fpPart(f, 2), fpPart(f, 3), fpPart(f, 0), fpPart(f, 1));

/** World-space box of one fixture. */
export function fixtureBox(body: RigidBody, f: Fixture): Box {
  const c = Math.cos(body.a), s = Math.sin(body.a), p = rot(c, s, f);
  return { pos: { x: body.x + p.x, y: body.y + p.y }, c, s, hw: f.hw, hh: f.hh };
}

function incidentEdge(hw: number, hh: number, pos: Vec, c: number, s: number, normal: Vec): [ClipVertex, ClipVertex] {
  const n = rotT(c, s, normal); n.x = -n.x; n.y = -n.y;
  let v0: Vec, v1: Vec, f0: number, f1: number;
  if (Math.abs(n.x) > Math.abs(n.y)) {
    if (n.x > 0) { v0 = { x: hw, y: -hh }; f0 = fp(0, 0, EDGE3, EDGE4); v1 = { x: hw, y: hh }; f1 = fp(0, 0, EDGE4, EDGE1); }
    else { v0 = { x: -hw, y: hh }; f0 = fp(0, 0, EDGE1, EDGE2); v1 = { x: -hw, y: -hh }; f1 = fp(0, 0, EDGE2, EDGE3); }
  } else if (n.y > 0) { v0 = { x: hw, y: hh }; f0 = fp(0, 0, EDGE4, EDGE1); v1 = { x: -hw, y: hh }; f1 = fp(0, 0, EDGE1, EDGE2); }
  else { v0 = { x: -hw, y: -hh }; f0 = fp(0, 0, EDGE2, EDGE3); v1 = { x: hw, y: -hh }; f1 = fp(0, 0, EDGE3, EDGE4); }
  const w0 = rot(c, s, v0), w1 = rot(c, s, v1);
  return [{ v: { x: pos.x + w0.x, y: pos.y + w0.y }, fp: f0 }, { v: { x: pos.x + w1.x, y: pos.y + w1.y }, fp: f1 }];
}

function clip(vin: ClipVertex[], normal: Vec, offset: number, edge: number): ClipVertex[] {
  const out: ClipVertex[] = [];
  const d0 = dot(normal, vin[0].v) - offset, d1 = dot(normal, vin[1].v) - offset;
  if (d0 <= 0) out.push(vin[0]);
  if (d1 <= 0) out.push(vin[1]);
  if (d0 * d1 < 0) {
    const t = d0 / (d0 - d1), v = { x: vin[0].v.x + t * (vin[1].v.x - vin[0].v.x), y: vin[0].v.y + t * (vin[1].v.y - vin[0].v.y) };
    out.push(d0 > 0 ? { v, fp: fpSet(fpSet(vin[0].fp, 0, edge), 2, NO_EDGE) } : { v, fp: fpSet(fpSet(vin[1].fp, 1, edge), 3, NO_EDGE) });
  }
  return out;
}

/** Box–box contact points (at most two), normal from A to B. Empty when separated. */
export function collideBoxes(A: Box, B: Box): { p: Vec; n: Vec; sep: number; feature: number }[] {
  const dp = { x: B.pos.x - A.pos.x, y: B.pos.y - A.pos.y };
  const dA = rotT(A.c, A.s, dp), dB = rotT(B.c, B.s, dp);
  // C = RotA^T · RotB
  const cc = A.c * B.c + A.s * B.s, cs = A.c * B.s - A.s * B.c;
  const C11 = cc, C12 = -cs, C21 = cs, C22 = cc;
  const a11 = Math.abs(C11), a12 = Math.abs(C12), a21 = Math.abs(C21), a22 = Math.abs(C22);
  const faceAx = Math.abs(dA.x) - A.hw - (a11 * B.hw + a12 * B.hh), faceAy = Math.abs(dA.y) - A.hh - (a21 * B.hw + a22 * B.hh);
  if (faceAx > 0 || faceAy > 0) return [];
  const faceBx = Math.abs(dB.x) - (a11 * A.hw + a21 * A.hh) - B.hw, faceBy = Math.abs(dB.y) - (a12 * A.hw + a22 * A.hh) - B.hh;
  if (faceBx > 0 || faceBy > 0) return [];
  const colA1 = { x: A.c, y: A.s }, colA2 = { x: -A.s, y: A.c }, colB1 = { x: B.c, y: B.s }, colB2 = { x: -B.s, y: B.c };
  const neg = (v: Vec) => ({ x: -v.x, y: -v.y });
  const relTol = .95, absTol = .01;
  let axis = 0, sep = faceAx, normal = dA.x > 0 ? colA1 : neg(colA1);
  if (faceAy > relTol * sep + absTol * A.hh) { axis = 1; sep = faceAy; normal = dA.y > 0 ? colA2 : neg(colA2); }
  if (faceBx > relTol * sep + absTol * B.hw) { axis = 2; sep = faceBx; normal = dB.x > 0 ? colB1 : neg(colB1); }
  if (faceBy > relTol * sep + absTol * B.hh) { axis = 3; sep = faceBy; normal = dB.y > 0 ? colB2 : neg(colB2); }
  let front: Vec, frontOff: number, side: Vec, negSide: number, posSide: number, negEdge: number, posEdge: number, incident: [ClipVertex, ClipVertex];
  if (axis === 0) {
    front = normal; frontOff = dot(A.pos, front) + A.hw; side = colA2; const sd = dot(A.pos, side);
    negSide = -sd + A.hh; posSide = sd + A.hh; negEdge = EDGE3; posEdge = EDGE1; incident = incidentEdge(B.hw, B.hh, B.pos, B.c, B.s, front);
  } else if (axis === 1) {
    front = normal; frontOff = dot(A.pos, front) + A.hh; side = colA1; const sd = dot(A.pos, side);
    negSide = -sd + A.hw; posSide = sd + A.hw; negEdge = EDGE2; posEdge = EDGE4; incident = incidentEdge(B.hw, B.hh, B.pos, B.c, B.s, front);
  } else if (axis === 2) {
    front = neg(normal); frontOff = dot(B.pos, front) + B.hw; side = colB2; const sd = dot(B.pos, side);
    negSide = -sd + B.hh; posSide = sd + B.hh; negEdge = EDGE3; posEdge = EDGE1; incident = incidentEdge(A.hw, A.hh, A.pos, A.c, A.s, front);
  } else {
    front = neg(normal); frontOff = dot(B.pos, front) + B.hh; side = colB1; const sd = dot(B.pos, side);
    negSide = -sd + B.hw; posSide = sd + B.hw; negEdge = EDGE2; posEdge = EDGE4; incident = incidentEdge(A.hw, A.hh, A.pos, A.c, A.s, front);
  }
  const c1 = clip(incident, neg(side), negSide, negEdge);
  if (c1.length < 2) return [];
  const c2 = clip(c1, side, posSide, posEdge);
  if (c2.length < 2) return [];
  const out: { p: Vec; n: Vec; sep: number; feature: number }[] = [];
  for (const cv of c2) {
    const s = dot(front, cv.v) - frontOff;
    if (s > 0) continue;
    out.push({ p: { x: cv.v.x - s * front.x, y: cv.v.y - s * front.y }, n: normal, sep: s, feature: axis >= 2 ? flip(cv.fp) : cv.fp });
  }
  return out;
}

/** True when any fixture of `a` overlaps any fixture of `b` deeper than `tolerance`. */
export function bodiesOverlap(a: RigidBody, b: RigidBody, tolerance = 0) {
  for (const fa of a.fixtures) for (const fb of b.fixtures) {
    const A = fixtureBox(a, fa), B = fixtureBox(b, fb);
    if (Math.abs(A.pos.x - B.pos.x) > A.hw + A.hh + B.hw + B.hh || Math.abs(A.pos.y - B.pos.y) > A.hw + A.hh + B.hw + B.hh) continue;
    if (collideBoxes(A, B).some(c => c.sep < -tolerance)) return true;
  }
  return false;
}

const radius = (b: RigidBody) => b.fixtures.reduce((r, f) => Math.max(r, Math.hypot(f.x, f.y) + Math.hypot(f.hw, f.hh)), 0);

/**
 * One time step for a set of bodies (dynamic ones have invMass > 0). Returns
 * the new warm-start table, which the caller stores for the next step.
 */
export function stepBodies(bodies: RigidBody[], warm: WarmStart, dt: number, o: SolverOptions): WarmStart {
  const inv = 1 / dt, contacts: Contact[] = [], radii = bodies.map(radius);
  // Narrow phase over all pairs that are not both static, with a circle prefilter.
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i], b = bodies[j];
    if (!a.invMass && !b.invMass) continue;
    if (Math.hypot(a.x - b.x, a.y - b.y) > radii[i] + radii[j]) continue;
    a.fixtures.forEach((fa, ia) => b.fixtures.forEach((fb, ib) => {
      for (const c of collideBoxes(fixtureBox(a, fa), fixtureBox(b, fb))) {
        const key = `${a.id}.${ia}|${b.id}.${ib}|${c.feature}`, old = warm[key];
        contacts.push({ p: c.p, n: c.n, sep: c.sep, key, a, b, pn: old?.[0] ?? 0, pt: old?.[1] ?? 0, mn: 0, mt: 0, bias: 0, r1: { x: 0, y: 0 }, r2: { x: 0, y: 0 } });
      }
    }));
  }
  for (const b of bodies) if (b.invMass) b.vy -= o.gravity * dt;
  const apply = (c: Contact, P: Vec, sign: number) => {
    const { a, b } = c;
    a.vx -= sign * a.invMass * P.x; a.vy -= sign * a.invMass * P.y; a.w -= sign * a.invI * cross(c.r1, P);
    b.vx += sign * b.invMass * P.x; b.vy += sign * b.invMass * P.y; b.w += sign * b.invI * cross(c.r2, P);
  };
  for (const c of contacts) {
    const { a, b, n } = c;
    c.r1 = { x: c.p.x - a.x, y: c.p.y - a.y }; c.r2 = { x: c.p.x - b.x, y: c.p.y - b.y };
    const rn1 = dot(c.r1, n), rn2 = dot(c.r2, n), t = { x: n.y, y: -n.x }, rt1 = dot(c.r1, t), rt2 = dot(c.r2, t);
    c.mn = 1 / (a.invMass + b.invMass + a.invI * (dot(c.r1, c.r1) - rn1 * rn1) + b.invI * (dot(c.r2, c.r2) - rn2 * rn2));
    c.mt = 1 / (a.invMass + b.invMass + a.invI * (dot(c.r1, c.r1) - rt1 * rt1) + b.invI * (dot(c.r2, c.r2) - rt2 * rt2));
    c.bias = -o.bias * inv * Math.min(0, c.sep + o.slop);
    apply(c, { x: c.pn * n.x + c.pt * t.x, y: c.pn * n.y + c.pt * t.y }, 1);
  }
  const relative = (c: Contact) => ({ x: c.b.vx - c.b.w * c.r2.y - c.a.vx + c.a.w * c.r1.y, y: c.b.vy + c.b.w * c.r2.x - c.a.vy - c.a.w * c.r1.x });
  for (let k = 0; k < o.iterations; k++) for (const c of contacts) {
    const n = c.n, t = { x: n.y, y: -n.x };
    let dv = relative(c);
    let dPn = c.mn * (-dot(dv, n) + c.bias);
    const pn0 = c.pn; c.pn = Math.max(pn0 + dPn, 0); dPn = c.pn - pn0;
    apply(c, { x: dPn * n.x, y: dPn * n.y }, 1);
    dv = relative(c);
    let dPt = c.mt * -dot(dv, t);
    const max = o.friction * c.pn, pt0 = c.pt; c.pt = Math.max(-max, Math.min(max, pt0 + dPt)); dPt = c.pt - pt0;
    apply(c, { x: dPt * t.x, y: dPt * t.y }, 1);
  }
  for (const b of bodies) if (b.invMass) { b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt; }
  const next: WarmStart = {};
  for (const c of contacts) next[c.key] = [c.pn, c.pt];
  return next;
}
