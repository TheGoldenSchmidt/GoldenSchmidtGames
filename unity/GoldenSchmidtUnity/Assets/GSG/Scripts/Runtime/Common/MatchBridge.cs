using System;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace GSG
{
    [Serializable] public class OnlinePlayer { public string id, name, figure; public int slot; }
    [Serializable] public class OnlineSetup { public string type, game, view, viewer; public bool reduced; public OnlinePlayer[] players; }
    [Serializable] class OnlineEnvelope { public string type; }
    [Serializable] class OnlineAim { public float x, y; }
    [Serializable] class OnlineTurn { public float delta; }
    [Serializable] class OnlineReady { public string type = "ready"; }
    [Serializable] class OnlineError { public string type = "error"; public string text; }
    [Serializable] class OnlineCam { public string type = "cam"; public float yaw; }

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
                    // The app plays the sounds of the match.
                    Sfx.SfxOn = Sfx.MusicOn = false;
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
            if (instance && instance.pending != null) { var json = instance.pending; instance.pending = null; match.OnSnapshot(json); }
        }

        /// <summary>Heading of the chase camera (0 = up on the overview), so the app keeps the stick relative to it.</summary>
        public static void Camera(float yaw) => GSG_Post(JsonUtility.ToJson(new OnlineCam { yaw = yaw }));
    }
}
