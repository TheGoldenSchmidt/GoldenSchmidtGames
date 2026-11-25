using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;
using static GSG.Kit;

namespace GSG.RollItUp
{
    /// <summary>
    /// The Roll It Up! boards as a Unity scene. Bauschale: enamel tray with brass rim, clay floor,
    /// grass hill with the Jayspot bench. Grinder: steel disc with knurled rim, grinding teeth,
    /// orange pneumatic tubes and a lounge on the mossy hill. Both carry the fields with their type
    /// colours and symbols and the six purchase stations (Grinder, Weedbud I–III, Pape, Filter).
    /// Measures follow src/three/rollingTray.ts (board units × 0.27, the same hill height function),
    /// so web and Unity show the same map.
    /// </summary>
    public class RollWorld
    {
        public const float Scale = 13.5f, FieldRadius = 0.8f;

        // Colours of the web board (src/three/rollingTray.ts, src/lib/partyFieldVisuals.ts).
        public static readonly Color Enamel = Palette.Hex("#23685e"), EnamelDeep = Palette.Hex("#194d49"), Brass = Palette.Hex("#dfab61"), Clay = Palette.Hex("#ce8057");
        public static readonly Color Grass = Palette.Hex("#6fbf35"), Moss = Palette.Hex("#7eaa43"), Pebble = Palette.Hex("#b1ad84"), Sand = Palette.Hex("#e5cb97");
        // The Grinder (grinderScenery in rollingTray.ts).
        public static readonly Color Steel = Palette.Hex("#8d97a6"), DarkSteel = Palette.Hex("#3b4352"), GrinderMoss = Palette.Hex("#8fae4b"), Tube = Palette.Hex("#e58a3a"), Plate = Palette.Hex("#6f7b8c");

        public static Color FieldColor(string type) => type switch
        {
            "start" => Palette.Hex("#fff0ad"), "coin" => Palette.Hex("#326fc7"), "bad" => Palette.Hex("#c33d4c"), "event" => Palette.Hex("#65c783"),
            "gift" => Palette.Hex("#ffd258"), "shop" => Palette.Hex("#a6dff5"), "duel" => Palette.Hex("#6a3fb8"), "station" => Brass, "jayspot" => Palette.Hex("#ffd777"),
            "tunnel" => Tube,
            _ => Palette.Hex("#f5e9bc")
        };

        public static Color FieldInk(string type) => type is "coin" or "bad" or "duel" ? Palette.Hex("#fff9e8") : type == "tunnel" ? Palette.Hex("#2a1606") : Palette.Hex("#10485b");

        public static float Height(float x, float z) => 0.44f + 3.15f * Mathf.Pow(Mathf.Max(0f, 1f - (x * x + z * z) / 25f), 0.65f);

        /// <summary>Centre of a field's top surface (board z grows towards the viewer, as on the 2D map).</summary>
        public static Vector3 Spot(RollField f)
        {
            float x = f.x * Scale, z = -f.z * Scale, y = Height(x, z);
            for (int i = 0; i < 6; i++)
            {
                float a = i * Mathf.PI / 3f;
                y = Mathf.Max(y, Height(x + Mathf.Cos(a) * FieldRadius * 0.85f, z + Mathf.Sin(a) * FieldRadius * 0.85f));
            }
            return new Vector3(x, y + 0.16f, z);
        }

        public readonly Transform root;
        public readonly Dictionary<Collider, int> fieldColliders = new();
        public Vector3[] spots;
        public Transform[] stationProps;
        /// <summary>The Grinder instead of the Bauschale (set by <see cref="Build"/>).</summary>
        public bool Grinder { get; private set; }
        readonly List<Transform> routeRings = new();
        Transform objective, selection;
        Material routeMat, routeSoft;

        public RollWorld()
        {
            root = new GameObject("Bauschale").transform;
        }

