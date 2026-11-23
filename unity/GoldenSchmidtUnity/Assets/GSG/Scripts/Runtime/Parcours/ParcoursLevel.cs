using System.Collections.Generic;
using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>
    /// Builds the test level: fifteen stations in a row that together use every obstacle kind of
    /// the online parcours (parcoursCourses.ts: floor, wall, door, pusher, belt, step, seesaw,
    /// tile, roller, ledge, finish, trap, hold, spinning bars, wind, moving islands, goo and
    /// door corridors with dead ends and trapdoors). Used by the editor setup to bake the scene,
    /// so the level can be inspected and tuned in the Unity Editor. Coordinates as in the web
    /// version: x sideways, y up, z forward along the course (metres).
    /// </summary>
    public static class ParcoursLevel
    {
        static Transform root;
        /// <summary>Parent of everything the helpers build (the course builder sets its own).</summary>
        internal static Transform Root { get => root; set => root = value; }
        static readonly Dictionary<string, Material> cache = new();

        public static readonly (string name, string hint)[] Stations =
        {
            ("Stufen & Lücke", "Stick: laufen. Springen über die Lücke – Hechten in der Luft verlängert den Sprung."),
            ("Türenwand", "Zwei der fünf Türen brechen auf. Lauf hinein – die anderen bleiben fest."),
            ("Schieber", "Die roten Schieber stoßen dich weg. Lauf durch die Lücke hinter ihnen."),
            ("Drehbalken", "Über Rosa springen, unter Gelb ducken. Am Kreuz beides nacheinander."),
            ("Fahrinseln", "Spring auf die fahrenden Inseln – sie tragen dich mit."),
            ("Wippen", "Die Wippen kippen unter deinem Gewicht. Bleib nah an der Mitte."),
            ("Band & Walzen", "Das Band läuft rückwärts. Spring über die rollenden Walzen."),
            ("Kletterkante", "Zu hoch zum Springen: an die Kante springen, Festhalten halten, Stick nach vorn zieht dich hoch."),
            ("Geisterpfad", "Nur ein Weg aus Platten trägt. Grün heißt sicher, die anderen brechen weg."),
            ("Fallklappen", "Klappen glühen orange, kurz bevor sie aufgehen. Auf die geschlossenen hüpfen."),
            ("Windsteg", "Böen drücken dich zur Seite. Lenk dagegen und halte die Mitte."),
            ("Wechselgriffe", "Blöcke verschwinden zeitweise. Klettere Stufe für Stufe über die, die bleiben."),
            ("Glibbergrube", "Der Glibber steigt und fällt. Spring über die Steine, wenn sie frei sind."),
            ("Türgänge", "Hinter jeder Tür ein Gang: einer führt weiter, einer endet blind, einer hat eine Falltür."),
            ("Zielgerade", "Die Stufen hoch und durch den Zielbogen!")
        };

        public struct Result
        {
            public List<Checkpoint> checkpoints;
            public List<GooTide> goo;
            public Transform start;
        }

        internal static Material Mat(string name)
        {
            if (!cache.TryGetValue(name, out var m) || !m) cache[name] = m = Resources.Load<Material>("GSG/Materials/" + name);
            return m;
        }

        internal static GameObject Box(string name, float x0, float x1, float y0, float y1, float z0, float z1, string material, Transform parent = null, bool collider = true)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = name;
            go.transform.SetParent(parent ? parent : root, false);
            go.transform.localPosition = new Vector3((x0 + x1) / 2f, (y0 + y1) / 2f, (z0 + z1) / 2f);
            go.transform.localScale = new Vector3(x1 - x0, y1 - y0, z1 - z0);
            go.GetComponent<Renderer>().sharedMaterial = Mat(material);
            if (!collider) Object.DestroyImmediate(go.GetComponent<Collider>());
            return go;
        }

        internal static GameObject Floor(float z0, float z1, float y = 0f, float x0 = -5f, float x1 = 5f, string material = "Floor") => Box("Boden", x0, x1, y - 1f, y, z0, z1, material);

        internal static GameObject Cylinder(string name, Vector3 at, float radius, float length, Vector3 axis, string material, Transform parent = null, bool collider = true)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            go.name = name;
            go.transform.SetParent(parent ? parent : root, false);
            go.transform.localPosition = at;
            go.transform.localRotation = Quaternion.FromToRotation(Vector3.up, axis);
            go.transform.localScale = new Vector3(radius * 2f, length / 2f, radius * 2f);
            go.GetComponent<Renderer>().sharedMaterial = Mat(material);
            if (!collider) Object.DestroyImmediate(go.GetComponent<Collider>());
            return go;
        }

        /// <summary>Invisible ramp collider whose top runs from (za, ya) to (zb, yb).</summary>
        internal static void Ramp(float x0, float x1, float za, float ya, float zb, float yb)
        {
            var go = new GameObject("Rampe");
            go.transform.SetParent(root, false);
            float dz = zb - za, dy = yb - ya, length = Mathf.Sqrt(dz * dz + dy * dy), angle = Mathf.Atan2(dy, dz) * Mathf.Rad2Deg;
            var rotation = Quaternion.Euler(-angle, 0f, 0f);
            var mid = new Vector3((x0 + x1) / 2f, (ya + yb) / 2f, (za + zb) / 2f);
            go.transform.localPosition = mid - rotation * Vector3.up * 0.2f;
            go.transform.localRotation = rotation;
            go.AddComponent<BoxCollider>().size = new Vector3(x1 - x0, 0.4f, length);
        }

        /// <summary>Stairs from height `from` to `to` between z0 and z1 (0.3 m steps, walked up on a ramp collider).</summary>
        internal static void Stairs(float z0, float z1, float from, float to, float x0 = -5f, float x1 = 5f)
        {
            int steps = Mathf.Max(1, Mathf.CeilToInt(Mathf.Abs(to - from) / 0.3f));
            float depth = (z1 - z0) / steps;
            for (int i = 0; i < steps; i++)
            {
                float top = to > from ? from + (to - from) * (i + 1) / steps : from + (to - from) * i / steps;
                Box("Stufe", x0, x1, Mathf.Min(from, to) - 1f, top, z0 + i * depth, z0 + (i + 1) * depth, "Step", null, false);
            }
            if (to > from) Ramp(x0, x1, z0 - depth * 0.5f, from, z1 - depth * 0.5f, to);
            else Ramp(x0, x1, z0 + depth * 0.5f, from, z1 + depth * 0.5f, to);
        }

        internal static BreakDoor[] DoorWall(float z, int count, float x0, float x1, float y, bool lintel = true)
        {
            float pitch = (x1 - x0) / count, post = 0.4f;
            var doors = new BreakDoor[count];
            for (int i = 0; i < count; i++)
            {
                float cx = x0 + pitch * (i + 0.5f);
                var door = Box("Tür", cx - pitch / 2f + post / 2f, cx + pitch / 2f - post / 2f, y, y + 2.4f, z, z + 0.4f, "Door");
                doors[i] = door.AddComponent<BreakDoor>();
                if (i < count - 1) Box("Pfosten", cx + pitch / 2f - post / 2f, cx + pitch / 2f + post / 2f, y, y + (lintel ? 3f : 2.4f), z, z + 0.4f, "Wall");
            }
            float postTop = lintel ? 3f : 2.4f;
            Box("Pfosten", x0 - 0.6f, x0 + post / 2f, y, y + postTop, z, z + 0.4f, "Wall");
            Box("Pfosten", x1 - post / 2f, x1 + 0.6f, y, y + postTop, z, z + 0.4f, "Wall");
            // Exit walls stay low so the follow camera keeps the runner in view behind them.
            if (lintel) Box("Sturz", x0 - 0.6f, x1 + 0.6f, y + 3f, y + 3.5f, z - 0.05f, z + 0.45f, "Wall");
            return doors;
        }

        internal static void Bar(float x, float z, float baseY, float y0, float y1, float halfLength, float speed, float phase)
        {
            var pivot = new GameObject("Drehbalken");
            pivot.transform.SetParent(root, false);
            pivot.transform.localPosition = new Vector3(x, baseY, z);
            pivot.AddComponent<Rigidbody>().isKinematic = true;
            var sweeper = pivot.AddComponent<Sweeper>();
            sweeper.speed = speed; sweeper.phase = phase;
            bool low = y1 <= 0.8f;
            var bar = GameObject.CreatePrimitive(PrimitiveType.Cube);
            bar.name = low ? "Balken unten (springen)" : "Balken oben (ducken)";
            bar.transform.SetParent(pivot.transform, false);
            bar.transform.localPosition = new Vector3(0f, (y0 + y1) / 2f, 0f);
            bar.transform.localScale = new Vector3(halfLength * 2f, y1 - y0, 0.3f);
            bar.GetComponent<Renderer>().sharedMaterial = Mat(low ? "BarLow" : "BarHigh");
            var trigger = bar.GetComponent<BoxCollider>();
            trigger.isTrigger = true;
            trigger.size = new Vector3(1f, 1f, 1.5f);
            Cylinder("Mast", new Vector3(0f, (y1 + 0.3f) / 2f, 0f), 0.22f, y1 + 0.3f, Vector3.up, "Wall", pivot.transform);
        }

        internal static Checkpoint Check(int index, float z, float y, float halfWidth = 6f)
        {
            var go = new GameObject("Kontrollpunkt " + (index + 1));
            go.transform.SetParent(root, false);
            go.transform.localPosition = new Vector3(0f, y, z);
            var cp = go.AddComponent<Checkpoint>();
            cp.index = index;
            var trigger = go.AddComponent<BoxCollider>();
            trigger.isTrigger = true;
            trigger.center = new Vector3(0f, 1.5f, 0f);
            trigger.size = new Vector3(halfWidth * 2f, 3f, 1f);
            var flags = new List<Renderer>();
            foreach (var side in new[] { -1f, 1f })
            {
                float px = side * (Mathf.Min(halfWidth, 5f) + 0.35f);
                Cylinder("Fahnenmast", new Vector3(px, 1.2f, 0f), 0.06f, 2.4f, Vector3.up, "Ink", go.transform, false);
                var flag = Box("Fahne", px - 0.02f, px + 0.02f, 1.75f, 2.35f, 0.05f, 0.75f, "Flag", go.transform, false);
                flag.transform.localPosition = new Vector3(px, 2.05f, 0.4f);
                flags.Add(flag.GetComponent<Renderer>());
            }
            cp.flags = flags.ToArray();
            return cp;
        }

        static float Spread(int i) => ((uint)((i + 1) * 2654435761u) % 1000u) / 1000f;

        public static Result Build(Transform parent)
        {
            root = parent;
            cache.Clear();
            var cps = new List<Checkpoint>();
            var goo = new List<GooTide>();

            // 1 · Stufen & Lücke
            var start = new GameObject("Start").transform;
            start.SetParent(root, false);
            start.localPosition = new Vector3(0f, 0.05f, -2f);
            Floor(-6f, 4.5f);
            Box("Startlinie", -5f, 5f, -0.02f, 0.01f, -0.6f, -0.2f, "Finish", null, false);
            cps.Add(Check(0, -2f, 0f));
            Stairs(4.5f, 7.5f, 0f, 1.2f);
            Floor(7.5f, 12f, 1.2f);
            Floor(14.4f, 18f, 1.2f);
            Stairs(18f, 21f, 1.2f, 0f);

            // 2 · Türenwand (5 Türen, 2 echte)
            cps.Add(Check(1, 22.5f, 0f));
            Floor(21f, 34f);
            var doorRow = new GameObject("Türreihe").AddComponent<DoorRow>();
            doorRow.transform.SetParent(root, false);
            doorRow.doors = DoorWall(27f, 5, -5f, 5f, 0f);
            doorRow.real = 2;

            // 3 · Schieber
            cps.Add(Check(2, 35f, 0f));
            Floor(34f, 45f);
            foreach (var (z, period, phase) in new[] { (37.5f, 2.6f, 0f), (41f, 2.2f, Mathf.PI) })
            {
                var pusher = Box("Schieber", -1.2f, 1.2f, 0f, 1.4f, z, z + 1.2f, "Pusher");
                pusher.AddComponent<Rigidbody>().isKinematic = true;
                var m = pusher.AddComponent<Mover>();
                m.axis = Vector3.right; m.amplitude = 3.6f; m.period = period; m.phase = phase; m.shoves = true;
            }

            // 4 · Drehbalken: unten springen, oben ducken, Kreuz
            cps.Add(Check(3, 46f, 0f));
            Floor(45f, 66f);
            Bar(0f, 49.5f, 0f, 0.15f, 0.6f, 4.6f, 1.6f, 0f);
            Bar(0f, 54.5f, 0f, 1.0f, 1.4f, 4.6f, -1.2f, 0.5f);
            Bar(0f, 59.5f, 0f, 0.15f, 0.6f, 4.2f, 1.3f, 0f);
            Bar(0f, 59.5f, 0f, 1.0f, 1.4f, 4.2f, -1.0f, 1.6f);

            // 5 · Fahrinseln über dem Abgrund
            cps.Add(Check(4, 65f, 0f));
            foreach (var (z0, z1, phase) in new[] { (66.6f, 68.8f, 0f), (69.6f, 71.8f, 2f), (72.6f, 74.8f, 4f) })
            {
                var island = Box("Fahrinsel", -1.6f, 1.6f, -0.6f, 0f, z0, z1, "Floor");
                island.AddComponent<Rigidbody>().isKinematic = true;
                var m = island.AddComponent<Mover>();
                m.axis = Vector3.right; m.amplitude = 2.6f; m.period = 3.2f; m.phase = phase;
            }
            Floor(75.4f, 80f);

            // 6 · Wippen: echte Gelenke, die unter dem Gewicht kippen
            cps.Add(Check(5, 77f, 0f));
            foreach (var (z0, z1) in new[] { (80.6f, 86f), (86.6f, 92f) })
            {
                var plank = Box("Wippe", -2.6f, 2.6f, -0.5f, 0f, z0, z1, "Seesaw");
                var rb = plank.AddComponent<Rigidbody>();
                rb.mass = 45f; rb.angularDamping = 2.5f; rb.linearDamping = 0f;
                rb.constraints = RigidbodyConstraints.FreezePosition | RigidbodyConstraints.FreezeRotationX | RigidbodyConstraints.FreezeRotationY;
                rb.interpolation = RigidbodyInterpolation.Interpolate;
                var hinge = plank.AddComponent<HingeJoint>();
                hinge.axis = Vector3.forward; hinge.anchor = Vector3.zero;
                hinge.useLimits = true; hinge.limits = new JointLimits { min = -24f, max = 24f };
                hinge.useSpring = true; hinge.spring = new JointSpring { spring = 6500f, damper = 900f, targetPosition = 0f };
                Box("Wippbock", -0.5f, 0.5f, -1.6f, -0.5f, (z0 + z1) / 2f - 0.5f, (z0 + z1) / 2f + 0.5f, "Wall", null, false);
            }
            Floor(92.6f, 98f);

            // 7 · Förderband (rückwärts) mit rollenden Walzen
            cps.Add(Check(6, 95f, 0f));
            var belt = Floor(98f, 110f, 0f, -5f, 5f, "Belt");
            belt.name = "Förderband";
            belt.AddComponent<Conveyor>().speed = -3.4f;
            foreach (var (z, period, phase) in new[] { (102f, 2.6f, 0f), (106f, 2.1f, 2.1f) })
            {
                var log = new GameObject("Walze");
                log.transform.SetParent(root, false);
                log.transform.localPosition = new Vector3(0f, 0.32f, z);
                log.AddComponent<Rigidbody>().isKinematic = true;
                var col = log.AddComponent<CapsuleCollider>();
                col.direction = 2; col.radius = 0.32f; col.height = 1.3f;
                var spin = new GameObject("Drehung").transform;
                spin.SetParent(log.transform, false);
                Cylinder("Stamm", Vector3.zero, 0.32f, 1.1f, Vector3.forward, "Roller", spin, false);
                Box("Band", -0.33f, 0.33f, -0.06f, 0.06f, -0.1f, 0.1f, "Ink", spin, false).transform.localPosition = new Vector3(0f, 0.27f, 0f);
                var m = log.AddComponent<Mover>();
                m.axis = Vector3.right; m.amplitude = 4f; m.period = period; m.phase = phase; m.shoves = true; m.shoveForce = 6f;
                m.rollVisual = spin; m.rollRadius = 0.32f;
            }
            Floor(110f, 113f);

            // 8 · Kletterkante: zu hoch zum Springen
            cps.Add(Check(7, 111.5f, 0f));
            Box("Kante", -5f, 5f, -1f, 1.85f, 113f, 119f, "Ledge");

            // 9 · Geisterpfad: 5 Reihen × 4 Platten, ein zufälliger Weg trägt
            const float upper = 1.85f;
            cps.Add(Check(8, 117f, upper));
            var path = new GameObject("Geisterpfad").AddComponent<GhostPath>();
            path.transform.SetParent(root, false);
            path.columns = 4;
            var tiles = new List<GhostTile>();
            for (int r = 0; r < 5; r++)
                for (int c = 0; c < 4; c++)
                {
                    float x = -3.6f + c * 2.4f, z = 119.6f + r * 2f;
                    tiles.Add(Box("Geisterplatte", x - 1.1f, x + 1.1f, upper - 0.4f, upper, z, z + 1.8f, "Tile").AddComponent<GhostTile>());
                }
            path.tiles = tiles.ToArray();
            Floor(129.6f, 134f, upper);

            // 10 · Fallklappen mit Vorwarnung
            cps.Add(Check(9, 131.5f, upper));
            for (int r = 0; r < 4; r++)
                for (int c = 0; c < 5; c++)
                {
                    float x = -5f + c * 2f, z = 134.2f + r * 2f;
                    var plate = new GameObject("Fallklappe");
                    plate.transform.SetParent(root, false);
                    plate.transform.localPosition = new Vector3(x + 1f, upper - 0.2f, z + 0.95f);
                    plate.AddComponent<BoxCollider>().size = new Vector3(1.9f, 0.4f, 1.9f);
                    var hinge = new GameObject("Scharnier").transform;
                    hinge.SetParent(plate.transform, false);
                    hinge.localPosition = new Vector3(-0.95f, 0f, 0f);
                    var visual = Box("Klappe", 0f, 1.9f, -0.2f, 0.2f, -0.95f, 0.95f, "Trap", hinge, false);
                    visual.transform.localPosition = new Vector3(0.95f, 0f, 0f);
                    var blink = plate.AddComponent<Blinker>();
                    blink.kind = Blinker.Kind.Trapdoor; blink.hinge = hinge;
                    blink.period = r == 3 ? 3f : 4.2f; blink.open = 0.3f; blink.phase = r == 3 ? ((r + c) % 2) * 0.5f : Spread(r * 5 + c);
                }
            Floor(142.4f, 146f, upper);

            // 11 · Windsteg mit wechselnden Böen
            cps.Add(Check(10, 144f, upper));
            Floor(146f, 160f, upper, -1.1f, 1.1f);
            foreach (var (z0, z1, dx, period, phase) in new[] { (146f, 151f, 2.6f, 3f, 0f), (151f, 155.5f, -2.8f, 2.6f, 0.5f), (155.5f, 160f, 3f, 2f, 0.25f) })
            {
                var zoneGo = new GameObject("Böe");
                zoneGo.transform.SetParent(root, false);
                zoneGo.transform.localPosition = new Vector3(0f, upper, (z0 + z1) / 2f);
                var box = zoneGo.AddComponent<BoxCollider>();
                box.isTrigger = true; box.center = new Vector3(0f, 2f, 0f); box.size = new Vector3(12f, 6f, z1 - z0);
                var gust = zoneGo.AddComponent<GustZone>();
                gust.drift = new Vector3(dx, 0f, 0f); gust.period = period; gust.phase = phase; gust.on = 0.55f;
                Cylinder("Windrad", new Vector3(-Mathf.Sign(dx) * 6.5f, 1.4f, 0f), 0.9f, 0.3f, Vector3.right * Mathf.Sign(dx), "Wall", zoneGo.transform, false);
            }
            Floor(160f, 164f, upper);

            // 12 · Wechselgriffe: drei Stufen à 1,7 m, Blöcke verschwinden zeitweise
            cps.Add(Check(11, 162f, upper));
            for (int level = 0; level < 3; level++)
            {
                float z0 = 164f + level * 2.6f, top = upper + 1.7f * (level + 1);
                var columns = new[] { (-5f, -1.75f), (-1.65f, 1.65f), (1.75f, 5f) };
                for (int i = 0; i < columns.Length; i++)
                {
                    var (x0, x1) = columns[i];
                    var hold = new GameObject("Griffblock");
                    hold.transform.SetParent(root, false);
                    float y0 = upper - 1f;
                    hold.transform.localPosition = new Vector3((x0 + x1) / 2f, (y0 + top) / 2f, z0 + 1.3f);
                    hold.AddComponent<BoxCollider>().size = new Vector3(x1 - x0, top - y0, 2.6f);
                    var visual = Box("Block", -(x1 - x0) / 2f, (x1 - x0) / 2f, -(top - y0) / 2f, (top - y0) / 2f, -1.3f, 1.3f, "Hold", hold.transform, false);
                    var blink = hold.AddComponent<Blinker>();
                    blink.kind = Blinker.Kind.Hold; blink.hinge = visual.transform;
                    blink.period = 5.2f + i * 0.7f; blink.open = 0.3f; blink.phase = Spread(level * 3 + i + 90);
                }
            }
            const float roof = upper + 1.7f * 3f;
            Floor(171.8f, 176f, roof);

            // 13 · Glibbergrube: Steine über steigendem und fallendem Glibber
            cps.Add(Check(12, 174f, roof));
            foreach (var (x, z) in new[] { (-2f, 177.2f), (1.5f, 179.8f), (-1f, 182.4f), (2.2f, 185f), (0f, 187.4f) })
                Box("Stein", x - 0.9f, x + 0.9f, roof - 0.8f, roof, z - 0.9f, z + 0.9f, "Step");
            var gooGo = new GameObject("Glibber");
            gooGo.transform.SetParent(root, false);
            gooGo.transform.localPosition = new Vector3(0f, roof - 1f, 182.3f);
            Box("Glibberfläche", -6f, 6f, -1f, 0f, -6.3f, 6.3f, "Goo", gooGo.transform, false);
            var tide = gooGo.AddComponent<GooTide>();
            tide.low = roof - 1.6f; tide.high = roof + 0.3f; tide.period = 7f;
            tide.x0 = -6f; tide.x1 = 6f; tide.z0 = 176f; tide.z1 = 188.6f;
            goo.Add(tide);
            Box("Grubenrand", -6.6f, -6f, roof - 3f, roof - 0.2f, 176f, 188.6f, "Wall");
            Box("Grubenrand", 6f, 6.6f, roof - 3f, roof - 0.2f, 176f, 188.6f, "Wall");

            // 14 · Türgänge: weiter, Sackgasse, Falltür, zu
            cps.Add(Check(13, 190.5f, roof));
            Floor(189f, 193.4f, roof, -6.6f, 6.6f);
            var lanes = new GameObject("Türgänge").AddComponent<LaneRow>();
            lanes.transform.SetParent(root, false);
            lanes.fronts = DoorWall(193.4f, 4, -6f, 6f, roof);
            var floors = new List<GhostTile>();
            for (int i = 0; i < 4; i++)
            {
                float cx = -6f + 3f * (i + 0.5f);
                var lane = Box("Gangboden", cx - 1.5f, cx + 1.5f, roof - 0.4f, roof, 193.8f, 197.8f, "Floor").AddComponent<GhostTile>();
                lane.lookLikeFloor = true;
                floors.Add(lane);
                if (i < 3) Box("Gangwand", cx + 1.3f, cx + 1.7f, roof, roof + 2f, 193.8f, 197.8f, "Wall");
            }
            Box("Gangwand", -6.6f, -6.2f, roof, roof + 2f, 193.8f, 197.8f, "Wall");
            Box("Gangwand", 6.2f, 6.6f, roof, roof + 2f, 193.8f, 197.8f, "Wall");
            lanes.floors = floors.ToArray();
            lanes.exits = DoorWall(197.8f, 4, -6f, 6f, roof, false);
            Floor(198.2f, 203f, roof, -6.6f, 6.6f);

            // 15 · Zielgerade
            const float goal = roof + 0.9f;
            cps.Add(Check(14, 201.5f, roof));
            Stairs(203f, 206f, roof, goal);
            Box("Zielpodest", -5f, 5f, goal - 1f, goal, 206f, 214f, "Finish");
            Box("Zielsäule", -5.6f, -5f, goal, goal + 4f, 208.8f, 209.4f, "Wall");
            Box("Zielsäule", 5f, 5.6f, goal, goal + 4f, 208.8f, 209.4f, "Wall");
            Box("Zielbogen", -5.6f, 5.6f, goal + 4f, goal + 4.8f, 208.8f, 209.4f, "FinishBanner", null, false);
            var finish = new GameObject("Ziellinie");
            finish.transform.SetParent(root, false);
            finish.transform.localPosition = new Vector3(0f, goal, 209.1f);
            var ft = finish.AddComponent<BoxCollider>();
            ft.isTrigger = true; ft.center = new Vector3(0f, 1.5f, 0f); ft.size = new Vector3(10f, 3f, 0.6f);
            finish.AddComponent<FinishLine>();

            Decor();
            return new Result { checkpoints = cps, goo = goo, start = start };
        }

        /// <summary>Gameshow surroundings: a deep floor far below, striped towers and floating balloons.</summary>
        internal static void Decor()
        {
            var deco = new GameObject("Kulisse").transform;
            deco.SetParent(root, false);
            Box("Tiefe", -160f, 160f, -31f, -30f, -120f, 360f, "Depth", deco, false);
            var colors = new[] { "Wall", "Door", "Seesaw", "Hold", "Ledge" };
            for (int i = 0; i < 18; i++)
            {
                float side = i % 2 == 0 ? -1f : 1f, z = -10f + i * 13f, x = side * (16f + Spread(i) * 14f), h = 18f + Spread(i + 30) * 22f;
                Box("Turm", x - 1.6f, x + 1.6f, -30f, -30f + h, z - 1.6f, z + 1.6f, colors[i % colors.Length] + "Deco", deco, false);
                var balloon = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                Object.DestroyImmediate(balloon.GetComponent<Collider>());
                balloon.name = "Ballon";
                balloon.transform.SetParent(deco, false);
                balloon.transform.localPosition = new Vector3(x * 0.9f, -30f + h + 4f + Spread(i + 7) * 6f, z + 4f);
                balloon.transform.localScale = Vector3.one * (2.2f + Spread(i + 3) * 1.4f);
                balloon.GetComponent<Renderer>().sharedMaterial = Mat(colors[(i + 2) % colors.Length] + "Deco");
            }
        }
    }
}
