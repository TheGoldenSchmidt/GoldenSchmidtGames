import { expect, type Locator } from "@playwright/test";

/** Wait for the actual camera, including render-on-demand and reduced motion. */
export async function settledBoardCamera(world: Locator) {
  await expect(world).toHaveAttribute("data-webgl", "ready");
  await expect.poll(() => world.getAttribute("data-frames").then(Number)).toBeGreaterThan(0);
  if(await world.getAttribute("data-camera-settled")!==null)await expect(world).toHaveAttribute("data-camera-settled","true",{timeout:10000});
  let previous: number[] = [], stable = 0;
  await expect.poll(async () => {
    const current = JSON.parse(await world.getAttribute("data-camera") ?? "[]") as number[];
    stable = current.length === 3 && previous.length === 3 && Math.hypot(...current.map((n, i) => n - previous[i])) < .02 ? stable + 1 : 0;
    previous = current;
    return stable;
  }, { intervals: [150], timeout: 10000 }).toBeGreaterThanOrEqual(3);
}
