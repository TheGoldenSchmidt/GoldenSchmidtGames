using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace GSG.Parcours
{
    // Flat mirror of shared/matches/parcoursCourses.ts (exported to Resources/GSG/Courses/<id>.json):
    // unset indices are -1, unset motions have an empty axis, unset blinks a period of 0.
    [Serializable]
    public class CourseBox
    {
        public float x0, x1, y0, y1, z0, z1, belt, beltX, moveAmp, movePeriod, movePhase, blinkPeriod, blinkPhase, blinkOpen, blinkFrom;
        public string look, moveAxis;
        public int door = -1, tile = -1, seesaw = -1;
        public bool Moves => !string.IsNullOrEmpty(moveAxis) && movePeriod > 0f;
        /// <summary>Position offset of a moving box at time t (seconds), like offsetAt in parcoursCourses.ts.</summary>
        public float Offset(float t) => Moves ? moveAmp * Mathf.Sin(2f * Mathf.PI * t * 1000f / movePeriod + movePhase) : 0f;
        public float CenterX(float t) => (x0 + x1) / 2f + (moveAxis == "x" ? Offset(t) : 0f);
    }

    [Serializable] public class CourseSweeper { public float x, z, y0, y1, length, speed, phase, from; }
    [Serializable] public class CourseCheckpoint { public float z, y, x; }
    [Serializable] public class CourseDoorRow { public float z; public int[] doors; public int real; public float[] xs; }
    [Serializable] public class CourseLaneRow { public float z, exitZ; public int[] fronts, exits, floors; public float[] xs; public int through, dead, trap; }
    [Serializable] public class CourseTileRow { public float z; public int[] tiles; }

    [Serializable]
    public class CourseData
    {
        public string id, name;
        public float width, finishZ, finishY, killY, finishX, limitMs, knock;
        public bool elimination, hasGoo;
        public int seesaws;
        public CourseBox[] boxes;
        public CourseSweeper[] sweepers;
        public CourseCheckpoint[] checkpoints;
        public CourseDoorRow[] doorRows;
        public CourseLaneRow[] laneRows;
        public CourseTileRow[] tileRows;

        public static CourseData Load(string id)
        {
            var asset = Resources.Load<TextAsset>("GSG/Courses/" + id);
            return asset ? JsonUtility.FromJson<CourseData>(asset.text) : null;
        }
    }

    /// <summary>
    /// Builds a run of the online parcours from its data with the obstacles of the Unity probe
    /// level: floors and stairs (ramp colliders), breaking doors in rows and lanes with secret
    /// floors, pushers and moving islands, conveyor belts, hinged seesaws, spinning bars,
    /// checkpoints and the finish arch.
    /// </summary>
    public static class CourseBuilder
    {
        public class Built
        {
            public readonly List<Checkpoint> checkpoints = new();
            public readonly Dictionary<int, BreakDoor> doors = new();
            public readonly Dictionary<int, GhostTile> tiles = new();
        }

        static string Material(string look) => look switch
        {
            "floor" => "Floor", "wall" => "Wall", "door" => "Door", "pusher" => "Pusher", "belt" => "Belt", "step" => "Step", "seesaw" => "Seesaw",
            "tile" => "Tile", "roller" => "Roller", "ledge" => "Ledge", "finish" => "Finish", "trap" => "Trap", "hold" => "Hold", _ => "Floor"
        };

        public static Built Build(CourseData c, Transform root)
        {
            ParcoursLevel.Root = root;
            var built = new Built();
            // Stairs: consecutive step boxes become one flight with a ramp collider (runners walk up).
            var steps = c.boxes.Where(b => b.look == "step").OrderBy(b => b.z0).ToList();
            while (steps.Count > 0)
            {
                var flight = new List<CourseBox> { steps[0] };
                steps.RemoveAt(0);
                while (steps.Count > 0 && Mathf.Abs(steps[0].z0 - flight[^1].z1) < 0.01f && Mathf.Approximately(steps[0].x0, flight[0].x0)) { flight.Add(steps[0]); steps.RemoveAt(0); }
                ParcoursLevel.Stairs(flight[0].z0, flight[^1].z1, flight[0].y0 + 1f, flight[^1].y1, flight[0].x0, flight[0].x1);
            }
            foreach (var b in c.boxes)
            {
                if (b.look == "step") continue;
                string name = b.door >= 0 ? "Tür" : b.tile >= 0 ? "Gassenboden" : b.seesaw >= 0 ? "Wippe" : b.Moves ? (b.look == "pusher" ? "Schieber" : "Fahrinsel") : b.look == "wall" ? "Wand" : "Boden";
                var go = ParcoursLevel.Box(name, b.x0, b.x1, b.y0, b.y1, b.z0, b.z1, Material(b.look));
                if (b.door >= 0) built.doors[b.door] = go.AddComponent<BreakDoor>();
                if (b.tile >= 0) { var t = go.AddComponent<GhostTile>(); t.lookLikeFloor = b.look == "floor"; built.tiles[b.tile] = t; }
                if (b.Moves)
                {
                    go.AddComponent<Rigidbody>().isKinematic = true;
                    var m = go.AddComponent<Mover>();
                    m.axis = b.moveAxis == "y" ? Vector3.up : b.moveAxis == "z" ? Vector3.forward : Vector3.right;
                    m.amplitude = b.moveAmp; m.period = b.movePeriod / 1000f; m.phase = b.movePhase;
                    m.shoves = b.look == "pusher" || b.look == "roller";
                }
                if (b.belt != 0f) go.AddComponent<Conveyor>().speed = b.belt;
                if (b.seesaw >= 0)
                {
                    var rb = go.AddComponent<Rigidbody>();
                    rb.mass = 45f; rb.angularDamping = 2.5f; rb.linearDamping = 0f;
                    rb.constraints = RigidbodyConstraints.FreezePosition | RigidbodyConstraints.FreezeRotationX | RigidbodyConstraints.FreezeRotationY;
                    rb.interpolation = RigidbodyInterpolation.Interpolate;
                    var hinge = go.AddComponent<HingeJoint>();
                    hinge.axis = Vector3.forward; hinge.anchor = Vector3.zero;
                    hinge.useLimits = true; hinge.limits = new JointLimits { min = -24f, max = 24f };
                    hinge.useSpring = true; hinge.spring = new JointSpring { spring = 6500f, damper = 900f, targetPosition = 0f };
                    ParcoursLevel.Box("Wippbock", -0.5f, 0.5f, b.y0 - 1.1f, b.y0, (b.z0 + b.z1) / 2f - 0.5f, (b.z0 + b.z1) / 2f + 0.5f, "Wall", null, false);
                }
            }
            foreach (var row in c.doorRows)
            {
                // Inactive until the doors are assigned: the row draws its real doors in Awake.
                var go = new GameObject("Türreihe"); go.SetActive(false);
                go.transform.SetParent(root, false);
                var dr = go.AddComponent<DoorRow>();
                dr.doors = row.doors.Select(i => built.doors[i]).ToArray();
                dr.real = row.real;
                go.SetActive(true);
            }
            foreach (var row in c.laneRows)
            {
                var go = new GameObject("Gassen"); go.SetActive(false);
                go.transform.SetParent(root, false);
                var lr = go.AddComponent<LaneRow>();
                lr.fronts = row.fronts.Select(i => built.doors[i]).ToArray();
                lr.exits = row.exits.Select(i => built.doors[i]).ToArray();
                lr.floors = row.floors.Select(i => built.tiles[i]).ToArray();
                lr.through = row.through; lr.dead = row.dead; lr.trap = row.trap;
                go.SetActive(true);
            }
            foreach (var s in c.sweepers) ParcoursLevel.Bar(s.x, s.z, 0f, s.y0, s.y1, s.length, s.speed, s.phase);
            for (int i = 0; i < c.checkpoints.Length; i++) built.checkpoints.Add(ParcoursLevel.Check(i, c.checkpoints[i].z, c.checkpoints[i].y, c.width / 2f));
            var finish = new GameObject("Ziel");
            finish.transform.SetParent(root, false);
            finish.transform.localPosition = new Vector3(c.finishX, c.finishY, c.finishZ);
            var ft = finish.AddComponent<BoxCollider>();
            ft.isTrigger = true; ft.center = new Vector3(0f, 1.5f, 0f); ft.size = new Vector3(c.width, 3f, 0.6f);
            finish.AddComponent<FinishLine>();
            // Finish arch over the line.
            foreach (var side in new[] { -1f, 1f }) ParcoursLevel.Box("Zielpfosten", side * c.width / 2f - 0.3f, side * c.width / 2f + 0.3f, c.finishY, c.finishY + 4f, c.finishZ - 0.3f, c.finishZ + 0.3f, "Finish", null, false);
            ParcoursLevel.Box("Zielbanner", -c.width / 2f - 0.3f, c.width / 2f + 0.3f, c.finishY + 3.4f, c.finishY + 4.2f, c.finishZ - 0.2f, c.finishZ + 0.2f, "FinishBanner", null, false);
            ParcoursLevel.Decor();
            return built;
        }
    }
}
