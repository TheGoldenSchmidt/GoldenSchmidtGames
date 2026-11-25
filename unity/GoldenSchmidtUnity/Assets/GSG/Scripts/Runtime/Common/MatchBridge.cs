using System;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace GSG
{
    [Serializable] public class OnlinePlayer { public string id, name, figure; public int slot; }
    [Serializable] public class OnlineSetup { public string type, game, view, viewer; public bool reduced, sound; public int startIn; public OnlinePlayer[] players; }
    [Serializable] class OnlineEnvelope { public string type; }
    [Serializable] class OnlineAim { public float x, y; }
    [Serializable] class OnlineTurn { public float delta; }
    [Serializable] class OnlineReady { public string type = "ready"; }
    [Serializable] class OnlineError { public string type = "error"; public string text; }
    [Serializable] class OnlineCam { public string type = "cam"; public float yaw; }
    [Serializable] class OnlinePlaying { public string type = "playing"; }
    [Serializable] class OnlineSound { public bool on; }
    [Serializable] class OnlineInput { public string type = "input"; public float x, y, ax, ay; public bool ha, hb; }
    [Serializable] class OnlinePress { public string type = "press"; public string kind; }

    /// <summary>A game scene that draws the room's match (<c>?spiel=online</c>).</summary>
    public interface IOnlineMatch
    {
        void OnSnapshot(string json);
        /// <summary>Own aim as a field direction (x right, y down), zero when not aiming.</summary>
        void OnAim(Vector2 aim);
        /// <summary>Camera turn by hand (radians) from the app's swipe area.</summary>
        void OnTurn(float delta);
    }

    /// <summary>
    /// The GameObject "Bridge" for Unity as the rendering of a room's match: the app's room authority
    /// computes with the rules from shared/, Unity draws its snapshots. "setup" loads the game scene,
    /// "snap" carries the newest snapshot, "aim"/"turn" the own aim and camera turns, "idle" parks the
    /// hidden build between rounds. Back to the app: "ready" once, "cam" with the chase camera heading.
    /// </summary>
    public class MatchBridge : MonoBehaviour
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] static extern void GSG_BridgeStart();
        [DllImport("__Internal")] static extern void GSG_Post(string json);
#else
        static void GSG_BridgeStart() { }
        static void GSG_Post(string json) { if (Hud.DebugInput) Debug.Log("[GSG] → App: " + json); }
#endif

        public static OnlineSetup Setup { get; private set; }
        public static bool Online => Setup != null;
        static IOnlineMatch game;
        static MatchBridge instance;
        string pending;
        static readonly OnlineInput lastInput = new();
        static float lastInputAt = -1f;

        public static void Create()
        {
            if (instance) return;
            var go = new GameObject("Bridge");
            instance = go.AddComponent<MatchBridge>();
            DontDestroyOnLoad(go);
        }

        void Start()
        {
            Application.targetFrameRate = 30;
            GSG_BridgeStart();
            GSG_Post(JsonUtility.ToJson(new OnlineReady()));
        }

        /// <summary>Called from JavaScript with one JSON message.</summary>
        public void OnMessage(string json)
        {
            switch (JsonUtility.FromJson<OnlineEnvelope>(json)?.type)
            {
                case "setup":
                    var setup = JsonUtility.FromJson<OnlineSetup>(json);
                    if (setup?.players == null || setup.players.Length == 0 || !GameSwitch.Scenes.TryGetValue(setup.game ?? "", out var scene) || !Application.CanStreamedLevelBeLoaded(scene))
                    {
                        GSG_Post(JsonUtility.ToJson(new OnlineError { text = "Unbekanntes Spiel: " + setup?.game }));
                        return;
                    }
                    Setup = setup;
                    game = null;
                    pending = null;
                    Fx.Reduced = setup.reduced || AppLink.ReducedMotion;
                    // Unity plays the match sounds (the app stays quiet); no music, like the app's matches.
                    Sfx.SfxOn = setup.sound;
                    Sfx.MusicOn = false;
                    Application.targetFrameRate = 60;
                    SceneManager.LoadScene(scene);
                    break;
                case "snap":
                    if (game != null) game.OnSnapshot(json); else pending = json;
                    break;
                case "aim":
                    var aim = JsonUtility.FromJson<OnlineAim>(json);
                    game?.OnAim(new Vector2(aim.x, aim.y));
                    break;
                case "turn":
                    game?.OnTurn(JsonUtility.FromJson<OnlineTurn>(json).delta);
                    break;
                case "sound":
                    Sfx.SfxOn = JsonUtility.FromJson<OnlineSound>(json).on;
                    if (Sfx.Instance) Sfx.Instance.ApplyGain();
                    break;
                case "idle":
                    game = null;
                    pending = null;
                    Application.targetFrameRate = 4;
                    break;
            }
        }

        /// <summary>A game scene is ready: it gets the newest snapshot that arrived while it loaded.</summary>
        public static void Register(IOnlineMatch match)
        {
            game = match;
            lastInputAt = -1f;
            // From now on Unity's own HUD takes the touches; the app hides its controls.
            GSG_Post(JsonUtility.ToJson(new OnlinePlaying()));
            if (instance && instance.pending != null) { var json = instance.pending; instance.pending = null; match.OnSnapshot(json); }
        }

        /// <summary>
        /// Held input for the room (field directions: x right, y down; aim zero when not aiming). Sent on change,
        /// at most every 33 ms; the app repeats it every 100 ms so the authority keeps it alive.
        /// </summary>
        public static void Input(float x, float y, float ax, float ay, bool ha = false, bool hb = false, bool now = false)
        {
            x = Mathf.Round(x * 100f) / 100f; y = Mathf.Round(y * 100f) / 100f;
            ax = Mathf.Round(ax * 100f) / 100f; ay = Mathf.Round(ay * 100f) / 100f;
            bool same = lastInput.x == x && lastInput.y == y && lastInput.ax == ax && lastInput.ay == ay && lastInput.ha == ha && lastInput.hb == hb;
            if (same || (!now && Time.unscaledTime - lastInputAt < 0.033f)) return;
            lastInput.x = x; lastInput.y = y; lastInput.ax = ax; lastInput.ay = ay; lastInput.ha = ha; lastInput.hb = hb;
            lastInputAt = Time.unscaledTime;
            GSG_Post(JsonUtility.ToJson(lastInput));
        }

        /// <summary>A tap of button "a" or "b" at this moment (counted by the room like the app's buttons).</summary>
        public static void Press(string kind) => GSG_Post(JsonUtility.ToJson(new OnlinePress { kind = kind }));

        /// <summary>Heading of the chase camera (0 = up on the overview), so the app keeps the stick relative to it.</summary>
        public static void Camera(float yaw) => GSG_Post(JsonUtility.ToJson(new OnlineCam { yaw = yaw }));
    }
}
