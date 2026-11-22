using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UIElements;

namespace GSG.Parcours
{
    /// <summary>
    /// Shell and rules of the parcours test level: title over the live course, timed run through
    /// fifteen stations with checkpoints, falls return to the last checkpoint, finish moment,
    /// pause menu with restart and sound toggles. State: Title → Playing ⇄ Paused → Ended.
    /// </summary>
    public class ParcoursGame : MonoBehaviour
    {
        public enum State { Title, Playing, Paused, Ended }
        public State state = State.Title;

        [System.Serializable]
        public class Station { public string name; public string hint; }

        public Checkpoint[] checkpoints;
        public Station[] stations;
        public GooTide[] goo;
        public Transform start;

        ParcoursRunner runner;
        CameraRig rig;
        Hud hud;
        Checkpoint current;
        int reached;
        float startedAt, finishedAt;
        int falls;
        bool respawning;
        VisualElement panel;
        const string BestKey = "gsg.parcours.best";

        void Start()
        {
            AppLink.Apply();
            Sfx.Ensure();
            Fx.Ensure();
            Physics.gravity = new Vector3(0f, -20f, 0f);
            System.Array.Sort(checkpoints, (a, b) => a.index.CompareTo(b.index));
            current = checkpoints[0];

            var go = new GameObject("Läufer");
            go.transform.position = start.position;
            runner = go.AddComponent<ParcoursRunner>();
            runner.game = this;
            var holder = new GameObject("Figur").transform;
            holder.SetParent(go.transform, false);
            runner.Attach(Figure.Spawn(AppLink.Figure, 0, holder));
            runner.figure.transform.SetParent(go.transform, true);
            Destroy(holder.gameObject);

            rig = CameraRig.Create(go.transform, 7.4f, 19f, 55f, new Vector3(0f, 1.1f, 0f));
            runner.rig = rig;

            hud = Hud.Create();
            hud.AddRoundButton("pause", Hud.Icon.Pause, Pause);
            hud.AddChip("time", "0:00");
            hud.AddChip("falls", "Stürze 0");
            hud.AddChip("station", "Station 1/" + stations.Length);
            hud.AddAction("grab", Hud.Icon.Grab, "Festhalten", Hud.Tone.Cyan);
            hud.AddAction("duck", Hud.Icon.Duck, "Ducken", Hud.Tone.Cyan);
            hud.AddAction("b", Hud.Icon.Dive, "Hechten", Hud.Tone.Pink);
            hud.AddAction("a", Hud.Icon.Jump, "Springen", Hud.Tone.Gold);
            ShowTitle();
            runner.Respawn(start.position, start.eulerAngles.y);
            runner.Freeze();
        }

        void ShowTitle()
        {
            state = State.Title;
            hud.SetControlsVisible(false);
            hud.SetTopVisible(false);
            float best = PlayerPrefs.GetFloat(BestKey, 0f);
            panel = hud.Panel("Unity-Test · Parcours", "Probelevel", $"{stations.Length} Stationen mit allen Hindernisarten der Parcours: Türen, Schieber, Drehbalken, Wippen, Band, Kante, Geisterpfad, Klappen, Wind, Griffe, Glibber und Türgänge. Kontrollpunkte fangen dich auf." + (best > 0f ? $"\nBestzeit: {Clock(best)}" : ""),
                new List<(string, Hud.Tone, System.Action)> { ("Los geht's", Hud.Tone.Gold, Begin) }, true);
            StartCoroutine(TitleOrbit());
        }

        IEnumerator TitleOrbit()
        {
            while (state == State.Title)
            {
                rig.homeYaw = Mathf.Sin(Time.unscaledTime * 0.25f) * 35f;
                yield return null;
            }
        }

        void Begin()
        {
            hud.Close(panel); panel = null;
            Sfx.Instance.StartLoops();
            state = State.Playing;
            hud.SetControlsVisible(true);
            hud.SetTopVisible(true);
            rig.homeYaw = 0f;
            startedAt = Time.time; falls = 0; reached = 0;
            runner.Release();
            ShowStation(0);
            hud.Toast("Los!", Palette.Accent, 0.6f);
            Sfx.Play("sting");
        }

        void Update()
        {
            if (state == State.Playing)
            {
                hud.SetChip("time", Clock(Time.time - startedAt));
                hud.SetChip("falls", "Stürze " + falls);
            }
        }

        public void Reached(Checkpoint cp)
        {
            if (state != State.Playing || cp.index <= current.index) return;
            current = cp;
            cp.Light();
            Sfx.Play("chime");
            hud.Toast("Kontrollpunkt!", Palette.Accent, 0.7f);
            ShowStation(cp.index);
        }

        void ShowStation(int i)
        {
            if (stations == null || i >= stations.Length) return;
            reached = Mathf.Max(reached, i);
            hud.SetChip("station", $"Station {i + 1}/{stations.Length}");
            hud.ShowHint(stations[i].name, stations[i].hint);
            CancelInvoke(nameof(HideHint));
            Invoke(nameof(HideHint), 9f);
        }

