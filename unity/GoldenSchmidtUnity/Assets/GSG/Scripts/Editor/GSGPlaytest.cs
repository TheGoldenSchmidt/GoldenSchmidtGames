using System.Collections;
using System.Text;
using GSG.Parcours;
using UnityEngine;

namespace GSG.EditorTools
{
    /// <summary>
    /// Editor-only play-mode checks of the parcours mechanics: teleports the runner to a station,
    /// drives the stick and buttons through <see cref="Hud.Simulate"/> and records what happened.
    /// Start with GSGPlaytest.Start("all"); read <see cref="Report"/> when <see cref="Done"/>.
    /// </summary>
    public class GSGPlaytest
    {
        public static readonly StringBuilder Report = new();
        public static bool Done;

        ParcoursGame game;
        ParcoursRunner runner;
        Hud hud;

        public static void Start(string which)
        {
            Report.Clear(); Done = false;
            var t = new GSGPlaytest();
            Object.FindAnyObjectByType<ParcoursGame>().StartCoroutine(t.Run(which));
        }

        void Log(string s) { Report.AppendLine(s); Debug.Log("[PT] " + s); }

        void Go(Vector3 at)
        {
            runner.Respawn(at, 0f);
            hud.Simulate(Vector2.zero);
        }

        Vector3 Cp(int i) => game.checkpoints[i].transform.position;

