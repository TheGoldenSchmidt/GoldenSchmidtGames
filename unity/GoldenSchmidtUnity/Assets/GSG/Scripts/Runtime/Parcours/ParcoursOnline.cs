using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>
    /// Clock of the moving course parts (spinning bars, moving islands, pushers): Unity's own time
    /// in the local tests, the room's match time (seconds) when a room's run is drawn.
    /// </summary>
    public static class CourseClock
    {
        public static System.Func<float> Room;
    }

    [System.Serializable]
    public class ParcoursSnapRacer
    {
        public string id, pose;
        public float x, y, z, vx, vy, vz, face, best, finishAt, outAt;
        public int checkpoint, falls, grab;
        public bool duck, grounded;
    }

    [System.Serializable]
    public class ParcoursSnap
    {
        public float time, firstFinish;
        public bool done;
        public string course, doors, tiles;
        public float[] tilt;
        public int[] order;
        public ParcoursSnapRacer[] racers;
        public OnlineEvent[] events;
    }

    /// <summary>
    /// Online drawing of a room's parcours run or final (Türenlotto, Kreiselkurs, Standhaft): the room
    /// computes with shared/matches/parcours.ts, see unityParcoursSnapshot in src/unityMatch.ts. Racers
    /// follow the snapshots, doors and secret floors their public state strings, seesaws their tilt,
    /// moving parts the room's clock; room events become the local sounds, toasts and effects.
    /// Unity's HUD sends the stick (field: x right, y towards the camera, so forward is −y), "Festhalten"
    /// and "Ducken" held, and taps of "Springen" (a) and "Hechten" (b).
    /// </summary>
    public class ParcoursOnline
    {
        public readonly List<RemoteRacer> racers = new();
        public readonly int me;
        public ParcoursSnap Snap { get; private set; }
        public CameraRig rig;
        readonly List<Seat> seats;
        readonly CourseBuilder.Built built;
        readonly Hud hud;
        readonly bool elimination;
        readonly Dictionary<int, Rigidbody> seesaws = new();
        float snapAt, snapInterval = 0.05f, snapTime, prevSnapTime;
        int lastEvent = -1, lastCheckpoint;
        char[] doors, tiles;

        public RemoteRacer Own => me >= 0 ? racers[me] : null;
        public ParcoursSnapRacer Mine => Snap != null && me >= 0 ? Snap.racers[me] : null;
        /// <summary>Room time (ms) of the drawn frame: between the last two snapshots.</summary>
        public float Now => Mathf.Lerp(prevSnapTime, snapTime, Alpha);
        float Alpha => Fx.Reduced ? 1f : Mathf.Clamp01((Time.unscaledTime - snapAt) / snapInterval);
        public bool CanAct(bool playing) => playing && Mine != null && !Snap.done && Mine.pose != "done" && Mine.pose != "out";

        public ParcoursOnline(List<Seat> seats, CourseBuilder.Built built, Hud hud, bool elimination, System.Func<Seat, Transform, Figure> spawn)
        {
            this.seats = seats; this.built = built; this.hud = hud; this.elimination = elimination;
            me = seats.FindIndex(s => s.isPlayer);
            foreach (var seat in seats)
            {
                var go = new GameObject(seat.name);
                var racer = go.AddComponent<RemoteRacer>();
                racer.seat = seat;
                racer.figure = spawn(seat, go.transform);
                racers.Add(racer);
            }
            CourseClock.Room = () => Now / 1000f;
            if (built == null) return;
            // Seesaws lean as the room says (no hinge physics of their own).
            foreach (var (index, body) in built.seesaws)
            {
                var hinge = body.GetComponent<HingeJoint>();
                if (hinge) Object.Destroy(hinge);
                body.isKinematic = true;
                seesaws[index] = body;
            }
        }

        public void Apply(string json)
        {
            var next = JsonUtility.FromJson<ParcoursSnap>(json);
            if (next?.racers == null || next.racers.Length != racers.Count) return;
            bool first = Snap == null;
            if (!first && next.time > snapTime) snapInterval = Mathf.Clamp((next.time - snapTime) / 1000f, 0.03f, 0.25f);
            prevSnapTime = first ? next.time : snapTime;
            snapTime = next.time;
            snapAt = Time.unscaledTime;
            Snap = next;
            for (int i = 0; i < racers.Count; i++)
            {
                var r = next.racers[i];
                racers[i].Set(new Vector3(r.x, r.y, r.z), new Vector3(r.vx, r.vy, r.vz), r.face, r.pose ?? "run", r.duck, r.grounded);
            }
            Doors(first);
            Tiles(first);
            Events();
            var mine = Mine;
            if (mine != null && built != null)
            {
                if (first) lastCheckpoint = mine.checkpoint;
                else if (mine.checkpoint > lastCheckpoint)
                {
                    lastCheckpoint = mine.checkpoint;
                    if (mine.checkpoint < built.checkpoints.Count) built.checkpoints[mine.checkpoint].Light();
                    Sfx.Play("chime");
                    hud.Toast("Kontrollpunkt!", Palette.Accent, 0.6f);
                }
            }
        }

        bool Near(Vector3 at) => Own == null || (Own.transform.position - at).sqrMagnitude < 12f * 12f;

        void Doors(bool first)
        {
            if (built == null || Snap.doors == null) return;
            doors ??= new string('0', Snap.doors.Length).ToCharArray();
            for (int i = 0; i < Snap.doors.Length && i < doors.Length; i++)
            {
                char c = Snap.doors[i];
                if (c == doors[i]) continue;
                doors[i] = c;
                if (!built.doors.TryGetValue(i, out var door)) continue;
                // Shards fly where the nearest racer ran.
                var at = door.transform.position;
                var by = racers.OrderBy(r => (r.transform.position - at).sqrMagnitude).FirstOrDefault();
                door.Show(c, by ? by.Heading : Vector3.forward, Near(at), first);
            }
        }

        void Tiles(bool first)
        {
            if (built == null || Snap.tiles == null) return;
            tiles ??= new string('0', Snap.tiles.Length).ToCharArray();
            for (int i = 0; i < Snap.tiles.Length && i < tiles.Length; i++)
            {
                char c = Snap.tiles[i];
                if (c == tiles[i]) continue;
                tiles[i] = c;
                if (built.tiles.TryGetValue(i, out var tile)) tile.Show(c, Near(tile.transform.position) && Mine != null, first);
            }
        }

        RemoteRacer RacerOf(OnlineEvent e, int k)
        {
            if (e.ids == null || e.ids.Length <= k) return null;
            int i = System.Array.FindIndex(MatchBridge.Setup.players, p => p.id == e.ids[k]);
            return i >= 0 && i < racers.Count ? racers[i] : null;
        }

        /// <summary>Room events as the local runs' sounds, toasts and effects (louder for the own racer).</summary>
        void Events()
        {
            if (Snap.events == null) return;
            // The first snapshot only sets the mark: no replay of what happened before this device joined.
            if (lastEvent < 0) { lastEvent = Snap.events.Length > 0 ? Snap.events.Max(e => e.seq) : 0; return; }
            foreach (var e in Snap.events.OrderBy(e => e.seq))
            {
                if (e.seq <= lastEvent) continue;
                lastEvent = e.seq;
                var a = RacerOf(e, 0);
                bool mine = a != null && a == Own;
                var at = a ? a.transform.position : Vector3.zero;
                switch (e.kind)
                {
                    case "jump": if (mine) Sfx.Play("jump", 0.8f); a?.figure?.Shot("jumpStart", 0.3f, 0.05f, 1.7f, 0.1f); break;
                    case "dive": if (mine) Sfx.Play("dive"); a?.figure?.Shot("dash", 0.45f, 0.05f, 1.3f); break;
                    case "land": if (a) { if (mine) Sfx.Play("land", 0.6f); a.figure?.Squash(); Fx.Dust(at, Palette.Stone, 3); } break;
                    case "grab": if (mine) { Sfx.Play("grab", 0.8f); hud.Toast(e.text, Palette.Paper, 0.5f); } break;
                    case "climb": if (mine) Sfx.Play("jump", 0.5f); break;
                    case "hold":
                    {
                        // ids: the held racer, the one holding on.
                        var b = RacerOf(e, 1);
                        if (a == Own || b == Own) hud.Toast(b == Own ? "Erwischt!" : "Festgehalten!", Palette.Paper, 0.65f);
                        break;
                    }
                    case "hit": case "shove":
                        if (a == null) break;
                        a.figure?.Shot("hit", 0.6f, 0.04f, 1.2f);
                        Sfx.Play("hit", mine ? 1f : Near(at) ? 0.35f : 0f);
                        Fx.Sparks(at + Vector3.up, Palette.Accent, e.kind == "hit" ? 12 : 8);
                        if (mine) { Fx.Shake(e.kind == "hit" ? 0.6f : 0.35f); if (e.kind == "hit") Fx.HitStop(0.07f); }
                        break;
                    case "fall":
                        if (mine) { hud.Toast("Abgestürzt!", Palette.Warn, 0.6f); Sfx.Play("lose", 0.5f); }
                        break;
                    case "out":
                        if (mine) { hud.ReleaseAll(); hud.Toast(elimination ? "Ausgeschieden" : e.text, Palette.Warn, 1f); Sfx.Play("lose"); }
                        else if (a) hud.Toast($"{a.seat.name} ist raus", Palette.Paper, 0.7f);
                        break;
                    case "finish":
                        if (a == null) break;
                        Fx.Confetti(at + Vector3.up * 0.5f, mine ? 60 : 20);
                        if (mine) { Sfx.Play("fanfare"); hud.Toast(e.text, Palette.Accent, 1.4f); hud.ReleaseAll(); }
                        else { Sfx.Play("chime", 0.5f); if (Snap.order != null && Snap.order.Length == 1) hud.Toast($"{a.seat.name} ist im Ziel – noch 20 s!", Palette.Paper, 1.2f); }
                        break;
                    case "finale":
                    {
                        bool won = e.ids != null && Own && e.ids.Any(id => RacerOf(new OnlineEvent { ids = new[] { id } }, 0) == Own);
                        hud.Toast(won ? "Du stehst noch!" : e.text, won ? Palette.Accent : Palette.Paper, 1.4f);
                        Sfx.Play(won ? "fanfare" : "chime");
                        if (won) Fx.Confetti(Own.transform.position + Vector3.up, 50);
                        break;
                    }
                }
            }
        }

        /// <summary>Input, racers and seesaws for this frame.</summary>
        public void Frame(bool playing)
        {
            if (Snap == null) return;
            if (me >= 0)
            {
                if (CanAct(playing))
                {
                    var d = rig ? rig.Relative(hud.Stick) : new Vector3(hud.Stick.x, 0f, hud.Stick.y);
                    bool jump = hud.Pressed("a"), dive = hud.Pressed("b");
                    // Forward along the course is −y in the room's field; a tap carries the stick of the same moment.
                    MatchBridge.Input(d.x, -d.z, 0f, 0f, hud.Held("grab"), hud.Held("duck"), jump || dive);
                    if (jump) MatchBridge.Press("a");
                    if (dive) MatchBridge.Press("b");
                }
                else MatchBridge.Input(0f, 0f, 0f, 0f);
            }
            float alpha = Alpha;
            foreach (var r in racers) r.Draw(alpha, Time.deltaTime);
            if (Snap.tilt != null)
                foreach (var (index, body) in seesaws)
                    if (index < Snap.tilt.Length) body.MoveRotation(Quaternion.Euler(0f, 0f, -Snap.tilt[index] * Mathf.Rad2Deg));
        }

        /// <summary>The run's places: finishing order first, then the distance reached.</summary>
        public int PlaceOf(int seat)
        {
            if (Snap == null) return 0;
            var order = Snap.order ?? new int[0];
            var ranked = Enumerable.Range(0, Snap.racers.Length)
                .OrderBy(i => System.Array.IndexOf(order, i) is int k && k >= 0 ? k : 99)
                .ThenByDescending(i => Snap.racers[i].best).ToList();
            return ranked.IndexOf(seat) + 1;
        }

        public void Dispose() { CourseClock.Room = null; }
    }
}
