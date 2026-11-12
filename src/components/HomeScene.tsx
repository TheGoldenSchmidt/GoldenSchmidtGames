import type { CSSProperties, ReactNode } from "react";
import { LOGO_GAMES, LOGO_GOLDEN, LOGO_SCHMIDT } from "./homeLogoPaths";

// Start screen scenery in the Inselwelt style: flat faceted vector shapes, no game state.
// Every drawing is decoration; the screen provides the accessible names.

const svgProps = { "aria-hidden": true, focusable: false } as const;

/** One faceted leaf pointing up from its stem at the origin. */
function Leaf({ at, turn, size = 1, dark = false }: { at: [number, number]; turn: number; size?: number; dark?: boolean }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]}) rotate(${turn}) scale(${size})`}>
      <polygon points="0,0 -12,-11 -11,-25 0,-40" fill={dark ? "#5aa62f" : "#a4dc44"} />
      <polygon points="0,0 12,-11 11,-25 0,-40" fill={dark ? "#2f6f29" : "#4f9a2e"} />
    </g>
  );
}

function Tuft({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <polygon points="-9,0 -4,-13 1,0" fill="#b4e24a" />
      <polygon points="-1,0 5,-17 9,0" fill="#6fbf35" />
      <polygon points="6,0 12,-10 15,0" fill="#3f8f2f" />
    </g>
  );
}

function Rivet({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="5.5" fill="#3d3852" />
      <circle cx={x} cy={y - .8} r="4.2" fill="#5d6183" />
      <circle cx={x - 1.4} cy={y - 2} r="1.5" fill="#a3a9cc" />
    </g>
  );
}

/** A logo word as a carved block: dark outline, side wall, lit face. */
function LogoWord({ word, id, x, y, scale, metal }: { word: { width: number; d: string }; id: string; x: number; y: number; scale: number; metal: "gold" | "silver" }) {
  const gold = metal === "gold";
  const outline = gold ? "#3a1c10" : "#262036";
  const side = gold ? "#a9521a" : "#6f6a96";
  const depth = (gold ? 5.5 : 4) / scale;
  const rim = 2.4 / scale;
  const use = `#${id}`;
  return (
    <g transform={`translate(${x - (word.width * scale) / 2} ${y}) scale(${scale})`}>
      <use href={use} y={depth} fill={outline} stroke={outline} strokeWidth={9 / scale} strokeLinejoin="round" />
      <use href={use} fill={outline} stroke={outline} strokeWidth={9 / scale} strokeLinejoin="round" />
      <use href={use} y={depth} fill={side} stroke={side} strokeWidth={2.4 / scale} strokeLinejoin="round" />
      <use href={use} y={depth * .5} fill={side} stroke={side} strokeWidth={2.4 / scale} strokeLinejoin="round" />
      <g clipPath={`url(#${id}-clip)`}>
        <use href={use} fill={gold ? "#fff3ae" : "#ffffff"} />
        <use href={use} y={rim} fill={`url(#gsg-${metal})`} />
      </g>
    </g>
  );
}

function IslandProp({ order, children }: { order: number; children: ReactNode }) {
  return <g className="home-island__prop" style={{ "--i": order } as CSSProperties}>{children}</g>;
}

