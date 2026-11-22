using System.Collections.Generic;
using UnityEngine;

namespace GSG
{
    /// <summary>
    /// Synthesized sounds (no audio assets): every action gets an audible answer. A static gain
    /// layer stands in for an AudioMixer (mixer authoring needs the editor UI); the pause menu
    /// toggles <see cref="SfxOn"/> and <see cref="MusicOn"/>.
    /// </summary>
    public class Sfx : MonoBehaviour
    {
        public static Sfx Instance { get; private set; }
        public static bool SfxOn = true, MusicOn = true;
        public static float SfxGain = 0.8f, MusicGain = 0.32f;

        const int Rate = 22050;
        readonly Dictionary<string, AudioClip> clips = new();
        readonly List<AudioSource> voices = new();
        AudioSource music, ambience;
        int next;

        public static Sfx Ensure()
        {
            if (Instance) return Instance;
            var go = new GameObject("Sfx");
            Instance = go.AddComponent<Sfx>();
            return Instance;
        }

        void Awake()
        {
            Instance = this;
            for (int i = 0; i < 10; i++)
            {
                var s = gameObject.AddComponent<AudioSource>();
                s.playOnAwake = false; s.spatialBlend = 0f;
                voices.Add(s);
            }
            Build();
            music = gameObject.AddComponent<AudioSource>();
            music.loop = true; music.playOnAwake = false; music.clip = clips["music"];
            ambience = gameObject.AddComponent<AudioSource>();
            ambience.loop = true; ambience.playOnAwake = false; ambience.clip = clips["crowd"];
        }

        public void StartLoops()
        {
            if (!music.isPlaying) music.Play();
            if (!ambience.isPlaying) ambience.Play();
            ApplyGain();
        }

        public void ApplyGain()
        {
            if (music) music.volume = MusicOn ? MusicGain : 0f;
            if (ambience) ambience.volume = SfxOn ? 0.12f * SfxGain : 0f;
        }

        public static void Play(string name, float volume = 1f, float pitch = 1f)
        {
            var self = Instance;
            if (!self || !SfxOn || !self.clips.TryGetValue(name, out var clip)) return;
            var v = self.voices[self.next++ % self.voices.Count];
            v.pitch = pitch * Random.Range(0.94f, 1.06f);
            v.PlayOneShot(clip, volume * SfxGain);
        }

        // ---- synthesis -------------------------------------------------------------------

        delegate float Wave(float t, float k);

