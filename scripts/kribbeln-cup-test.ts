import assert from "node:assert/strict";
import { CupMotionGesture, isCupSwipe, type CupMotionSample } from "../src/lib/kribbelnCup";

assert.equal(isCupSwipe(8, 90, 230), true);
assert.equal(isCupSwipe(8, 90, 900), true);
assert.equal(isCupSwipe(90, 10, 230), false);
assert.equal(isCupSwipe(0, -90, 230), false);
assert.equal(isCupSwipe(0, 30, 230), false);
assert.equal(isCupSwipe(0, 90, 2000), false);
assert.equal(isCupSwipe(0, 90, 0), false);

const sample = (time: number, x = 0, beta = 0): CupMotionSample => ({ time, acceleration: { x, y: 0, z: 0 }, includingGravity: { x, y: 0, z: 9.81 }, rotation: { beta, gamma: 0 } });
const cup = new CupMotionGesture();
// One shock or one unprepared tilt cannot consume a roll.
assert.equal(cup.feed(sample(0, 20)), undefined);
assert.equal(cup.feed(sample(200, 20)), undefined);
assert.equal(cup.feed(sample(400, 20)), undefined);
assert.equal(cup.feed(sample(600, 0, 200)), undefined);
cup.reset();
assert.equal(cup.feed(sample(1000, 20)), undefined);
assert.equal(cup.feed(sample(1200, -20)), undefined);
assert.equal(cup.feed(sample(1400, 20)), "shake");
assert.equal(cup.feed(sample(1500, 0, 200)), undefined);
assert.equal(cup.feed(sample(1800, 0, 200)), "throw");
assert.equal(cup.feed(sample(1900, 0, 200)), undefined);
assert.equal(cup.feed(sample(2100, -20)), undefined);
// A gravity tilt works even without a gyroscope.
cup.reset(); cup.arm(3000);
assert.equal(cup.feed(sample(3300)), undefined);
assert.equal(cup.feed({ time: 3500, acceleration: { x: 0, y: 0, z: 0 }, includingGravity: { x: 0, y: 9.81, z: 0 } }), "throw");
// Old peaks, weak movements, and pure gravity do not build up a shake.
cup.reset();
for (let i = 0; i < 20; i++) assert.equal(cup.feed(sample(4000 + i * 150, i % 2 ? -3 : 3)), undefined);
cup.reset();
assert.equal(cup.feed(sample(8000, 20)), undefined);
assert.equal(cup.feed(sample(10000, -20)), undefined);
assert.equal(cup.feed(sample(12000, 20)), undefined);
cup.reset();
for (let i = 0; i < 20; i++) assert.equal(cup.feed({ time: 13000 + i * 150, includingGravity: { x: 0, y: 0, z: 9.81 } }), undefined);
console.log("Würfelbecher erfolgreich: Swipe-Richtung und Tempo, Schütteln, Kippen, Einmalwurf und Schutz vor Fehlbewegungen");