        IEnumerator Run(string which)
        {
            game = Object.FindAnyObjectByType<ParcoursGame>();
            runner = Object.FindAnyObjectByType<ParcoursRunner>();
            hud = Hud.Instance;
            if (game.state == ParcoursGame.State.Title)
                typeof(ParcoursGame).GetMethod("Begin", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance).Invoke(game, null);
            yield return new WaitForSeconds(0.3f);
            bool all = which == "all";

            if (all || which == "run")
            {
                Go(Cp(0)); yield return new WaitForSeconds(0.3f);
                hud.Simulate(new Vector2(0f, 1f));
                yield return new WaitForSeconds(0.8f);
                Log($"run: speed {new Vector3(runner.Velocity.x, 0, runner.Velocity.z).magnitude:0.00} m/s (Soll 6,4) pose {runner.pose}");
            }
            if (all || which == "gap")
            {
                Go(Cp(0)); yield return new WaitForSeconds(0.3f);
                hud.Simulate(new Vector2(0f, 1f));
                float maxY = 0f;
                while (runner.transform.position.z < 11.2f) { maxY = Mathf.Max(maxY, runner.transform.position.y); yield return null; }
                Log($"stairs: y on top {runner.transform.position.y:0.00} (Soll 1,2)");
                hud.Simulate(new Vector2(0f, 1f), "a");
                yield return new WaitForSeconds(1.4f);
                var p = runner.transform.position;
                Log($"gap: after jump z {p.z:0.0} y {p.y:0.00} pose {runner.pose} (Soll z>14,4 y≈1,2)");
            }
            if (all || which == "doors")
            {
                int broke = 0, shut = 0;
                for (int i = 0; i < 5; i++)
                {
                    float x = -4f + i * 2f;
                    Go(new Vector3(x, 0.05f, 24.5f)); yield return new WaitForSeconds(0.2f);
                    hud.Simulate(new Vector2(0f, 1f));
                    yield return new WaitForSeconds(0.9f);
                    if (runner.transform.position.z > 27.6f) broke++; else shut++;
                }
                Log($"doors: {broke} broken, {shut} shut (Soll 2/3)");
            }
            if (all || which == "bars")
            {
                Go(new Vector3(2.4f, 0.05f, 49.5f));
                bool hit = false;
                for (float t = 0; t < 4.5f && !hit; t += Time.deltaTime) { hit = runner.pose == ParcoursRunner.Pose.Stun; yield return null; }
                Log($"low bar hits a standing runner: {hit}");
                Go(new Vector3(2.4f, 0.05f, 54.5f)); hud.Simulate(Vector2.zero, null, "duck");
                bool hitDuck = false;
                for (float t = 0; t < 6f && !hitDuck; t += Time.deltaTime) { hitDuck |= runner.pose == ParcoursRunner.Pose.Stun; yield return null; }
                Log($"high bar while ducking: hit {hitDuck} (Soll false)");
                Go(new Vector3(2.4f, 0.05f, 54.5f));
                bool hitStand = false;
                for (float t = 0; t < 6f && !hitStand; t += Time.deltaTime) { hitStand |= runner.pose == ParcoursRunner.Pose.Stun; yield return null; }
                Log($"high bar while standing: hit {hitStand} (Soll true)");
            }
            if (all || which == "island")
            {
                var island = GameObject.Find("Fahrinsel");
                Go(island.transform.position + Vector3.up * 0.1f);
                float x0 = runner.transform.position.x;
                yield return new WaitForSeconds(1.2f);
                var p = runner.transform.position;
                Log($"island: carried dx {p.x - x0:0.00}, y {p.y:0.00}, pose {runner.pose} (Soll mitgetragen, y≈0)");
            }
            if (all || which == "seesaw")
            {
                var plank = GameObject.Find("Wippe");
                Go(new Vector3(2f, 0.1f, plank.transform.position.z));
                yield return new WaitForSeconds(1.2f);
                var z = plank.transform.eulerAngles.z; if (z > 180f) z -= 360f;
                Log($"seesaw tilt with runner at x=+2: {z:0.0}° (Soll deutlich ≠ 0) runner y {runner.transform.position.y:0.00}");
            }
            if (all || which == "belt")
            {
                Go(new Vector3(-4f, 0.05f, 104f));
                float z0 = runner.transform.position.z;
                yield return new WaitForSeconds(1f);
                Log($"belt: dz in 1 s {runner.transform.position.z - z0:0.00} (Soll ≈ -3,4)");
            }
            if (all || which == "ledge")
            {
                Go(Cp(7) + Vector3.forward * 0.5f);
                hud.Simulate(new Vector2(0f, 1f), null, "grab");
                yield return new WaitForSeconds(2.2f);
                Log($"ledge: y {runner.transform.position.y:0.00} z {runner.transform.position.z:0.0} pose {runner.pose} (Soll y≈1,85)");
            }
            if (all || which == "ghost")
            {
                var path = Object.FindAnyObjectByType<GhostPath>();
                int ok = 0, fell = 0;
                for (int c = 0; c < 4; c++)
                {
                    var tile = path.tiles[c];
                    Go(tile.transform.position + Vector3.up * 0.3f);
                    float minY = 9f;
                    for (float t = 0; t < 1.2f; t += Time.deltaTime) { minY = Mathf.Min(minY, runner.transform.position.y); yield return null; }
                    if (minY > 1.5f) ok++; else fell++;
                }
                Log($"ghost row 1: {ok} carried, {fell} gave way (Soll 1/3)");
            }
            if (all || which == "trap")
            {
                Go(new Vector3(0f, 1.9f, 135.15f));
                int falls = Falls();
                float minY = 9f;
                var trace = new StringBuilder();
                for (float t = 0; t < 4.8f; t += 0.4f)
                {
                    yield return new WaitForSeconds(0.4f);
                    minY = Mathf.Min(minY, runner.transform.position.y);
                    trace.Append($" {runner.transform.position.y:0.0}/{runner.pose}");
                }
                Log($"trapdoor: falls {Falls() - falls}, min y {minY:0.00} (Soll Sturz) trace{trace}");
            }
            if (all || which == "wind")
            {
                Go(new Vector3(0f, 1.9f, 148f));
                float x0 = runner.transform.position.x, maxDx = 0f;
                for (float t = 0; t < 3f; t += Time.deltaTime) { maxDx = Mathf.Max(maxDx, Mathf.Abs(runner.transform.position.x - x0)); yield return null; }
                Log($"wind: max sideways drift {maxDx:0.00} m in 3 s (Soll > 1)");
            }
            if (all || which == "holds")
            {
                // Hold every block solid: this checks the climbing itself, not the timing.
                foreach (var b in Object.FindObjectsByType<Blinker>()) if (b.kind == Blinker.Kind.Hold) b.open = 0f;
                Go(Cp(11) + Vector3.forward * 1.2f);
                hud.Simulate(new Vector2(0f, 1f), null, "grab");
                float best = 0f;
                var trace = new StringBuilder();
                for (float t = 0; t < 9f; t += 0.5f)
                {
                    yield return new WaitForSeconds(0.5f);
                    var p = runner.transform.position;
                    best = Mathf.Max(best, p.y);
                    trace.Append($" [{p.y:0.0},{p.z:0.0},{runner.pose}]");
                }
                Log($"holds: highest y {best:0.00} (Stufen 3,55 / 5,25 / 6,95) trace{trace}");
            }
            if (all || which == "goo")
            {
                Go(new Vector3(-2f, 7f, 177.2f));
                int falls = Falls();
                yield return new WaitForSeconds(7.5f);
                Log($"goo: respawns {Falls() - falls} on a stone within one tide (Soll ≥ 1)");
            }
            if (all || which == "lanes")
            {
                int through = 0;
                for (int i = 0; i < 4; i++)
                {
                    float x = -6f + 3f * (i + 0.5f);
                    Go(new Vector3(x, 7f, 191.5f)); yield return new WaitForSeconds(0.2f);
                    hud.Simulate(new Vector2(0f, 1f));
                    yield return new WaitForSeconds(2f);
                    if (runner.transform.position.z > 198.3f && runner.transform.position.y > 6.5f) through++;
                }
                Log($"lanes: {through} of 4 lead through (Soll 1)");
            }
            if (all || which == "finish")
            {
                Go(new Vector3(0f, 7.9f, 207f));
                hud.Simulate(new Vector2(0f, 1f));
                yield return new WaitForSeconds(1f);
                Log($"finish: state {game.state} (Soll Ended)");
            }
            hud.Simulate(null);
            Done = true;
        }

        int Falls() => (int)typeof(ParcoursGame).GetField("falls", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance).GetValue(game);
    }
}
