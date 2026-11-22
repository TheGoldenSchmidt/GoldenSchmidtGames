import assert from "node:assert/strict";
import {createProberaum,PRACTICE_STATIONS,stepProberaum,visitStation} from "../shared/proberaum";
import {NEUTRAL_MATCH_INPUT} from "../shared/matches/types";
import {course,sweeperAngle} from "../shared/matches/parcoursCourses";
import {isMatchId} from "../shared/matches/framework";
import {PC} from "../shared/matches/parcours";
const input=()=>({...NEUTRAL_MATCH_INPUT});
assert.equal(isMatchId("proberaum"),false,"Kein Eintrag in Wettbewerben");
for(let i=0;i<PRACTICE_STATIONS.length;i++){
 const s=createProberaum();visitStation(s,i);for(let t=0;t<5;t++)stepProberaum(s,input());
 const r=s.game.racers.practice;assert.ok(r.grounded,`${i}: sicherer Stationsstart`);assert.equal(r.checkpoint,i);
 r.y=-8;stepProberaum(s,input());for(let t=0;t<30;t++)stepProberaum(s,input());
 assert.ok(r.grounded && Math.abs(r.z-PRACTICE_STATIONS[i].z)<1,`${i}: Rückkehr`);
 assert.ok(!s.done);assert.equal(r.pose,"run");
}
{
 const s=createProberaum();s.time=180000;stepProberaum(s,input());assert.equal(s.done,false,"Kein Zeitlimit");
 const r=s.game.racers.practice;for(let i=0;i<10;i++)stepProberaum(s,{...input(),y:-1});assert.ok(r.z>2);
 stepProberaum(s,{...input(),ca:1});assert.equal(r.pose,"air");
 stepProberaum(s,{...input(),ca:1,cb:1});assert.equal(r.pose,"dive");
}
{
 const s=createProberaum();visitStation(s,1);const r=s.game.racers.practice;
 let jumps=0,top=0;
 for(let i=0;i<50;i++){if(r.grounded&&r.z>6.2)jumps++;stepProberaum(s,{...input(),y:-1,ha:r.pose==="hang"||(!r.grounded&&r.vy<=.5),ca:jumps});top=Math.max(top,r.y);}
 assert.ok(s.events.some(e=>e.kind==="climb"),"Hochziehen ausgelöst");
 assert.ok(top>=1.85,"Kletterstufe mit Originalphysik hochgezogen");
}
{
 const s=createProberaum(),sw=course("proberaum").sweepers[0],a=sweeperAngle(sw,50),r=s.game.racers.practice;
 Object.assign(r,{x:sw.x+Math.cos(a)*2,y:0,z:sw.z+Math.sin(a)*2,grounded:true});stepProberaum(s,input());
 assert.notEqual(r.pose,"stun","Auch im Proberaum gilt die Reaktionsfrist");
 for(let t=0;t<PC.barGrace+50;t+=50)stepProberaum(s,input());
 assert.equal(r.pose,"stun","Anhaltender Balkenkontakt haut nach der Schonfrist um");
 visitStation(s,0);assert.equal(s.game.racers.practice.pose,"run");assert.equal(s.game.racers.practice.vx,0);
}
// All station-specific collision primitives exist in the shared course, not only in the renderer.
const c=course("proberaum");
for(const look of ["ledge","tile","seesaw","belt","pusher","roller","door","trap","hold"])assert.ok(c.boxes.some(b=>b.look===look),look);
assert.equal(c.sweepers.length,2);assert.ok(c.winds.length&&c.boxes.some(b=>b.move));
console.log("Proberaum: Stationsstarts, Rückkehr, freies Laufen, Sprung, Hechten, Klettern, Treffer und unbegrenzte Übung geprüft.");