        /// <summary>The grass hill: a polar grid over r ≤ 5 lifted by <see cref="Height"/>.</summary>
        static Mesh Hill()
        {
            const int rings = 14, segs = 56; const float radius = 5f;
            var verts = new List<Vector3> { new Vector3(0f, Height(0f, 0f), 0f) }; var tris = new List<int>();
            for (int r = 1; r <= rings; r++)
                for (int s = 0; s < segs; s++)
                {
                    float rr = radius * r / rings, a = s * Mathf.PI * 2f / segs;
                    float x = Mathf.Cos(a) * rr, z = Mathf.Sin(a) * rr;
                    verts.Add(new Vector3(x, Height(x, z) - (r == rings ? 0.05f : 0f), z));
                }
            for (int s = 0; s < segs; s++) tris.AddRange(new[] { 0, 1 + (s + 1) % segs, 1 + s });
            for (int r = 1; r < rings; r++)
                for (int s = 0; s < segs; s++)
                {
                    int a = 1 + (r - 1) * segs + s, b = 1 + (r - 1) * segs + (s + 1) % segs, c = 1 + r * segs + s, d = 1 + r * segs + (s + 1) % segs;
                    tris.AddRange(new[] { a, b, c, b, d, c });
                }
            var m = new Mesh { name = "Hügel", vertices = verts.ToArray(), triangles = tris.ToArray() };
            NeutralUv(m); m.RecalculateNormals(); m.RecalculateBounds();
            return m;
        }

        // ---- scenery -----------------------------------------------------------------------

        public void Build(RollField[] fields, string board = "bauschale", int[] tunnels = null)
        {
            Grinder = board == "grinder";
            root.name = Grinder ? "Grinder" : "Bauschale";
            var scenery = new GameObject("Kulisse").transform;
            scenery.SetParent(root, false);
            // A deep table cloth under the board, so it does not float in the sky.
            Cyl(scenery, Palette.Hex("#2f2c74"), new Vector3(0f, -0.82f, 0f), 70f, 0.2f, 0f);
            spots = new Vector3[fields.Length];
            foreach (var f in fields) spots[f.id] = Spot(f);
            var ico = Ico();
            var cone = Cone();
            if (Grinder) GrinderScenery(scenery, fields, tunnels ?? new int[0]);
            else BowlScenery(scenery, ico, cone);

            stationProps = new Transform[fields.Length];
            var fieldRoot = new GameObject("Felder").transform;
            fieldRoot.SetParent(scenery, false);
            foreach (var f in fields) Field(f, fieldRoot);
            foreach (var f in fields) if (f.type == "station") stationProps[f.id] = Station(scenery, f, ico);

            StaticBatchingUtility.Combine(scenery.gameObject);
            Highlights(cone);
        }