/** Hero: the floating island with the carved logo, flag, sword, die, chest and the wooden motto sign. */
export function HomeIsland() {
  return (
    <svg className="home-island" viewBox="24 0 452 540" {...svgProps}>
      <defs>
        <path id="gsg-word-golden" d={LOGO_GOLDEN.d} />
        <path id="gsg-word-schmidt" d={LOGO_SCHMIDT.d} />
        <path id="gsg-word-games" d={LOGO_GAMES.d} />
        <clipPath id="gsg-word-golden-clip"><use href="#gsg-word-golden" /></clipPath>
        <clipPath id="gsg-word-schmidt-clip"><use href="#gsg-word-schmidt" /></clipPath>
        <clipPath id="gsg-word-games-clip"><use href="#gsg-word-games" /></clipPath>
        <linearGradient id="gsg-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe274" />
          <stop offset=".5" stopColor="#ffc23a" />
          <stop offset="1" stopColor="#f2931d" />
        </linearGradient>
        <linearGradient id="gsg-silver" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".55" stopColor="#e2def4" />
          <stop offset="1" stopColor="#a8a3ca" />
        </linearGradient>
        <linearGradient id="gsg-fall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bdeeff" />
          <stop offset=".45" stopColor="#62b9ee" />
          <stop offset=".8" stopColor="#4a9ee6" stopOpacity=".75" />
          <stop offset="1" stopColor="#4a9ee6" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="gsg-glow">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset=".4" stopColor="#ffe36a" stopOpacity=".85" />
          <stop offset="1" stopColor="#ffd84a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className="home-island__land">
        {/* Rock underside, back to front */}
        <polygon points="14,406 486,402 474,452 432,488 372,502 300,514 210,518 130,500 62,472 28,440" fill="#3b2746" />
        <polygon points="18,408 66,414 74,488 44,454" fill="#a8694a" />
        <polygon points="66,414 114,414 98,456 74,488" fill="#6f3f38" />
        <polygon points="92,414 152,420 140,452 104,452" fill="#bd7b52" />
        <polygon points="92,414 104,452 140,452 168,534 126,482" fill="#99593f" />
        <polygon points="152,420 220,418 206,472 168,534 140,452" fill="#673839" />
        <polygon points="206,418 254,422 248,514 216,478" fill="#8c513e" />
        <polygon points="254,422 294,416 282,472 248,514" fill="#55303a" />
        <polygon points="282,400 328,400 332,540 278,540" fill="url(#gsg-fall)" />
        <polygon points="290,404 297,404 300,532 293,532" fill="#eafaff" opacity=".7" />
        <polygon points="310,404 315,404 318,538 313,538" fill="#eafaff" opacity=".45" />
        <polygon points="326,446 374,452 370,530 342,496" fill="#8c513e" />
        <polygon points="374,452 414,444 400,494 370,530" fill="#55303a" />
        <polygon points="320,438 416,434 420,447 374,456 322,451" fill="#4f9a2e" />
        <polygon points="320,438 416,434 402,443 334,445" fill="#9bd63f" />
        <polygon points="396,412 454,414 450,500 420,464" fill="#99593f" />
        <polygon points="454,414 494,406 480,454 450,500" fill="#5f3540" />
        {/* Grass rim and top */}
        <polygon points="-10,390 40,402 120,408 220,410 330,410 430,406 490,400 512,390 508,410 488,426 470,416 452,434 430,420 408,438 385,424 360,440 335,426 310,442 285,428 258,442 232,428 205,444 180,428 155,442 128,426 102,440 78,424 54,436 34,418 12,428 -6,408" fill="#3f8f2f" />
        <polygon points="-6,400 34,410 54,436 34,418 12,428 -6,408" fill="#2f7a2e" />
        <polygon points="78,412 128,414 102,440 78,424" fill="#2f7a2e" />
        <polygon points="180,416 232,416 205,444 180,428" fill="#2f7a2e" />
        <polygon points="285,416 335,416 310,442 285,428" fill="#2f7a2e" />
        <polygon points="385,414 430,412 408,438 385,424" fill="#2f7a2e" />
        <polygon points="470,408 508,400 488,426 470,416" fill="#2f7a2e" />
        <polygon points="-10,390 20,376 70,368 140,362 230,358 320,360 400,364 460,370 500,378 512,390 490,400 430,406 330,410 220,410 120,408 40,402" fill="#86cc38" />
        <polygon points="70,368 140,362 230,358 250,372 150,384 60,382" fill="#a9dc42" />
        <polygon points="320,360 400,364 460,370 440,386 340,384" fill="#9bd63f" />
        <polygon points="226,372 274,372 300,402 232,404" fill="#d9cc6a" opacity=".8" />
        <ellipse cx="250" cy="372" rx="104" ry="9" fill="#2f6d2a" opacity=".3" />
      </g>

      <g className="home-island__plaque">
        <g transform="translate(250 300) scale(.9) translate(-250 -300)">
        {/* Flag */}
        <rect x="437" y="44" width="7" height="246" fill="#7a3f2a" />
        <rect x="437" y="44" width="2.6" height="246" fill="#b0683f" />
        <circle cx="440.5" cy="38" r="7.5" fill="#b4763a" />
        <circle cx="438.5" cy="36" r="2.6" fill="#e8b866" />
        <g transform="translate(4 0)">
          <polygon points="440,50 464,56 488,61 485,93 490,126 464,117 440,111" fill="#e4473c" />
          <polygon points="464,56 488,61 485,93 490,126 464,117" fill="#c2302f" />
          <polygon points="440,101 464,107 490,117 490,126 464,117 440,111" fill="#a0252b" />
          <polygon points="447,77 453,86 459,72 465,86 471,77 469,95 449,95" fill="#ffc94a" />
          <polygon points="459,72 465,86 471,77 469,95 459,95" fill="#eaa32b" />
        </g>

        {/* Rock the plaque is carved from */}
        <polygon points="148,278 352,278 340,306 308,320 290,348 264,324 238,342 216,314 180,320 158,300" fill="#7b4a3c" />
        <polygon points="148,278 252,278 238,342 216,314 180,320 158,300" fill="#9b5c42" />
        <polygon points="148,278 212,278 180,320 158,300" fill="#bd7b52" />
        <polygon points="264,324 290,348 308,320 340,306 352,278 300,278" fill="#583037" />

        {/* Stone frame */}
        <polygon points="198,4 302,4 326,18 346,58 404,84 430,118 434,198 426,238 442,258 436,290 64,290 58,258 74,238 66,198 70,118 96,84 154,58 174,18" fill="#7d7287" stroke="#2c2439" strokeWidth="3.5" strokeLinejoin="round" />
        <polygon points="198,4 302,4 326,18 304,26 196,26 174,18" fill="#aba2b2" />
        <polygon points="174,18 196,26 178,70 154,58" fill="#938a9d" />
        <polygon points="154,58 178,70 120,96 96,84" fill="#a39aab" />
        <polygon points="96,84 120,96 96,126 70,118" fill="#8a7f94" />
        <polygon points="326,18 304,26 322,70 346,58" fill="#665b70" />
        <polygon points="346,58 322,70 380,96 404,84" fill="#766b80" />
        <polygon points="404,84 380,96 404,126 430,118" fill="#584d62" />
        <polygon points="70,118 96,126 94,200 100,238 74,238 66,198" fill="#857a8f" />
        <polygon points="430,118 404,126 406,200 400,238 426,238 434,198" fill="#51465b" />
        <polygon points="74,238 426,238 442,258 58,258" fill="#a39aab" />
        <polygon points="58,258 442,258 436,290 64,290" fill="#766b80" />
        <polygon points="60,274 440,274 436,290 64,290" fill="#584d62" />
        <g fill="none" stroke="#3a3146" strokeWidth="2.4" strokeLinecap="round">
          <path d="M250 5v20M164 38l24 9M336 38l-24 9M125 71l12 24M375 71l-12 24M68 156l27 3M432 156l-27 3M71 208l25-3M429 208l-25-3M250 258v32M158 258l-5 32M342 258l5 32M116 239l-8 19M384 239l8 19" />
        </g>
        <g fill="#c2cc55" opacity=".75">
          <polygon points="78,214 90,210 88,222" />
          <polygon points="280,7 298,9 288,15" />
          <polygon points="408,262 426,264 416,272" />
          <polygon points="96,262 118,262 104,270" />
          <polygon points="352,66 366,68 358,76" />
        </g>
        {/* Carved panel */}
        <polygon points="196,26 304,26 322,70 380,96 404,126 406,200 400,238 100,238 94,200 96,126 120,96 178,70" fill="#352a3d" />
        <polygon points="196,26 304,26 308,36 192,36" fill="#221a29" />
        <polygon points="178,70 120,96 96,126 104,131 126,104 182,79 192,36 196,26" fill="#221a29" />
        <polygon points="322,70 380,96 404,126 396,131 374,104 318,79 308,36 304,26" fill="#2a2132" />
        <polygon points="94,200 406,200 400,238 100,238" fill="#3e3247" />
        <Rivet x={137} y={77} />
        <Rivet x={363} y={77} />
        <Rivet x={82} y={178} />
        <Rivet x={418} y={178} />
        <Rivet x={88} y={274} />
        <Rivet x={412} y={274} />

        {/* Crown */}
        <polygon points="218,42 233,58 250,32 267,58 282,42 279,74 221,74" fill="#ffcf4a" />
        <polygon points="250,32 267,58 282,42 279,74 250,74" fill="#f0a52b" />
        <polygon points="218,42 233,58 229,74 221,74" fill="#ffe488" />
        <polygon points="221,74 279,74 277,84 223,84" fill="#d98a1e" />

        <LogoWord word={LOGO_GOLDEN} id="gsg-word-golden" x={250} y={150} scale={.66} metal="gold" />
        <LogoWord word={LOGO_SCHMIDT} id="gsg-word-schmidt" x={250} y={202} scale={.655} metal="gold" />
        <LogoWord word={LOGO_GAMES} id="gsg-word-games" x={250} y={240} scale={.47} metal="silver" />

        {/* Vines */}
        <Leaf at={[104, 98]} turn={-128} size={.9} dark />
        <Leaf at={[102, 94]} turn={-84} size={1.05} />
        <Leaf at={[108, 90]} turn={-38} size={1.1} />
        <Leaf at={[116, 90]} turn={8} size={.85} dark />
        <Leaf at={[388, 88]} turn={-8} size={.8} dark />
        <Leaf at={[394, 88]} turn={36} size={1} />
        <Leaf at={[398, 94]} turn={84} size={.9} />
        <Leaf at={[76, 228]} turn={-150} size={.85} dark />
        <Leaf at={[74, 222]} turn={-106} size={1} />
        <Leaf at={[78, 216]} turn={-58} size={.95} />
        <Leaf at={[424, 224]} turn={28} size={.85} dark />
        <Leaf at={[426, 228]} turn={72} size={1.05} />
        <Leaf at={[424, 234]} turn={118} size={.95} />
        <Leaf at={[372, 288]} turn={70} size={.8} />
        <Leaf at={[368, 292]} turn={122} size={.9} />
        <Leaf at={[362, 292]} turn={168} size={.72} dark />
        <Leaf at={[126, 290]} turn={-104} size={.8} />
        <Leaf at={[132, 294]} turn={-156} size={.74} dark />
        </g>
      </g>

      <g className="home-island__props">
        <IslandProp order={0}>
          {/* Sword in the stone */}
          <polygon points="58,392 74,366 104,358 128,370 142,392 104,400" fill="#544d66" />
          <polygon points="74,366 104,358 100,382 70,384" fill="#958ea9" />
          <g transform="translate(106 378) rotate(-16)">
            <polygon points="-8,-84 0,-84 0,4 -8,-2" fill="#f3f5fc" />
            <polygon points="0,-84 8,-84 8,-2 0,4" fill="#aeb4cd" />
            <polygon points="-30,-93 30,-93 35,-87 30,-80 -30,-80 -35,-87" fill="#f6bd3c" />
            <polygon points="-35,-87 35,-87 30,-80 -30,-80" fill="#cf8c20" />
            <rect x="-5" y="-116" width="10" height="23" fill="#7a3f2a" />
            <path d="M-5 -110h10M-5 -104h10M-5 -98h10" stroke="#b0683f" strokeWidth="2" />
            <circle cx="0" cy="-122" r="8" fill="#f6bd3c" />
            <circle cx="-2.4" cy="-124.4" r="2.6" fill="#ffe488" />
          </g>
          <polygon points="58,392 70,384 100,382 142,392 104,400" fill="#6f6883" />
          <Tuft x={62} y={394} size={.9} />
        </IslandProp>

        <IslandProp order={1}>
          {/* Die */}
          <g strokeWidth="5" strokeLinejoin="round">
            <polygon points="142,332 176,318 206,334 172,350" fill="#ffffff" stroke="#ffffff" />
            <polygon points="142,332 172,350 172,386 146,368" fill="#ebe3ee" stroke="#ebe3ee" />
            <polygon points="172,350 206,334 202,368 172,386" fill="#cdc2d8" stroke="#cdc2d8" />
          </g>
          <g fill="#2b2238">
            <ellipse cx="160" cy="333" rx="4" ry="2.5" />
            <ellipse cx="174" cy="334" rx="4" ry="2.5" />
            <ellipse cx="188" cy="335" rx="4" ry="2.5" />
            <ellipse cx="150.5" cy="345.5" rx="2.7" ry="3.5" />
            <ellipse cx="165.5" cy="354.5" rx="2.7" ry="3.5" />
            <ellipse cx="159" cy="359" rx="2.7" ry="3.5" />
            <ellipse cx="152.5" cy="363.5" rx="2.7" ry="3.5" />
            <ellipse cx="167.5" cy="372.5" rx="2.7" ry="3.5" />
            <ellipse cx="182.5" cy="356" rx="2.7" ry="3.5" />
            <ellipse cx="195.5" cy="364" rx="2.7" ry="3.5" />
          </g>
          <Tuft x={216} y={386} size={.8} />
        </IslandProp>

        <IslandProp order={2}>
          {/* Treasure chest */}
          <g transform="translate(-8 0)">
            <polygon points="350,332 357,292 384,273 440,269 473,282 486,330" fill="#f3b63a" />
            <polygon points="359,330 365,297 388,281 438,277 467,288 477,330" fill="#63301a" />
            <polygon points="402,279 420,278 422,330 402,330" fill="#d99a26" />
            <circle className="home-island__glow" cx="412" cy="318" r="50" fill="url(#gsg-glow)" />
            <polygon points="412,286 419,308 442,300 426,318 446,330 422,330 412,348 402,330 378,330 398,318 382,300 405,308" fill="#fff3a0" />
            <polygon points="412,302 416,314 428,312 419,321 426,330 398,330 405,321 396,312 408,314" fill="#ffffff" />
            <polygon points="350,334 476,334 471,386 355,386" fill="#9a5526" />
            <polygon points="352,362 474,362 471,386 355,386" fill="#7a3f1c" />
            <path d="M383 344v42M441 344v42" stroke="#63301a" strokeWidth="2" />
            <polygon points="346,330 480,330 479,344 347,344" fill="#f6bd3c" />
            <polygon points="347,338 480,338 479,344 347,344" fill="#cf8c20" />
            <polygon points="350,344 365,344 367,386 355,386" fill="#e3a52e" />
            <polygon points="461,344 476,344 471,386 459,386" fill="#c98a1f" />
            <rect x="404" y="336" width="18" height="20" rx="3" fill="#ffd45c" stroke="#b9741a" strokeWidth="2" />
            <circle cx="413" cy="345" r="2.6" fill="#63301a" />
          </g>
          <Tuft x={330} y={390} size={.9} />
          <Tuft x={482} y={388} size={.7} />
        </IslandProp>

        <IslandProp order={3}>
          {/* Motto sign */}
          <polygon points="44,407 118,399 250,395 382,399 456,407 466,431 458,457 382,463 250,467 118,463 42,457 34,431" fill="#9a5e34" stroke="#5a3320" strokeWidth="3" strokeLinejoin="round" />
          <polygon points="44,400 118,392 250,388 382,392 456,400 466,424 458,450 382,456 250,460 118,456 42,450 34,424" fill="#dfa468" stroke="#5a3320" strokeWidth="3" strokeLinejoin="round" />
          <polygon points="46,401 118,393.5 250,389.5 382,393.5 454,401 456,406 382,399 250,395 118,399 44,406" fill="#f4c88f" />
          <path d="M66 416h64M342 442h82M196 448h46M378 410h40" stroke="#c98b52" strokeWidth="2" strokeLinecap="round" />
          <polygon points="35,424 50,420 50,428" fill="#9a5e34" />
          <polygon points="465,426 451,430 453,438" fill="#9a5e34" />
          <text className="home-island__motto" x="250" y="434.5" textAnchor="middle" textLength="346" lengthAdjust="spacingAndGlyphs" fill="#f6d3a0">MINISPIELE • PARTY • GEMEINSAM</text>
          <text className="home-island__motto" x="250" y="433" textAnchor="middle" textLength="346" lengthAdjust="spacingAndGlyphs" fill="#4a2a17">MINISPIELE • PARTY • GEMEINSAM</text>
        </IslandProp>
      </g>
    </svg>
  );
}

