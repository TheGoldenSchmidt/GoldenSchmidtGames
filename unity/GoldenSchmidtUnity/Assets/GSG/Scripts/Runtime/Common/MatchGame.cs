using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UIElements;

namespace GSG
{
    /// <summary>One place at the table: the phone's player (slot 0) or a bot, with figure and name.</summary>
    public class Seat
    {
        public int slot;
        public string figureId, name;
        public bool isPlayer;
        public Color Color => Palette.Player(slot);

        /// <summary>The player with the figure chosen in the app plus bots with the other base humans.</summary>
        public static List<Seat> Roster(int count)
        {
            var ids = new List<string>(Figure.BaseIds);
            string own = System.Array.IndexOf(Figure.BaseIds, AppLink.Figure) >= 0 ? AppLink.Figure : Figure.BaseIds[0];
            ids.Remove(own);
            var seats = new List<Seat>();
            for (int i = 0; i < count; i++)
            {
                string id = i == 0 ? own : ids[(i - 1) % ids.Count];
                seats.Add(new Seat { slot = i, isPlayer = i == 0, figureId = id, name = i == 0 ? "Du" : char.ToUpperInvariant(id[4]) + id.Substring(5) });
            }
            return seats;
        }
    }

    /// <summary>
    /// Shell shared by the Unity match games (port of the app's match flow for one phone against
    /// bots): title over the running scene, 3-2-1 countdown, pause menu (Weiter, Neu starten,
    /// Geräusche, Musik), the player strip at the top and the result table with "Nochmal".
    /// A game builds its world in <see cref="Setup"/> and drives the rules while <see cref="Playing"/>.
    /// </summary>
    public abstract class MatchGame : MonoBehaviour
    {
        public enum Phase { Title, Countdown, Play, Paused, Ended }
        public Phase phase = Phase.Title;
        Phase before;
        protected Hud hud;
        protected CameraRig rig;
        protected Transform focus;
        protected VisualElement panel, timerFill;
        protected List<Seat> seats;
        protected float playStart;

        protected abstract string GameName { get; }
        /// <summary>Rules in two or three sentences for the title panel.</summary>
        protected abstract string Intro { get; }
        protected virtual string Kicker => "Unity-Test · Du gegen 3 Bots";
        protected virtual int PlayerCount => 4;
        protected bool Playing => phase == Phase.Play;
        protected float PlayTime => phase == Phase.Play || phase == Phase.Paused || phase == Phase.Ended ? Time.time - playStart : 0f;

        protected virtual void Start()
        {
            AppLink.Apply();
            Sfx.Ensure();
            Fx.Ensure();
            seats = Seat.Roster(PlayerCount);
            hud = Hud.Create();
            hud.AddRoundButton("pause", Hud.Icon.Pause, Pause);
            Setup();
            timerFill = hud.Bar();
            ShowTitle();
        }

        /// <summary>Builds the world, figures, HUD actions and camera.</summary>
        protected abstract void Setup();
        /// <summary>Resets the match state right before the countdown.</summary>
        protected abstract void OnBegin();
        /// <summary>The result rows, best first: seat, value text.</summary>
        protected abstract List<(Seat seat, string value)> Ranking();
        protected virtual string ResultText => "";
        protected virtual bool SamePlace(Seat a, Seat b) => false;

        void ShowTitle()
        {
            phase = Phase.Title;
            hud.SetControlsVisible(false);
            hud.SetTopVisible(false);
            panel = hud.Panel(Kicker, GameName, Intro, new List<(string, Hud.Tone, System.Action)> { ("Los geht's", Hud.Tone.Gold, Begin) }, true);
        }

        void Begin()
        {
            hud.Close(panel); panel = null;
            Sfx.Instance.StartLoops();
            hud.SetTopVisible(true);
            OnBegin();
            StartCoroutine(Countdown());
        }