        void BowlScenery(Transform scenery, Mesh ico, Mesh cone)
        {
            Cyl(scenery, EnamelDeep, new Vector3(0f, -0.25f, 0f), 12.7f, 0.8f, 0f);
            Cyl(scenery, Clay, new Vector3(0f, 0.18f, 0f), 12.3f, 0.48f, 0.8f);
            var profile = new[] { new Vector2(12.1f, 0.39f), new Vector2(12.4f, 0.52f), new Vector2(12.75f, 1.1f), new Vector2(13.07f, 1.22f), new Vector2(13.22f, 1.08f), new Vector2(13.08f, 0.7f), new Vector2(12.8f, -0.65f), new Vector2(12.4f, -0.78f) };
            Part(scenery, "Emaillerand", Lathe(profile, 72, true), Toon(Enamel, 1.2f, 0.35f), Vector3.zero);
            Part(scenery, "Messingring", Torus(13.07f, 0.11f, 72), Toon(Brass, 0f, 0.4f), new Vector3(0f, 1.18f, 0f));
            Part(scenery, "Innenring", Torus(12.39f, 0.04f, 72, 6), Toon(Brass, 0f), new Vector3(0f, 0.55f, 0f), null, false);
            Part(scenery, "Fußring", Torus(12.77f, 0.07f, 72, 6), Toon(Palette.Hex("#173f3c"), 0f), new Vector3(0f, -0.6f, 0f), null, false);
            for (int i = 0; i < 48; i++)
            {
                float a = i * Mathf.PI / 24f;
                Box(scenery, Brass, new Vector3(Mathf.Cos(a) * 13.06f, 0.67f, Mathf.Sin(a) * 13.06f), new Vector3(0.05f, 0.24f, 0.05f), 0f);
            }

            Part(scenery, "Hügel", Hill(), Toon(Grass, 1.1f, 0.15f), Vector3.zero);
            for (int i = 0; i < 32; i++)
            {
                float a = i * Mathf.PI / 16f;
                var s = Part(scenery, "Stein", ico, Toon(i % 2 == 0 ? Pebble : Palette.Hex("#a7a780"), 0.9f), new Vector3(Mathf.Cos(a) * 4.9f, 0.58f, Mathf.Sin(a) * 4.9f), new Vector3(0.35f, 0.3f, 0.4f));
                s.transform.localRotation = Quaternion.Euler(0f, -a * Mathf.Rad2Deg, 0f);
            }
            void Tree(float x, float z, float size)
            {
                float y = Height(x, z);
                Cyl(scenery, Palette.Hex("#80543b"), new Vector3(x, y + 0.5f * size, z), 0.1f * size, size, 0.8f);
                Color[] leaves = { Palette.Hex("#2f7a2e"), Palette.Hex("#579c38"), Palette.Hex("#a9dc42") };
                for (int i = 0; i < 3; i++)
                {
                    float w = (0.7f - i * 0.15f) * size;
                    Part(scenery, "Krone", cone, Toon(leaves[i], 1f), new Vector3(x, y + (0.5f + i * 0.4f) * size, z), new Vector3(w, 1.1f * size, w));
                }
            }
            foreach (var (x, z, s) in new[] { (-3.1f, 2.8f, 0.85f), (-4.1f, 1.8f, 0.6f), (2.5f, 3.8f, 0.8f), (4f, 3.1f, 0.5f), (-6f, 4f, 0.65f), (-7f, 3f, 0.4f), (6f, 4f, 0.5f), (-2f, 7f, 0.4f), (2f, -7f, 0.35f) })
                Tree(x, z, s);

            // Scattered pebbles and moss between the fields.
            for (int i = 0; i < 45; i++)
            {
                float a = i * 2.39996f, r = 6f + (i % 7) * 0.37f, x = Mathf.Sin(a) * r, z = Mathf.Cos(a) * r;
                bool free = true;
                foreach (var p in spots) if (new Vector2(p.x - x, p.z - z).magnitude < 1.2f) { free = false; break; }
                if (!free) continue;
                Part(scenery, "Kiesel", ico, Toon(i % 3 != 0 ? Palette.Hex("#78913b") : Palette.Hex("#c9ad83"), 0.8f), new Vector3(x, 0.5f, z), new Vector3(0.12f, 0.09f + (i % 3) * 0.07f, 0.13f));
            }

            Bench(scenery);
        }

        void Highlights(Mesh cone)
        {
            routeMat = Toon(Palette.Accent, 0f, 0f, Palette.Accent * 1.6f);
            routeSoft = Toon(Palette.Paper, 0f, 0f, Palette.Paper * 0.5f);
            var ring = Torus(FieldRadius + 0.08f, 0.07f, 40, 6);
            for (int i = 0; i < 16; i++)
            {
                var r = Part(root, "Wegmarke", ring, routeMat, Vector3.zero, null, false);
                r.SetActive(false);
                routeRings.Add(r.transform);
            }
            objective = new GameObject("Ziel").transform;
            objective.SetParent(root, false);
            var chevron = Part(objective, "Zielpfeil", cone, Toon(Palette.Accent, 1.4f, 0.2f, Palette.Accent * 0.6f), Vector3.zero, new Vector3(0.38f, -0.55f, 0.38f), false);
            chevron.transform.localPosition = new Vector3(0f, 2.3f, 0f);
            Part(objective, "Zielring", Torus(FieldRadius + 0.2f, 0.06f, 40, 6), Toon(Palette.Accent, 0f, 0f, Palette.Accent * 1.2f), new Vector3(0f, 0.02f, 0f), null, false);
            selection = Part(root, "Auswahl", Torus(FieldRadius + 0.14f, 0.09f, 40, 6), Toon(Palette.Paper, 0f, 0f, Palette.Paper * 0.9f), Vector3.zero, null, false).transform;
            selection.gameObject.SetActive(false);
        }