function Pine({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <rect x="-5" y="-22" width="10" height="24" fill="#6a3a2c" />
      <rect x="-5" y="-22" width="4" height="24" fill="#8f5238" />
      {[0, 1, 2].map(tier => {
        const top = -108 + tier * 28;
        const half = 22 + tier * 9;
        const base = top + 44;
        return (
          <g key={tier}>
            <polygon points={`0,${top} ${-half},${base} 0,${base - 6}`} fill="#6fbf35" />
            <polygon points={`0,${top} ${half},${base} 0,${base - 6}`} fill="#3f8f2f" />
            <polygon points={`${-half},${base} 0,${base - 6} ${half},${base} 0,${base + 5}`} fill="#2f6f29" />
          </g>
        );
      })}
    </g>
  );
}

function Cloud({ className }: { className: string }) {
  return (
    <svg className={`home-sky__cloud ${className}`} viewBox="0 0 132 52" {...svgProps}>
      <polygon points="2,42 16,24 34,27 46,8 74,3 92,21 116,23 130,42 118,50 12,50" fill="#e9defa" />
      <polygon points="46,8 74,3 70,24 50,27" fill="#ffffff" />
      <polygon points="16,24 34,27 50,27 40,42 2,42" fill="#f6effe" />
      <polygon points="2,42 130,42 118,50 12,50" fill="#bfb0e3" />
    </svg>
  );
}