        IEnumerator Countdown()
        {
            phase = Phase.Countdown;
            hud.SetControlsVisible(true);
            foreach (var n in new[] { "3", "2", "1" })
            {
                hud.Toast(n, Palette.Paper, 0.45f);
                Sfx.Play("tick");
                yield return new WaitForSeconds(0.8f);
            }
            hud.Toast("Los!", Palette.Accent, 0.5f);
            Sfx.Play("sting");
            phase = Phase.Play;
            playStart = Time.time;
            OnPlay();
        }

        protected virtual void OnPlay() { }

        /// <summary>Ends the match and shows the result table.</summary>
        protected void Finish()
        {
            if (phase == Phase.Ended) return;
            phase = Phase.Ended;
            hud.SetControlsVisible(false);
            hud.ReleaseAll();
            var order = Ranking();
            var own = order.Find(r => r.seat.isPlayer).seat;
            int place = order.FindIndex(r => r.seat == own || SamePlace(r.seat, own)) + 1;
            bool tied = order.Exists(r => r.seat != own && SamePlace(r.seat, own));
            Sfx.Play(place == 1 ? "fanfare" : "sting");
            if (place == 1 && focus) Fx.Confetti(focus.position + Vector3.up * 2f, 60);
            string heading = tied ? $"Geteilter {place}. Platz" : place == 1 ? "Du hast gewonnen!" : $"Platz {place}";
            panel = hud.Panel("Ergebnis", heading, ResultText,
                new List<(string, Hud.Tone, System.Action)> { ("Nochmal spielen", Hud.Tone.Gold, Restart) });
            foreach (var (seat, value) in order) hud.AddRow(panel, seat.Color, seat.name, value);
        }

        protected void Pause()
        {
            if (phase != Phase.Play && phase != Phase.Countdown) return;
            before = phase; phase = Phase.Paused;
            Time.timeScale = 0f; Fx.Paused = true;
            hud.ReleaseAll();
            hud.SetControlsVisible(false);
            BuildPause();
        }

        void BuildPause()
        {
            panel = hud.Panel("Pause", "Kurz durchatmen", GameName,
                new List<(string, Hud.Tone, System.Action)>
                {
                    ("Weiter", Hud.Tone.Gold, Resume),
                    ("Neu starten", Hud.Tone.Stone, Restart),
                    (Sfx.SfxOn ? "Geräusche aus" : "Geräusche an", Hud.Tone.Stone, () => { Sfx.SfxOn = !Sfx.SfxOn; Sfx.Instance.ApplyGain(); hud.Close(panel); BuildPause(); }),
                    (Sfx.MusicOn ? "Musik aus" : "Musik an", Hud.Tone.Stone, () => { Sfx.MusicOn = !Sfx.MusicOn; Sfx.Instance.ApplyGain(); hud.Close(panel); BuildPause(); })
                });
        }

        void Resume()
        {
            hud.Close(panel); panel = null;
            Time.timeScale = 1f; Fx.Paused = false;
            phase = before;
            hud.SetControlsVisible(ControlsVisible);
        }

        /// <summary>Whether the player's controls show (false while the own figure is out).</summary>
        protected virtual bool ControlsVisible => true;

        protected void Restart()
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

        void OnApplicationFocus(bool focused)
        {
            if (!focused && (phase == Phase.Play || phase == Phase.Countdown)) Pause();
        }

        /// <summary>Remaining share of a time limit for the bar at the top (1 = full).</summary>
        protected void SetTimer(float remaining01) => timerFill.style.width = Length.Percent(Mathf.Clamp01(remaining01) * 100f);

        /// <summary>One chip per seat in the strip under the top row (colour, name, status).</summary>
        protected void Strip(Seat seat, string text, bool active = false, bool dim = false) =>
            hud.SetPlayer("seat" + seat.slot, seat.Color, $"{seat.name} {text}", active, dim);

        protected Figure SpawnFigure(Seat seat, Transform parent, float scale)
        {
            var f = Figure.Spawn(seat.figureId, seat.slot, parent);
            f.transform.localScale = Vector3.one * scale;
            return f;
        }
    }
}