        void Bench(Transform parent)
        {
            var bench = new GameObject("Jayspot-Bank").transform;
            bench.SetParent(parent, false);
            bench.localPosition = new Vector3(0f, 3.62f, 0.75f);
            var iron = Palette.Hex("#293e3a");
            foreach (var x in new[] { -0.9f, 0.9f })
            {
                foreach (var z in new[] { -0.3f, 0.3f }) Box(bench, iron, new Vector3(x, 0.35f, z), new Vector3(0.13f, 0.7f, 0.14f));
                Box(bench, iron, new Vector3(x, 0.93f, 0.35f), new Vector3(0.14f, 1.4f, 0.14f));
            }
            foreach (var z in new[] { -0.3f, 0f, 0.3f }) Box(bench, Palette.Hex("#e8ac62"), new Vector3(0f, 0.72f, z), new Vector3(2.7f, 0.15f, 0.24f));
            foreach (var y in new[] { 1.08f, 1.42f }) Box(bench, Palette.Hex("#d18c4d"), new Vector3(0f, y, 0.34f), new Vector3(2.7f, 0.24f, 0.13f));
            foreach (var x in new[] { -2f, 2f })
            {
                float y = Height(x, 0f);
                Cyl(parent, Palette.Hex("#5d4639"), new Vector3(x, y + 0.62f, 0f), 0.06f, 1.15f, 0.6f);
                Box(parent, Palette.Hex("#302e39"), new Vector3(x, y + 1.25f, 0f), new Vector3(0.35f, 0.45f, 0.35f));
                var lamp = Box(parent, Palette.Gold, new Vector3(x, y + 1.26f, 0f), new Vector3(0.24f, 0.3f, 0.37f), 0f);
                lamp.GetComponent<Renderer>().sharedMaterial = Toon(Palette.Gold, 0f, 0f, Palette.Gold * 1.4f);
            }
        }

