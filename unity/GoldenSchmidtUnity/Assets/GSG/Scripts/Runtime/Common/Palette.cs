using UnityEngine;

namespace GSG
{
    /// <summary>
    /// Art bible – the single colour source of both Unity games.
    /// Style: bunte Gameshow-Hindernisbahn im Comic-Look – zwei harte Lichtstufen, dunkle
    /// Tintenkonturen, satte Bonbonfarben vor einem tiefen Abendhimmel.
    /// Mood: warme tiefe Abendsonne von der Seite, kühles violettes Himmelslicht in den Schatten.
    /// The course colours are the existing three.js/canvas parcours colours (LOOK_FILL), the
    /// temple colours those of the lava world, players use PLAYER_HEX of the app.
    /// </summary>
    public static class Palette
    {
        public static Color Hex(string hex)
        {
            ColorUtility.TryParseHtmlString(hex, out var c);
            return c;
        }

        // Course (parcoursCourses Look → colour, as in src/matches/games/parcours.tsx).
        public static readonly Color Floor = Hex("#ffd166");
        public static readonly Color Wall = Hex("#6544e8");
        public static readonly Color Door = Hex("#ff86c8");
        public static readonly Color DoorSolid = Hex("#4a2a5c");
        public static readonly Color Pusher = Hex("#e3263b");
        public static readonly Color Belt = Hex("#3a3f66");
        public static readonly Color Step = Hex("#ffe3a3");
        public static readonly Color Seesaw = Hex("#57e4cb");
        public static readonly Color Tile = Hex("#bfe6ff");
        public static readonly Color TileSafe = Hex("#7be38f");
        public static readonly Color Roller = Hex("#b23a48");
        public static readonly Color Ledge = Hex("#ffb347");
        public static readonly Color Finish = Hex("#fff9ed");
        public static readonly Color Trap = Hex("#ffe3a3");
        public static readonly Color Hold = Hex("#c98bff");
        public static readonly Color BarLow = Hex("#ff5f8f");
        public static readonly Color BarHigh = Hex("#ffe44e");
        public static readonly Color Goo = Hex("#8dff5a");

        // Shared frame.
        public static readonly Color Night = Hex("#1d2466");
        public static readonly Color Ink = Hex("#24133f");
        public static readonly Color Accent = Hex("#ffe44e");
        public static readonly Color Warn = Hex("#ff6a1f");
        public static readonly Color Paper = Hex("#fff9ed");
        public static readonly Color ShadowCool = Hex("#5a4a9e");
        public static readonly Color SkyTop = Hex("#1f2470");
        public static readonly Color SkyHorizon = Hex("#ff9fb0");
        public static readonly Color SkyBottom = Hex("#1a1450");
        public static readonly Color Sun = Hex("#fff2dc");

        // Temple and lava (src/three/lavaWorld.ts COLOR).
        public static readonly Color TempleNight = Hex("#2a0f0a");
        public static readonly Color Stone = Hex("#fff3dc");
        public static readonly Color StoneShadow = Hex("#8a5a4a");
        public static readonly Color Hot = Hex("#ff6a1f");
        public static readonly Color Rune = Hex("#57e4cb");
        public static readonly Color Lava = Hex("#ff5a14");
        public static readonly Color LavaGlow = Hex("#ffb347");
        public static readonly Color Crust = Hex("#1a0a06");
        public static readonly Color Own = Hex("#ffe44e");

        // UI materials of the island world (designregeln.md).
        public static readonly Color Gold = Hex("#ffd777");
        public static readonly Color GoldDeep = Hex("#f1aa4c");
        public static readonly Color Stone2 = Hex("#7c7092");
        public static readonly Color Glass = new Color(0.12f, 0.11f, 0.33f, 0.74f);

        /// <summary>Player colours of the app (src/matches/client.ts PLAYER_HEX).</summary>
        public static readonly Color[] Players =
        {
            Hex("#e65c65"), Hex("#398fe2"), Hex("#67b94b"), Hex("#a16bd0"), Hex("#f4a53e"), Hex("#e8ca3b")
        };

        public static Color Player(int slot) => Players[((slot % Players.Length) + Players.Length) % Players.Length];

        public static Color WithAlpha(Color c, float a) { c.a = a; return c; }
    }
}
