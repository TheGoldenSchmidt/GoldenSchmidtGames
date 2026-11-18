import type { Box, Course, Look } from "./parcoursCourses";

export const PRACTICE_STATIONS = [
  {name:"Freifläche", x:0,z:1, hint:"Laufen, wenden, hechten. An der Übungsfigur Festhalten gedrückt halten."},
  {name:"Kletterstufen", x:-10,z:5, hint:"Zur Kante springen, Festhalten halten und mit dem Stick nach vorn hochziehen."},
  {name:"Sprungkacheln", x:10,z:5, hint:"Einzelne Kacheln treffen. Springen und Hechten auch in der Luft kombinieren."},
  {name:"Drehbalken", x:-10,z:18, hint:"Über Rosa springen, unter Gelb ducken. Treffer werfen dich zurück."},
  {name:"Wippe & Fahrt", x:10,z:18, hint:"Gewicht auf der Wippe verlagern, dann auf die Fahrplattform springen."},
  {name:"Band & Schieber", x:-10,z:32, hint:"Gegen das Förderband laufen und dem seitlichen Schieber ausweichen."},
  {name:"Windsteg", x:10,z:32, hint:"Auf dem schmalen Steg gegen den Seitenwind lenken."},
  {name:"Türen & Klappen", x:-10,z:46, hint:"Eine Tür bricht auf. Klappen warnen orange, bevor sie verschwinden."},
  {name:"Griffe & Glibber", x:10,z:46, hint:"An wechselnden Griffen klettern. Im Glibber landest du wieder am Stationsstart."}
] as const;

export function proberaum(): Course {
  const floor=(x0:number,x1:number,z0:number,z1:number,y=0,look:Look="floor"):Box=>({x0,x1,z0,z1,y0:y-1,y1:y,look});
  const boxes:Box[]=[floor(-3,3,-5,58),floor(-16,16,-5,4)];
  for(const z of [5,18,32,46])boxes.push(floor(-16,16,z-1,z+2));
  // Every station branches off the same walkable spine. Gaps have no hidden floor.
  boxes.push(floor(-15,-5,7,10,1.85,"ledge"),floor(-15,-5,10,13,3.7,"ledge"),floor(-15,-5,13,16,5.55,"ledge"));
  for(let i=0;i<4;i++)boxes.push(floor(9-(i%2),10.6-(i%2),8+i*2.2,9.4+i*2.2,0,"tile"));
  boxes.push(floor(-16,-4,20,30));
  boxes.push({...floor(6,14,21,25,0,"seesaw"),seesaw:0});
  boxes.push({...floor(8.8,11.2,26,28),move:{axis:"x",amp:2.5,period:3500,phase:0}});
  boxes.push(floor(6,14,29,31));
  boxes.push({...floor(-15,-5,34,42,0,"belt"),belt:-3.4});
  boxes.push({x0:-11,x1:-9,y0:0,y1:1.3,z0:38,z1:39,look:"pusher",move:{axis:"x",amp:3.5,period:2600,phase:0}});
  boxes.push({...floor(-14,-6,43,45,0,"roller"),move:{axis:"x",amp:1,period:2800,phase:0},y1:.55,y0:0});
  boxes.push(floor(9,11,34,44),floor(6,14,44,46));
  boxes.push(floor(-16,-4,48,51));
  for(let i=0;i<2;i++)boxes.push({x0:-13+i*4,x1:-10+i*4,y0:0,y1:2.4,z0:49,z1:49.5,look:"door",door:i});
  for(let i=0;i<3;i++)boxes.push({...floor(-12,-8,52+i*2,53.6+i*2,0,"trap"),blink:{period:4000,phase:i*.27,open:.3}});
  // Glibber is below walking height, so other stations stay safe.
  boxes.push(floor(6,14,48,50));
  boxes.push({...floor(8,12,50,53,1.85,"hold"),blink:{period:6500,phase:.4,open:.18}});
  boxes.push(floor(7,13,53,56,3.7,"ledge"));
  return {id:"proberaum",name:"Die Übungsinsel",practice:true,width:32,finishZ:60,finishY:0,killY:-7,
    boxes,sweepers:[{x:-10,z:23,y0:.15,y1:.6,length:4.5,speed:1.4,phase:0},{x:-10,z:28,y0:1,y1:1.4,length:4.5,speed:-1.1,phase:0}],
    checkpoints:PRACTICE_STATIONS.map(s=>({x:s.x,z:s.z,y:0})),doorRows:[{z:49,doors:[0,1],real:1,xs:[-11.5,-7.5]}],tileRows:[],seesaws:1,
    winds:[{x0:8,x1:12,y0:0,y1:6,z0:34,z1:44,vx:2.4,vz:0,period:5000,phase:0,on:.7}],
    goo:{start:-3,rate:0,delay:0}};
}