        /// <summary>
        /// The Grinder seen from above: steel body with knurled rim, mossy hill in the middle (same
        /// height profile, so paths and figures sit on it), grinding teeth in two rings left out where
        /// fields run, raised orange tubes between the paired tunnel fields and the lounge on top.
        /// </summary>
        void GrinderScenery(Transform scenery, RollField[] fields, int[] tunnels)
        {
            // A cool steel evening instead of the violet Bauschale sky (only the colours change).
            if (RenderSettings.skybox && RenderSettings.skybox.HasProperty("_Top"))
            {
                var sky = new Material(RenderSettings.skybox) { name = "Grinder-Himmel" };
                sky.SetColor("_Top", Palette.Hex("#26304d")); sky.SetColor("_Horizon", Palette.Hex("#c9b6e8"));
                if (sky.HasProperty("_Bottom")) sky.SetColor("_Bottom", Palette.Hex("#5f7fb8"));
                RenderSettings.skybox = sky;
            }
            Cyl(scenery, DarkSteel, new Vector3(0f, -0.25f, 0f), 12.8f, 0.8f, 0f);
            Cyl(scenery, Steel, new Vector3(0f, 0.18f, 0f), 12.35f, 0.48f, 0.6f);
            Part(scenery, "Rand", Torus(12.75f, 0.3f, 72, 6), Toon(DarkSteel, 0.6f, 0.35f), new Vector3(0f, 0.62f, 0f));
            for (int i = 0; i < 72; i++)
            {
                float a = i * Mathf.PI / 36f;
                var knurl = Box(scenery, Steel, new Vector3(Mathf.Cos(a) * 12.95f, 0.66f, Mathf.Sin(a) * 12.95f), new Vector3(0.22f, 0.5f, 0.14f), 0f);
                knurl.transform.localRotation = Quaternion.Euler(0f, -a * Mathf.Rad2Deg, 0f);
            }
            Part(scenery, "Moos", Hill(), Toon(GrinderMoss, 1.1f, 0.15f), Vector3.zero);

            // Grinding teeth in two rings, left out where fields and paths run.
            var tooth = Cone(4);
            var toothMat = Toon(Steel, 0.5f, 0.4f);
            bool Near(float x, float z) { foreach (var p in spots) if (new Vector2(p.x - x, p.z - z).magnitude < 1.25f) return true; return false; }
            foreach (var (radius, count) in new[] { (9.6f, 40), (7.2f, 30) })
                for (int i = 0; i < count; i++)
                {
                    float a = i * Mathf.PI * 2f / count + radius, x = Mathf.Cos(a) * radius, z = Mathf.Sin(a) * radius;
                    if (Near(x, z)) continue;
                    var t = Part(scenery, "Zahn", tooth, toothMat, new Vector3(x, 0.43f, z), new Vector3(0.32f, 0.7f, 0.32f));
                    t.transform.localRotation = Quaternion.Euler(0f, -a * Mathf.Rad2Deg, 0f);
                }

            // Pneumatic tubes: raised arcs between the paired tunnel fields, with a socket at both ends.
            var tubeMat = Toon(Tube, 0f, 0.3f, Tube * 0.25f);
            for (int i = 0; i + 1 < tunnels.Length; i += 2)
            {
                if (tunnels[i] < 0 || tunnels[i] >= spots.Length || tunnels[i + 1] < 0 || tunnels[i + 1] >= spots.Length) continue;
                Vector3 a = spots[tunnels[i]], b = spots[tunnels[i + 1]], mid = (a + b) / 2f;
                mid.y = Mathf.Max(a.y, b.y) + 4.2f;
                Part(scenery, "Rohrpost", TubeArc(a + Vector3.up * 0.2f, mid, b + Vector3.up * 0.2f, 0.16f), tubeMat, Vector3.zero);
                foreach (var end in new[] { a, b }) Cyl(scenery, Tube, end + Vector3.up * 0.25f, 0.34f, 0.3f, 0.6f);
            }
            Lounge(scenery);
        }

        /// <summary>A round tube along a quadratic Bézier curve (outward normals, neutral uv).</summary>
        static Mesh TubeArc(Vector3 a, Vector3 control, Vector3 b, float radius, int steps = 32, int sides = 8)
        {
            var verts = new List<Vector3>(); var normals = new List<Vector3>(); var tris = new List<int>();
            for (int k = 0; k <= steps; k++)
            {
                float t = k / (float)steps, u = 1f - t;
                var p = u * u * a + 2f * u * t * control + t * t * b;
                var tangent = (2f * u * (control - a) + 2f * t * (b - control)).normalized;
                var n1 = Vector3.Cross(tangent, Vector3.up);
                if (n1.sqrMagnitude < 1e-4f) n1 = Vector3.Cross(tangent, Vector3.right);
                n1.Normalize();
                var n2 = Vector3.Cross(tangent, n1);
                for (int s = 0; s <= sides; s++)
                {
                    float ang = s * Mathf.PI * 2f / sides;
                    var dir = Mathf.Cos(ang) * n1 + Mathf.Sin(ang) * n2;
                    verts.Add(p + dir * radius); normals.Add(dir);
                }
            }
            int ring = sides + 1;
            for (int k = 0; k < steps; k++)
                for (int s = 0; s < sides; s++)
                {
                    int i = k * ring + s, j = i + ring;
                    tris.AddRange(new[] { i, i + 1, j, j, i + 1, j + 1 });
                }
            var m = new Mesh { name = "Rohr", vertices = verts.ToArray(), normals = normals.ToArray(), triangles = tris.ToArray() };
            NeutralUv(m); m.RecalculateBounds();
            return m;
        }

