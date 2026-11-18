/**
 * Course → scene mapping of the Hindernis-Parcours (pure, no DOM): course x
 * stays x, course z runs along world −z. Spinning bars turn about world +y;
 * a bar at course angle `a` (direction (cos a, sin a) in course x/z) needs
 * the rotation +a, because world −z is course +z.
 */
export const courseToWorld = (x: number, y: number, z: number) => [x, y, -z] as const;
export const sweeperYaw = (angle: number) => angle;