        void HideHint() => hud.ShowHint("", "");

        /// <summary>Called by the runner each step: below the station floor or in the goo means back to the checkpoint.</summary>
        public void CheckFall(ParcoursRunner r)
        {
            if (respawning || state == State.Ended) return;
            var p = r.transform.position;
            if (p.y < current.transform.position.y - 6f) { StartCoroutine(Respawn("Abgestürzt!")); return; }
            foreach (var g in goo)
                if (g && g.Covers(p)) { Sfx.Play("splash"); Fx.Splash(p, Palette.Goo, 20); StartCoroutine(Respawn("Glibber!")); return; }
        }

        IEnumerator Respawn(string reason)
        {
            respawning = true;
            falls++;
            hud.Toast(reason, Palette.Warn, 0.6f);
            Sfx.Play("lose", 0.5f);
            hud.Fade(1f, 0.25f);
            yield return new WaitForSeconds(0.35f);
            var spot = current.transform;
            runner.Respawn(spot.position + Vector3.up * 0.05f, spot.eulerAngles.y);
            rig.Snap(spot.eulerAngles.y);
            hud.Fade(0f, 0.3f);
            yield return new WaitForSeconds(0.2f);
            respawning = false;
        }

        public void Finish(Vector3 at)
        {
            if (state != State.Playing) return;
            state = State.Ended;
            finishedAt = Time.time - startedAt;
            runner.Celebrate();
            hud.SetControlsVisible(false);
            hud.ReleaseAll();
            Sfx.Play("fanfare");
            Fx.Confetti(at + Vector3.up * 0.5f, 60);
            Fx.Shake(0.4f);
            float best = PlayerPrefs.GetFloat(BestKey, 0f);
            bool record = best <= 0f || finishedAt < best;
            if (record) { PlayerPrefs.SetFloat(BestKey, finishedAt); PlayerPrefs.Save(); }
            StartCoroutine(EndPanel(record, best));
        }

        IEnumerator EndPanel(bool record, float best)
        {
            hud.Toast(record ? "Neue Bestzeit!" : "Im Ziel!", Palette.Accent, 1.2f);
            yield return new WaitForSeconds(1.6f);
            panel = hud.Panel("Geschafft", Clock(finishedAt), record ? "Das ist deine neue Bestzeit." : $"Bestzeit bleibt {Clock(best)}.",
                new List<(string, Hud.Tone, System.Action)> { ("Nochmal laufen", Hud.Tone.Gold, Restart) });
            hud.AddRow(panel, Palette.Accent, "Zeit", Clock(finishedAt));
            hud.AddRow(panel, Palette.Warn, "Stürze", falls.ToString());
            hud.AddRow(panel, Palette.Seesaw, "Stationen", $"{stations.Length}/{stations.Length}");
        }

        void Pause()
        {
            if (state != State.Playing) return;
            state = State.Paused;
            Time.timeScale = 0f; Fx.Paused = true;
            hud.ReleaseAll();
            hud.SetControlsVisible(false);
            BuildPause();
        }

        void BuildPause()
        {
            panel = hud.Panel("Pause", "Kurz durchatmen", $"Station {current.index + 1} von {stations.Length} · {Clock(Time.time - startedAt)}",
                new List<(string, Hud.Tone, System.Action)>
                {
                    ("Weiter", Hud.Tone.Gold, Resume),
                    ("Zum letzten Kontrollpunkt", Hud.Tone.Stone, () => { Resume(); StartCoroutine(Respawn("Zurück!")); }),
                    ("Von vorn", Hud.Tone.Stone, Restart),
                    (Sfx.SfxOn ? "Geräusche aus" : "Geräusche an", Hud.Tone.Stone, () => { Sfx.SfxOn = !Sfx.SfxOn; Sfx.Instance.ApplyGain(); hud.Close(panel); BuildPause(); }),
                    (Sfx.MusicOn ? "Musik aus" : "Musik an", Hud.Tone.Stone, () => { Sfx.MusicOn = !Sfx.MusicOn; Sfx.Instance.ApplyGain(); hud.Close(panel); BuildPause(); })
                });
        }

        void Resume()
        {
            hud.Close(panel); panel = null;
            Time.timeScale = 1f; Fx.Paused = false;
            state = State.Playing;
            hud.SetControlsVisible(true);
        }

        void Restart()
        {
            Time.timeScale = 1f; Fx.Paused = false;
            hud.Fade(1f, 0.3f);
            StartCoroutine(Reload());
        }

        IEnumerator Reload()
        {
            yield return new WaitForSecondsRealtime(0.32f);
            SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
        }

        void OnApplicationFocus(bool focus)
        {
            if (!focus && state == State.Playing) Pause();
        }

        static string Clock(float seconds)
        {
            int s = Mathf.FloorToInt(seconds);
            return $"{s / 60}:{s % 60:00}.{Mathf.FloorToInt((seconds - s) * 10f)}";
        }
    }
}