        /// <summary>The Grinder's goal on the hill: a cushioned sofa with a small lamp (lounge in rollingTray.ts).</summary>
        void Lounge(Transform parent)
        {
            var lounge = new GameObject("Lounge").transform;
            lounge.SetParent(parent, false);
            lounge.localPosition = new Vector3(0f, 3.62f, 0.7f);
            Color cushion = Palette.Hex("#5a3d8f"), back = Palette.Hex("#6f4fb0");
            Box(lounge, cushion, new Vector3(0f, 0.42f, 0f), new Vector3(2.6f, 0.36f, 0.9f));
            Box(lounge, back, new Vector3(0f, 0.9f, 0.38f), new Vector3(2.6f, 0.7f, 0.22f));
            foreach (var x in new[] { -1.25f, 1.25f }) Box(lounge, cushion, new Vector3(x, 0.7f, 0f), new Vector3(0.22f, 0.5f, 0.9f));
            Cyl(lounge, DarkSteel, new Vector3(1.7f, 0.6f, -0.2f), 0.05f, 1.2f, 0f);
            var shade = Part(lounge, "Lampe", Cone(8), Toon(Palette.Gold, 0f, 0f, Palette.Gold * 1.4f), new Vector3(1.7f, 1.1f, -0.2f), new Vector3(0.32f, 0.3f, 0.32f));
            shade.name = "Lampe";
        }

        void Field(RollField f, Transform parent)
        {
            var p = spots[f.id];
            var go = new GameObject($"Feld {f.id}");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = p;
            var col = FieldColor(f.type);
            bool big = f.type is "jayspot" or "start";
            float r = big ? FieldRadius * 1.15f : FieldRadius;
            var plinth = Cyl(go.transform, Color.Lerp(col, Palette.Ink, 0.45f), new Vector3(0f, -0.13f, 0f), r + 0.07f, 0.2f, 0.9f);
            plinth.name = "Sockel";
            var top = Cyl(go.transform, col, new Vector3(0f, -0.04f, 0f), r, 0.1f, 1.1f);
            top.name = "Platte";
            var box = go.AddComponent<BoxCollider>();
            box.center = new Vector3(0f, -0.05f, 0f); box.size = new Vector3(r * 2f, 0.4f, r * 2f);
            fieldColliders[box] = f.id;
            Symbol(go.transform, f.type, FieldInk(f.type));
        }

        /// <summary>Small 3D symbols instead of font glyphs (the web board's + − ! ◇ ▣ ⚑).</summary>
        static void Symbol(Transform field, string type, Color ink)
        {
            const float y = 0.04f;
            switch (type)
            {
                case "coin":
                    Box(field, ink, new Vector3(0f, y, 0f), new Vector3(0.62f, 0.07f, 0.16f), 0f);
                    Box(field, ink, new Vector3(0f, y, 0f), new Vector3(0.16f, 0.07f, 0.62f), 0f);
                    break;
                case "bad":
                    Box(field, ink, new Vector3(0f, y, 0f), new Vector3(0.62f, 0.07f, 0.16f), 0f);
                    break;
                case "event":
                    Box(field, ink, new Vector3(0f, y, 0.1f), new Vector3(0.15f, 0.07f, 0.42f), 0f);
                    Box(field, ink, new Vector3(0f, y, -0.3f), new Vector3(0.15f, 0.07f, 0.15f), 0f);
                    break;
                case "gift":
                    Box(field, Palette.Hex("#ff86c8"), new Vector3(0f, 0.2f, 0f), new Vector3(0.46f, 0.36f, 0.46f));
                    Box(field, Palette.Paper, new Vector3(0f, 0.21f, 0f), new Vector3(0.48f, 0.37f, 0.1f), 0f);
                    Box(field, Palette.Paper, new Vector3(0f, 0.21f, 0f), new Vector3(0.1f, 0.37f, 0.48f), 0f);
                    break;
                case "shop":
                    Box(field, Palette.Paper, new Vector3(0f, 0.17f, 0f), new Vector3(0.5f, 0.3f, 0.36f));
                    Box(field, Palette.Hex("#e3263b"), new Vector3(0f, 0.36f, 0.08f), new Vector3(0.6f, 0.08f, 0.5f), 0.8f);
                    break;
                case "start":
                    Cyl(field, Palette.Hex("#10485b"), new Vector3(0.2f, 0.55f, 0f), 0.04f, 1.1f, 0f);
                    Box(field, Palette.Hex("#e3263b"), new Vector3(-0.05f, 0.92f, 0f), new Vector3(0.48f, 0.3f, 0.04f), 0.8f);
                    break;
                case "jayspot":
                    Part(field, "Glanz", Torus(0.55f, 0.05f, 40, 6), Toon(Palette.Accent, 0f, 0f, Palette.Accent), new Vector3(0f, y, 0f), null, false);
                    break;
                case "station":
                    Cyl(field, Palette.Hex("#10485b"), new Vector3(0f, y, 0f), 0.24f, 0.07f, 0f);
                    break;
                case "tunnel":
                    // ⇄: two bars with arrow heads pointing in opposite directions.
                    foreach (var (z, dir) in new[] { (0.15f, 1f), (-0.15f, -1f) })
                    {
                        Box(field, ink, new Vector3(0f, y, z), new Vector3(0.5f, 0.07f, 0.09f), 0f);
                        Box(field, ink, new Vector3(dir * 0.22f, y, z + 0.07f), new Vector3(0.2f, 0.07f, 0.07f), 0f).transform.localRotation = Quaternion.Euler(0f, dir * 40f, 0f);
                        Box(field, ink, new Vector3(dir * 0.22f, y, z - 0.07f), new Vector3(0.2f, 0.07f, 0.07f), 0f).transform.localRotation = Quaternion.Euler(0f, -dir * 40f, 0f);
                    }
                    break;
                default:
                    Cyl(field, ink, new Vector3(0f, y, 0f), 0.1f, 0.06f, 0f);
                    break;
            }
        }