        static AudioClip Make(string name, float seconds, Wave wave, bool loop = false)
        {
            int n = Mathf.CeilToInt(seconds * Rate);
            var data = new float[n];
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)Rate, k = i / (float)n;
                data[i] = Mathf.Clamp(wave(t, k), -1f, 1f);
            }
            if (!loop)
            {
                // 5 ms fades so no clip starts or ends with a click.
                int f = Mathf.Min(n / 2, Rate / 200);
                for (int i = 0; i < f; i++) { float g = i / (float)f; data[i] *= g; data[n - 1 - i] *= g; }
            }
            var clip = AudioClip.Create(name, n, 1, Rate, false);
            clip.SetData(data, 0);
            return clip;
        }

        static float Sine(float phase) => Mathf.Sin(phase * 2f * Mathf.PI);
        static float Square(float phase) => Mathf.Sign(Mathf.Sin(phase * 2f * Mathf.PI)) * 0.6f + Mathf.Sin(phase * 2f * Mathf.PI) * 0.4f;

        void Build()
        {
            var rng = new System.Random(7);
            float Noise() => (float)(rng.NextDouble() * 2.0 - 1.0);
            float lp = 0f;
            float Low(float x, float a) { lp += (x - lp) * a; return lp; }

            // Pitch sweeps integrate frequency into phase.
            AudioClip Sweep(string name, float seconds, float f0, float f1, float vol, bool square = false, float decay = 6f)
            {
                float phase = 0f;
                return Make(name, seconds, (t, k) =>
                {
                    phase += Mathf.Lerp(f0, f1, k) / Rate;
                    float s = square ? Square(phase) : Sine(phase);
                    return s * vol * Mathf.Exp(-decay * k);
                });
            }

            clips["jump"] = Sweep("jump", 0.16f, 320f, 760f, 0.45f, true, 3f);
            clips["land"] = Make("land", 0.12f, (t, k) => (Low(Noise(), 0.12f) * 2.2f + Sine(t * 90f) * 0.4f) * Mathf.Exp(-9f * k));
            clips["dive"] = Make("dive", 0.32f, (t, k) => Low(Noise(), 0.05f + 0.25f * k) * 1.8f * Mathf.Sin(Mathf.PI * k));
            clips["hit"] = Make("hit", 0.26f, (t, k) => (Sine(t * Mathf.Lerp(200f, 70f, k)) * 0.7f + Low(Noise(), 0.3f) * 0.5f) * Mathf.Exp(-7f * k));
            clips["thud"] = Make("thud", 0.18f, (t, k) => (Sine(t * 70f) * 0.8f + Low(Noise(), 0.08f) * 1.4f) * Mathf.Exp(-10f * k));
            clips["break"] = Make("break", 0.45f, (t, k) => (Noise() * (rng.NextDouble() < 0.18 ? 0.9f : 0.25f) + Sine(t * 110f) * 0.5f) * Mathf.Exp(-6f * k));
            clips["crack"] = Make("crack", 0.3f, (t, k) => (rng.NextDouble() < 0.06 ? Noise() * 0.9f : 0f) + Low(Noise(), 0.04f) * 0.6f * (1f - k));
            clips["splash"] = Make("splash", 0.5f, (t, k) => (Low(Noise(), 0.18f) * 1.3f + Sine(t * (140f + 60f * Mathf.Sin(t * 40f))) * 0.3f) * Mathf.Exp(-4f * k));
            clips["sizzle"] = Make("sizzle", 0.7f, (t, k) => Noise() * 0.35f * (1f - k) * (0.6f + 0.4f * Mathf.Sin(t * 60f)));
            clips["click"] = Make("click", 0.03f, (t, k) => Low(Noise(), 0.5f) * 0.8f);
            clips["shove"] = Make("shove", 0.2f, (t, k) => (Low(Noise(), 0.1f) * 1.6f + Sine(t * 120f) * 0.5f) * Mathf.Sin(Mathf.PI * k));
            clips["whoosh"] = Make("whoosh", 0.6f, (t, k) => Low(Noise(), 0.03f + 0.08f * Mathf.Sin(Mathf.PI * k)) * 2f * Mathf.Sin(Mathf.PI * k));
            clips["rumble"] = Make("rumble", 1.2f, (t, k) => (Low(Noise(), 0.02f) * 3f + Sine(t * 42f) * 0.4f) * Mathf.Sin(Mathf.PI * k));
            clips["tick"] = Sweep("tick", 0.06f, 1500f, 1200f, 0.3f, false, 8f);
            clips["warn"] = Make("warn", 0.24f, (t, k) => Square(t * 880f) * 0.25f * (k < 0.45f || k > 0.55f ? 1f : 0f) * (1f - k));
            clips["blip"] = Sweep("blip", 0.09f, 880f, 1320f, 0.4f, false, 5f);
            clips["chime"] = Make("chime", 0.6f, (t, k) => (Sine(t * 660f) * (k < 0.4f ? 1f : 0.3f) + Sine(t * 990f) * (k > 0.18f ? 0.8f : 0f)) * 0.35f * Mathf.Exp(-3f * k));
            clips["sting"] = Make("sting", 0.48f, (t, k) =>
            {
                float f = k < 0.33f ? 523.25f : k < 0.66f ? 659.25f : 783.99f;
                return Square(t * f) * 0.28f * Mathf.Exp(-2f * ((k * 3f) % 1f));
            });
            clips["fanfare"] = Make("fanfare", 1.4f, (t, k) =>
            {
                float[] notes = { 523.25f, 659.25f, 783.99f, 1046.5f };
                int i = Mathf.Min(3, Mathf.FloorToInt(t / 0.16f));
                float f = notes[i], env = i < 3 ? Mathf.Exp(-6f * ((t / 0.16f) % 1f)) : Mathf.Exp(-1.6f * (t - 0.48f));
                return (Square(t * f) * 0.22f + Sine(t * f * 0.5f) * 0.2f) * env;
            });
            clips["lose"] = Sweep("lose", 0.7f, 420f, 140f, 0.35f, true, 2f);

            // Crowd/room tone: low-passed noise with a slow swell (looped ambience bed).
            float b = 0f;
            clips["crowd"] = Make("crowd", 6f, (t, k) =>
            {
                b = Mathf.Clamp(b + Noise() * 0.04f, -1f, 1f) * 0.995f;
                float swell = 0.7f + 0.3f * Mathf.Sin(t * Mathf.PI * 2f / 6f);
                return Low(b + Noise() * 0.15f, 0.15f) * 0.9f * swell;
            }, true);

            // Bouncy gameshow loop: 8 bars at 128 bpm, bass, offbeat chords and a plucked arpeggio.
            const float bpm = 128f, beat = 60f / bpm;
            int[] roots = { 0, 0, 5, 5, 7, 7, 3, 7 };
            int[] arp = { 0, 4, 7, 12, 7, 4, 7, 4 };
            float Note(int semis) => 261.63f * Mathf.Pow(2f, semis / 12f);
            clips["music"] = Make("music", beat * 32f, (t, k) =>
            {
                int beatIndex = Mathf.FloorToInt(t / beat), bar = (beatIndex / 4) % 8;
                float inBeat = (t % beat) / beat, eighth = (t % (beat * 0.5f)) / (beat * 0.5f);
                int r = roots[bar];
                float bass = Square(t * Note(r - 24)) * 0.32f * Mathf.Exp(-3f * inBeat);
                float chord = (beatIndex % 2 == 1 && inBeat > 0.5f)
                    ? (Sine(t * Note(r)) + Sine(t * Note(r + 4)) + Sine(t * Note(r + 7))) * 0.07f * Mathf.Exp(-6f * (inBeat - 0.5f))
                    : 0f;
                int step = Mathf.FloorToInt(t / (beat * 0.5f)) % 8;
                float pluck = Sine(t * Note(r + 12 + arp[step])) * 0.13f * Mathf.Exp(-7f * eighth);
                float kick = inBeat < 0.25f ? Sine(t * Mathf.Lerp(120f, 45f, inBeat * 4f)) * 0.35f * (1f - inBeat * 4f) : 0f;
                float hat = eighth < 0.08f ? Noise() * 0.06f : 0f;
                return bass + chord + pluck + kick + hat;
            }, true);
        }
    }
}
