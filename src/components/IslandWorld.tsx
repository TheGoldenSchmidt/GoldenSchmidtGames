// The rendered sky and the leafy corners behind the start screen and the menus (scripts/home-render).
// new URL(…, import.meta.url) lets Vite bundle the images and keeps the module loadable in Node
// (the screen tests render menus there).
const asset = (name: string) => new URL(`../assets/home/${name}.webp`, import.meta.url).href;
const skyPortrait = asset("backdrop-portrait");
const skyLandscape = asset("backdrop-landscape");
const cornerLeft = asset("corner-left");
const cornerRight = asset("corner-right");

export function IslandWorld() {
  return (
    <div className="iw-world" aria-hidden="true">
      <picture>
        <source media="(min-aspect-ratio: 1/1)" srcSet={skyLandscape} width={1920} height={1080} />
        <img className="iw-world__sky" src={skyPortrait} width={900} height={1950} alt="" decoding="async" />
      </picture>
      <img className="iw-world__corner iw-world__corner--left" src={cornerLeft} width={520} height={600} alt="" decoding="async" />
      <img className="iw-world__corner iw-world__corner--right" src={cornerRight} width={520} height={600} alt="" decoding="async" />
    </div>
  );
}