        Transform Station(Transform parent, RollField f, Mesh ico)
        {
            var p = spots[f.id];
            // Between the field and the centre; on the Grinder's inner ring that is the hill slope.
            var basePos = new Vector3(p.x * 0.76f, 0f, p.z * 0.76f);
            basePos.y = Mathf.Max(0f, Height(basePos.x, basePos.z) - 0.44f);
            if (Grinder) Cyl(parent, Plate, basePos + new Vector3(0f, 0.48f, 0f), 1.55f, 0.14f, 0.6f);
            else
            {
                Cyl(parent, Moss, basePos + new Vector3(0f, 0.48f, 0f), 1.8f, 0.16f, 1f);
                for (int i = 0; i < 5; i++)
                {
                    float a = i * 1.26f;
                    Part(parent, "Randstein", ico, Toon(Palette.Hex("#bfa37d"), 0.8f), basePos + new Vector3(Mathf.Cos(a) * 1.76f, 0.55f, Mathf.Sin(a) * 1.76f), new Vector3(0.18f, 0.12f, 0.2f));
                }
            }
            var prop = new GameObject("Station " + f.station).transform;
            prop.SetParent(parent, false);
            prop.localPosition = basePos + new Vector3(0f, 0.6f, 0f);
            prop.localRotation = Quaternion.Euler(0f, Mathf.Atan2(p.x, p.z) * Mathf.Rad2Deg, 0f);
            Cyl(prop, Sand, new Vector3(0f, 0.04f, 0f), 1.08f, 0.18f, 1f);
            switch (f.station)
            {
                case "Grinder":
                    Cyl(prop, Enamel, new Vector3(0f, 0.66f, 0f), 0.79f, 1.12f);
                    foreach (var y in new[] { 0.19f, 0.57f, 1.15f }) Cyl(prop, Brass, new Vector3(0f, y, 0f), 0.81f, 0.07f, 0f);
                    Cyl(prop, Enamel, new Vector3(0f, 1.28f, 0f), 0.81f, 0.15f);
                    for (int i = 0; i < 16; i++)
                    {
                        float a = i * Mathf.PI / 8f;
                        Box(prop, Brass, new Vector3(Mathf.Sin(a) * 0.8f, 0.9f, Mathf.Cos(a) * 0.8f), new Vector3(0.05f, 0.34f, 0.05f), 0f);
                    }
                    break;
                case "Pape":
                    Box(prop, Enamel, new Vector3(0f, 0.25f, 0f), new Vector3(1.9f, 0.24f, 1.08f));
                    Box(prop, Palette.Hex("#e5c98f"), new Vector3(0f, 0.39f, 0f), new Vector3(1.74f, 0.08f, 0.94f));
                    Box(prop, Palette.Hex("#fff8ea"), new Vector3(0f, 0.82f, 0.29f), new Vector3(1.73f, 0.05f, 1.02f)).transform.localRotation = Quaternion.Euler(39f, 0f, 0f);
                    Box(prop, Brass, new Vector3(0f, 0.42f, -0.34f), new Vector3(1.3f, 0.03f, 0.12f), 0f);
                    break;
                case "Filter":
                    Box(prop, Palette.Hex("#c28c55"), new Vector3(0f, 0.38f, 0f), new Vector3(1.7f, 0.45f, 1.05f)).transform.localRotation = Quaternion.Euler(0f, 9f, 0f);
                    for (int i = 0; i < 5; i++)
                        Cyl(prop, Palette.Hex("#ffe7b0"), new Vector3(-0.6f + i * 0.28f, 0.75f, 0.02f), 0.12f, 1.1f).transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
                    break;
                default:
                    Cyl(prop, Enamel, new Vector3(0f, 0.3f, 0f), 0.76f, 0.27f);
                    Cyl(prop, Brass, new Vector3(0f, 0.45f, 0f), 0.74f, 0.07f, 0f);
                    Color[] buds = { Palette.Hex("#527448"), Palette.Hex("#789946"), Palette.Hex("#9caa5b") };
                    for (int i = 0; i < 9; i++)
                    {
                        float a = i * 2.4f;
                        Part(prop, "Knospe", ico, Toon(buds[i % 3], 1f), new Vector3(Mathf.Sin(a) * 0.3f, 0.65f + (i % 4) * 0.21f, Mathf.Cos(a) * 0.3f), new Vector3(0.37f, 0.43f, 0.37f));
                    }
                    break;
            }
            return prop;
        }

