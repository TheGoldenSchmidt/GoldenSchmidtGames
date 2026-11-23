using System.Runtime.InteropServices;
using UnityEngine;

namespace GSG.RollItUp
{
    /// <summary>
    /// The GameObject "Bridge": receives the app's messages (board, state, visibility) and sends
    /// board decisions and panel requests back to the parent window (WebGL only; in the Editor the
    /// demo data of <see cref="RollGame"/> stands in).
    /// </summary>
    public class RollBridge : MonoBehaviour
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] static extern void GSG_BridgeStart();
        [DllImport("__Internal")] static extern void GSG_Post(string json);
#else
        static void GSG_BridgeStart() { }
        static void GSG_Post(string json) { Debug.Log("[GSG] → App: " + json); }
#endif

        public RollGame game;
        public static bool Connected { get; private set; }
        static RollBridge instance;

        void Awake() { name = "Bridge"; instance = this; }

        void Start()
        {
            GSG_BridgeStart();
            Post(JsonUtility.ToJson(new RollReadyMessage()));
        }

        /// <summary>Called from JavaScript with one JSON message.</summary>
        public void OnMessage(string json)
        {
            var envelope = JsonUtility.FromJson<RollEnvelope>(json);
            if (envelope == null || game == null) return;
            Connected = true;
            switch (envelope.type)
            {
                case "board": game.OnBoard(JsonUtility.FromJson<RollBoardMessage>(json)); break;
                case "state": game.OnState(JsonUtility.FromJson<RollState>(json)); break;
                case "visible": game.OnVisible(JsonUtility.FromJson<RollVisible>(json).on); break;
            }
        }

        public static void Post(string json) => GSG_Post(json);
        public static void Send(RollAction action)
        {
            if (instance && instance.game && instance.game.IsDemo) { instance.game.DemoAdvance(); return; }
            Post(JsonUtility.ToJson(new RollActionMessage { action = action }));
        }
        public static void Panel(string panel) => Post(JsonUtility.ToJson(new RollPanelMessage { panel = panel }));
    }
}
