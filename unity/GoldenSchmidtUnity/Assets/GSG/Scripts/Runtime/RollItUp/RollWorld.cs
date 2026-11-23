using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace GSG.RollItUp
{
    /// <summary>
    /// The Bauschale as a Unity scene: enamel tray with brass rim, clay floor, grass hill with the
    /// Jayspot bench, the 35 fields with their type colours and symbols, and the six purchase
    /// stations (Grinder, Weedbud I–III, Pape, Filter). Measures follow src/three/rollingTray.ts
    /// (board units × 0.27, the same hill height function), so both boards show the same map.
    /// </summary>
    public class RollWorld
    {
        public const float Scale = 13.5f, FieldRadius = 0.8f;

        // Colours of the web board (src/three/rollingTray.ts, src/lib/partyFieldVisuals.ts).
        public static readonly Color Enamel = Palette.Hex("#23685e"), EnamelDeep = Palette.Hex("#194d49"), Brass = Palette.Hex("#dfab61"), Clay = Palette.Hex("#ce8057");
        public static readonly Color Grass = Palette.Hex("#6fbf35"), Moss = Palette.Hex("#7eaa43"), Pebble = Palette.Hex("#b1ad84"), Sand = Palette.Hex("#e5cb97");

        public static Color FieldColor(string type) => type switch
        {
            "start" => Palette.Hex("#fff0ad"), "coin" => Palette.Hex("#326fc7"), "bad" => Palette.Hex("#c33d4c"), "event" => Palette.Hex("#65c783"),
            "gift" => Palette.Hex("#ffd258"), "shop" => Palette.Hex("#a6dff5"), "duel" => Palette.Hex("#6a3fb8"), "station" => Brass, "jayspot" => Palette.Hex("#ffd777"),
            _ => Palette.Hex("#f5e9bc")
        };

        public static Color FieldInk(string type) => type is "coin" or "bad" or "duel" ? Palette.Hex("#fff9e8") : Palette.Hex("#10485b");

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
        readonly List<Transform> routeRings = new();
        Transform objective, selection;
        Material routeMat, routeSoft;

        public RollWorld()
        {
            root = new GameObject("Bauschale").transform;
        }

        // ---- materials ---------------------------------------------------------------------

        static Material baseToon;
        static readonly Dictionary<string, Material> cache = new();

        public static Material Toon(Color c, float edge = 1.3f, float rim = 0.2f, Color? emission = null)
        {
            string key = $"{ColorUtility.ToHtmlStringRGBA(c)}/{edge}/{rim}/{(emission.HasValue ? ColorUtility.ToHtmlStringRGBA(emission.Value) : "")}";
            if (cache.TryGetValue(key, out var m)) return m;
            if (!baseToon) baseToon = Resources.Load<Material>("GSG/Materials/Flag");
            m = new Material(baseToon) { name = "Bauschale " + key };
            m.SetColor("_BaseColor", c);
            m.SetFloat("_EdgeWidth", edge);
            m.SetFloat("_RimPower", rim);
            m.SetColor("_ShadowTint", new Color(0.5f, 0.5f, 0.82f));
            m.SetColor("_EmissionColor", emission ?? Color.black);
            cache[key] = m;
            return m;
        }

        // ---- meshes ------------------------------------------------------------------------

        static GameObject Part(Transform parent, string name, Mesh mesh, Material mat, Vector3 pos, Vector3? scale = null, bool shadows = true)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale ?? Vector3.one;
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            if (!shadows) r.shadowCastingMode = ShadowCastingMode.Off;
            return go;
        }

        public static GameObject Prim(PrimitiveType type, Transform parent, Color color, Vector3 pos, Vector3 scale, float edge = 1.3f, bool collider = false)
        {
            var go = GameObject.CreatePrimitive(type);
            if (!collider) Object.Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            go.GetComponent<Renderer>().sharedMaterial = Toon(color, edge);
            return go;
        }

        /// <summary>Unity's cylinder is 2 high and 1 wide: this takes radius and height like three.js.</summary>
        public static GameObject Cyl(Transform parent, Color color, Vector3 pos, float radius, float height, float edge = 1.3f) =>
            Prim(PrimitiveType.Cylinder, parent, color, pos, new Vector3(radius * 2f, height / 2f, radius * 2f), edge);

        public static GameObject Box(Transform parent, Color color, Vector3 pos, Vector3 size, float edge = 1.3f) =>
            Prim(PrimitiveType.Cube, parent, color, pos, size, edge);

        /// <summary>The toon shader draws its comic border where uv reaches 0 or 1: generated meshes get a neutral uv (no border).</summary>
        static void NeutralUv(Mesh m)
        {
            var uv = new Vector2[m.vertexCount];
            for (int i = 0; i < uv.Length; i++) uv[i] = new Vector2(0.5f, 0.5f);
            m.uv = uv;
        }

        static Mesh Finish(Mesh m, bool twoSided)
        {
            NeutralUv(m);
            m.RecalculateNormals();
            if (!twoSided) { m.RecalculateBounds(); return m; }
            var v = m.vertices; var n = m.normals; var t = m.triangles;
            var v2 = new Vector3[v.Length * 2]; var n2 = new Vector3[v.Length * 2]; var t2 = new int[t.Length * 2];
            for (int i = 0; i < v.Length; i++) { v2[i] = v[i]; n2[i] = n[i]; v2[i + v.Length] = v[i]; n2[i + v.Length] = -n[i]; }
            for (int i = 0; i < t.Length; i += 3)
            {
                t2[i] = t[i]; t2[i + 1] = t[i + 1]; t2[i + 2] = t[i + 2];
                t2[t.Length + i] = t[i] + v.Length; t2[t.Length + i + 1] = t[i + 2] + v.Length; t2[t.Length + i + 2] = t[i + 1] + v.Length;
            }
            var o = new Mesh { name = m.name, vertices = v2, normals = n2, triangles = t2 };
            NeutralUv(o);
            o.RecalculateBounds();
            return o;
        }

        /// <summary>A surface of revolution from (radius, height) points.</summary>
        public static Mesh Lathe(IList<Vector2> profile, int segments, bool twoSided = false)
        {
            var verts = new List<Vector3>(); var tris = new List<int>();
            int rows = profile.Count;
            for (int s = 0; s <= segments; s++)
            {
                float a = s * Mathf.PI * 2f / segments;
                foreach (var p in profile) verts.Add(new Vector3(Mathf.Cos(a) * p.x, p.y, Mathf.Sin(a) * p.x));
            }
            for (int s = 0; s < segments; s++)
                for (int r = 0; r < rows - 1; r++)
                {
                    int i = s * rows + r, j = (s + 1) * rows + r;
                    tris.AddRange(new[] { i, i + 1, j, j, i + 1, j + 1 });
                }
            return Finish(new Mesh { name = "Drehkörper", vertices = verts.ToArray(), triangles = tris.ToArray() }, twoSided);
        }

        public static Mesh Torus(float radius, float tube, int segments = 48, int sides = 8)
        {
            var profile = new List<Vector2>();
            for (int i = 0; i <= sides; i++)
            {
                float a = -i * Mathf.PI * 2f / sides;
                profile.Add(new Vector2(radius + Mathf.Cos(a) * tube, Mathf.Sin(a) * tube));
            }
            return Lathe(profile, segments);
        }

        public static Mesh Cone(int sides = 7) => Lathe(new[] { new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0f, 1f) }, sides);

        /// <summary>Flat-shaded icosahedron (stones, buds) with unit radius.</summary>
        public static Mesh Ico()
        {
            float t = (1f + Mathf.Sqrt(5f)) / 2f;
            var p = new[] { new Vector3(-1, t, 0), new Vector3(1, t, 0), new Vector3(-1, -t, 0), new Vector3(1, -t, 0), new Vector3(0, -1, t), new Vector3(0, 1, t),
                new Vector3(0, -1, -t), new Vector3(0, 1, -t), new Vector3(t, 0, -1), new Vector3(t, 0, 1), new Vector3(-t, 0, -1), new Vector3(-t, 0, 1) };
            int[] f = { 0,11,5, 0,5,1, 0,1,7, 0,7,10, 0,10,11, 1,5,9, 5,11,4, 11,10,2, 10,7,6, 7,1,8, 3,9,4, 3,4,2, 3,2,6, 3,6,8, 3,8,9, 4,9,5, 2,4,11, 6,2,10, 8,6,7, 9,8,1 };
            var v = new Vector3[f.Length]; var tri = new int[f.Length];
            for (int i = 0; i < f.Length; i++) { v[i] = p[f[i]].normalized; tri[i] = i; }
            var m = new Mesh { name = "Ikosaeder", vertices = v, triangles = tri };
            NeutralUv(m); m.RecalculateNormals(); m.RecalculateBounds();
            return m;
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

        public void Build(RollField[] fields)
        {
            var scenery = new GameObject("Kulisse").transform;
            scenery.SetParent(root, false);
            // A deep table cloth under the tray, so the Bauschale does not float in the sky.
            Cyl(scenery, Palette.Hex("#2f2c74"), new Vector3(0f, -0.82f, 0f), 70f, 0.2f, 0f);
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
            var ico = Ico();
            for (int i = 0; i < 32; i++)
            {
                float a = i * Mathf.PI / 16f;
                var s = Part(scenery, "Stein", ico, Toon(i % 2 == 0 ? Pebble : Palette.Hex("#a7a780"), 0.9f), new Vector3(Mathf.Cos(a) * 4.9f, 0.58f, Mathf.Sin(a) * 4.9f), new Vector3(0.35f, 0.3f, 0.4f));
                s.transform.localRotation = Quaternion.Euler(0f, -a * Mathf.Rad2Deg, 0f);
            }
            var cone = Cone();
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

            spots = new Vector3[fields.Length];
            foreach (var f in fields) spots[f.id] = Spot(f);

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
            stationProps = new Transform[fields.Length];
            var fieldRoot = new GameObject("Felder").transform;
            fieldRoot.SetParent(scenery, false);
            foreach (var f in fields) Field(f, fieldRoot);
            foreach (var f in fields) if (f.type == "station") stationProps[f.id] = Station(scenery, f, ico);

            StaticBatchingUtility.Combine(scenery.gameObject);

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
                default:
                    Cyl(field, ink, new Vector3(0f, y, 0f), 0.1f, 0.06f, 0f);
                    break;
            }
        }

        Transform Station(Transform parent, RollField f, Mesh ico)
        {
            var p = spots[f.id];
            var basePos = new Vector3(p.x * 0.76f, 0f, p.z * 0.76f);
            Cyl(parent, Moss, basePos + new Vector3(0f, 0.48f, 0f), 1.8f, 0.16f, 1f);
            for (int i = 0; i < 5; i++)
            {
                float a = i * 1.26f;
                Part(parent, "Randstein", ico, Toon(Palette.Hex("#bfa37d"), 0.8f), basePos + new Vector3(Mathf.Cos(a) * 1.76f, 0.55f, Mathf.Sin(a) * 1.76f), new Vector3(0.18f, 0.12f, 0.2f));
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
