import type { CSSProperties, ReactNode } from "react";

// Decorative table objects for the start screen: flat vector stickers, no game state.
const INK = "#24133f";
const PAPER = "#fff9ed";
const RED = "#c8353e";

type Suit = "heart" | "diamond" | "spade" | "club";

const SUIT_SHAPES: Record<Suit, ReactNode> = {
  heart: <path d="M12 21C4 14.5 2 11 2 7.6A5.1 5.1 0 0 1 12 6a5.1 5.1 0 0 1 10 1.6C22 11 20 14.5 12 21Z" />,
  diamond: <path d="M12 2 20.5 12 12 22 3.5 12Z" />,
  spade: <path d="M12 2c6 7 10 9.6 10 13.6a4.6 4.6 0 0 1-8.4 2.6L15 22H9l1.4-3.8A4.6 4.6 0 0 1 2 15.6C2 11.6 6 9 12 2Z" />,
  club: <><circle cx="12" cy="7" r="4.7" /><circle cx="6.9" cy="14.2" r="4.7" /><circle cx="17.1" cy="14.2" r="4.7" /><path d="M10.6 14 9 22h6l-1.6-8Z" /></>
};

function Card({ rank, suit }: { rank: string; suit: Suit }) {
  const color = suit === "heart" || suit === "diamond" ? RED : INK;
  return (
    <svg viewBox="0 0 64 90" focusable="false">
      <rect x="1.5" y="1.5" width="61" height="87" rx="9" fill={PAPER} stroke={INK} strokeWidth="3" />
      <text x={rank.length > 1 ? 7 : 9} y="25" fontSize={rank.length > 1 ? 17 : 20} fontWeight="900" letterSpacing="-1.5" fill={color}>{rank}</text>
      <g transform="translate(8 30) scale(.58)" fill={color}>{SUIT_SHAPES[suit]}</g>
      <g transform="translate(20 42) scale(1.45)" fill={color}>{SUIT_SHAPES[suit]}</g>
    </svg>
  );
}

function CardBack() {
  return (
    <svg viewBox="0 0 64 90" focusable="false">
      <rect x="1.5" y="1.5" width="61" height="87" rx="9" fill="#57e4cb" stroke={INK} strokeWidth="3" />
      <rect x="9" y="9" width="46" height="72" rx="5" fill="none" stroke={INK} strokeWidth="2" />
      <g fill={PAPER} stroke={INK} strokeWidth="2" strokeLinejoin="round">
        <path d="M32 17 41 29 32 41 23 29Z" />
        <path d="M32 49 41 61 32 73 23 61Z" />
      </g>
    </svg>
  );
}

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[32, 32]],
  2: [[19, 19], [45, 45]],
  3: [[19, 19], [32, 32], [45, 45]],
  4: [[19, 19], [45, 19], [19, 45], [45, 45]],
  5: [[19, 19], [45, 19], [32, 32], [19, 45], [45, 45]],
  6: [[19, 18], [45, 18], [19, 32], [45, 32], [19, 46], [45, 46]]
};

function Die({ color, pips }: { color: string; pips: number }) {
  return (
    <svg viewBox="0 0 64 64" focusable="false">
      <rect x="2" y="2" width="60" height="60" rx="15" fill={color} stroke={INK} strokeWidth="3" />
      <path d="M17 9.5h22" stroke="#fff" strokeOpacity=".6" strokeWidth="3.5" strokeLinecap="round" />
      {PIPS[pips].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5.4" fill={INK} />)}
    </svg>
  );
}

function Pawn({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 66" focusable="false">
      <g fill={color} stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <path d="M11 56c2-12 6-20 8-29h10c2 9 6 17 8 29Z" />
        <circle cx="24" cy="16" r="11.5" />
        <rect x="5" y="52" width="38" height="11" rx="5.5" />
      </g>
      <path d="M17.5 13a7 7 0 0 1 5-4.5" fill="none" stroke="#fff" strokeOpacity=".65" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const STAR = Array.from({ length: 10 }, (_, index) => {
  const radius = index % 2 ? 4.3 : 9.6;
  const angle = Math.PI * (index / 5 - .5);
  return `${(24 + Math.cos(angle) * radius).toFixed(2)},${(24.6 + Math.sin(angle) * radius).toFixed(2)}`;
}).join(" ");

function Coin() {
  return (
    <svg viewBox="0 0 48 48" focusable="false">
      <circle cx="24" cy="24" r="21.5" fill="#ffe44e" stroke={INK} strokeWidth="3" />
      <circle cx="24" cy="24" r="15.5" fill="none" stroke={INK} strokeOpacity=".3" strokeWidth="2" />
      <polygon points={STAR} fill={INK} />
    </svg>
  );
}

function Prop({ name, order, children }: { name: string; order: number; children: ReactNode }) {
  return (
    <span className={`home-prop home-prop--${name}`} style={{ "--i": order } as CSSProperties}>
      <span className="home-prop__body">{children}</span>
    </span>
  );
}

/** Objects that lean against the logo; they scale with the emblem. */
export function HomeHeroProps() {
  return (
    <div className="home-props home-props--hero" aria-hidden="true">
      <Prop name="hero-ace" order={0}><Card rank="A" suit="heart" /></Prop>
      <Prop name="hero-back" order={1}><CardBack /></Prop>
      <Prop name="hero-die" order={2}><Die color="#ffe44e" pips={5} /></Prop>
      <Prop name="hero-coin" order={3}><Coin /></Prop>
      <Prop name="hero-pawn" order={4}><Pawn color="#ff86c8" /></Prop>
      <Prop name="hero-die-small" order={5}><Die color={PAPER} pips={3} /></Prop>
    </div>
  );
}

/** Objects on the free table strip below the game modes; hidden when there is no room. */
export function HomeSpread() {
  return (
    <div className="home__spread" aria-hidden="true">
      <div className="home-props home-props--spread">
        <Prop name="spread-ten" order={5}><Card rank="10" suit="spade" /></Prop>
        <Prop name="spread-king" order={6}><Card rank="K" suit="diamond" /></Prop>
        <Prop name="spread-coin" order={7}><Coin /></Prop>
        <Prop name="spread-pawn" order={8}><Pawn color="#57e4cb" /></Prop>
        <Prop name="spread-die" order={9}><Die color="#ff86c8" pips={6} /></Prop>
        <Prop name="spread-pawn-yellow" order={10}><Pawn color="#ffe44e" /></Prop>
      </div>
    </div>
  );
}

/** Desktop only: two objects tucked behind the game modes. */
export function HomePlayProps() {
  return (
    <div className="home-props home-props--play" aria-hidden="true">
      <Prop name="play-queen" order={11}><Card rank="D" suit="club" /></Prop>
      <Prop name="play-die" order={12}><Die color="#57e4cb" pips={2} /></Prop>
    </div>
  );
}
