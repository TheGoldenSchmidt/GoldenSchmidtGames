/** Keep the gait running across segment boundaries until the room confirms a stop. */
export function boardWalking(movement:{departAt:number}|undefined, now:number, paused:boolean, reduced:boolean) {
  return Boolean(movement && now>=movement.departAt && !paused && !reduced);
}