        // ---- highlights --------------------------------------------------------------------

        /// <summary>Gold rings on the fields of a route (the first entry is the current field and stays bare).</summary>
        public void ShowRoute(int[] route, bool soft = false)
        {
            int n = 0;
            if (route != null)
                for (int i = 1; i < route.Length && n < routeRings.Count; i++)
                {
                    if (route[i] < 0 || route[i] >= spots.Length) continue;
                    var r = routeRings[n++];
                    r.gameObject.SetActive(true);
                    r.position = spots[route[i]] + Vector3.up * 0.03f;
                    r.GetComponent<Renderer>().sharedMaterial = soft ? routeSoft : routeMat;
                }
            for (; n < routeRings.Count; n++) routeRings[n].gameObject.SetActive(false);
        }

        public void ShowObjective(int field)
        {
            bool on = field >= 0 && spots != null && field < spots.Length;
            objective.gameObject.SetActive(on);
            if (on) objective.position = spots[field];
        }

        public void ShowSelection(int field)
        {
            bool on = field >= 0 && spots != null && field < spots.Length;
            selection.gameObject.SetActive(on);
            if (on) selection.position = spots[field] + Vector3.up * 0.05f;
        }

        public void Animate(float t, bool reduced)
        {
            if (objective && objective.gameObject.activeSelf && objective.childCount > 0)
            {
                var chevron = objective.GetChild(0);
                chevron.localPosition = new Vector3(0f, 2.3f + (reduced ? 0f : Mathf.Sin(t * 3f) * 0.18f), 0f);
                chevron.localRotation = Quaternion.Euler(0f, reduced ? 0f : t * 90f, 0f);
            }
            if (selection && selection.gameObject.activeSelf) selection.localScale = Vector3.one * (reduced ? 1f : 1f + Mathf.Sin(t * 5f) * 0.05f);
        }
    }
}