/** Sky furniture behind the whole screen: peaks, pines, clouds, far ridges and the leafy foreground. */
export function HomeBackdrop() {
  return (
    <div className="home-sky" aria-hidden="true">
      <svg className="home-sky__ridge" viewBox="0 0 400 120" preserveAspectRatio="none" {...svgProps}>
        <polygon points="0,62 34,40 62,58 96,22 128,60 170,44 206,70 250,30 286,62 322,46 360,66 400,36 400,120 0,120" fill="#5f73d4" opacity=".6" />
        <polygon points="0,88 40,66 84,86 130,58 176,90 228,72 270,94 318,64 362,88 400,70 400,120 0,120" fill="#4d61c6" opacity=".6" />
      </svg>
      <Cloud className="home-sky__cloud--left" />
      <Cloud className="home-sky__cloud--right" />
      <Cloud className="home-sky__cloud--low" />
      <svg className="home-sky__peaks home-sky__peaks--left" viewBox="0 0 200 330" {...svgProps}>
        <polygon points="-10,196 58,24 82,94 54,152 22,214" fill="#eba9e8" />
        <polygon points="58,24 134,172 152,236 22,214 54,152 82,94" fill="#8d6fd6" />
        <polygon points="58,24 70,60 54,72 45,58" fill="#ffe0f8" />
        <polygon points="82,94 134,172 96,168 70,124" fill="#a988e4" />
        <polygon points="-10,176 34,150 72,186 118,170 168,238 200,330 -10,330" fill="#4f7fb6" />
        <polygon points="-10,176 34,150 40,214 -10,236" fill="#6a9fd0" />
        <polygon points="72,186 118,170 168,238 110,246" fill="#3f6a9f" />
        <polygon points="-10,236 40,214 110,246 168,238 200,330 -10,330" fill="#3f7d7a" />
        <polygon points="-10,236 40,214 60,262 -10,280" fill="#56a07c" />
        <Pine x={30} y={316} size={1.05} />
        <Pine x={92} y={326} size={.62} />
      </svg>
      <svg className="home-sky__peaks home-sky__peaks--right" viewBox="0 0 200 330" {...svgProps}>
        <polygon points="210,214 150,96 122,150 96,176 60,246 210,262" fill="#6c74d8" />
        <polygon points="150,96 122,150 140,160 160,128" fill="#a5a8f0" />
        <polygon points="150,96 210,214 210,150 172,110" fill="#5560c2" />
        <polygon points="96,176 122,150 140,160 128,206 60,246" fill="#8088e0" />
        <polygon points="210,236 150,222 96,250 30,330 210,330" fill="#4b76b8" />
        <polygon points="150,222 96,250 124,270 168,246" fill="#6795cf" />
        <polygon points="210,266 140,280 80,330 210,330" fill="#3f7d7a" />
        <Pine x={176} y={320} size={1} />
        <Pine x={122} y={328} size={.58} />
      </svg>
      <svg className="home-sky__bush home-sky__bush--left" viewBox="0 0 200 230" {...svgProps}>
        <polygon points="-6,52 40,30 92,44 -6,98" fill="#c5dd3e" />
        <polygon points="-6,98 92,44 84,92 30,124 -6,130" fill="#94bd30" />
        <polygon points="-6,130 30,124 10,150 50,196 -6,216" fill="#55832a" />
        <polygon points="10,150 60,108 132,112 176,150" fill="#b4d438" />
        <polygon points="60,108 132,112 96,128" fill="#d6e856" />
        <polygon points="10,150 176,150 140,188 50,196" fill="#7aa62b" />
        <polygon points="-6,216 50,196 140,188 198,236 -6,236" fill="#46722a" />
        <polygon points="140,188 198,236 118,236" fill="#2f5424" />
      </svg>
      <svg className="home-sky__bush home-sky__bush--right" viewBox="0 0 200 230" {...svgProps}>
        <polygon points="206,22 150,14 112,40 206,72" fill="#b4d438" />
        <polygon points="206,72 112,40 122,84 168,104 206,104" fill="#86b02c" />
        <polygon points="206,104 168,104 150,178 206,160" fill="#4f7a26" />
        <polygon points="196,140 150,96 76,96 40,128" fill="#c5dd3e" />
        <polygon points="150,96 76,96 110,112" fill="#dcea5e" />
        <polygon points="196,140 40,128 70,168 150,178" fill="#7aa62b" />
        <polygon points="96,186 150,178 128,236 56,236" fill="#b07552" />
        <polygon points="150,178 206,158 206,236 128,236" fill="#7b4a3c" />
        <polygon points="128,236 150,178 172,236" fill="#5a3238" />
      </svg>
    </div>
  );
}
