using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace GSG
{
    /// <summary>
    /// Start scene of the shared WebGL build: all Unity games live in one build (engine code and
    /// shared assets load once and stay in the browser cache), the app picks the game with
    /// <c>?spiel=&lt;id&gt;</c>. The ids are the app's ids (src/unityGames.ts, Roll It Up!).
    /// </summary>
    public class GameSwitch : MonoBehaviour
    {
        public static readonly Dictionary<string, string> Scenes = new()
        {
            { "parcours", "ParcoursProbe" }, { "lava", "FloorIsLava" }, { "rollitup", "RollItUp" },
            { "sumo", "SumoSmash" }, { "bumpercars", "BumperMayhem" }, { "bombs", "BombArena" },
            { "snowball", "Schneeballschlacht" }, { "tower", "TowerTumble" }, { "towersurvival", "TowerSurvival" },
            { "tuerenlotto", "Tuerenlotto" }, { "kreiselkurs", "Kreiselkurs" },
            { "standhaft", "Standhaft" }, { "tanks", "TankTrouble" }
        };

        void Start()
        {
            AppLink.Apply();
            var id = AppLink.Param("spiel", "");
            // Rendering of a room's match: wait for the app's setup, which names the game.
            if (id == "online") { MatchBridge.Create(); return; }
            if (Scenes.TryGetValue(id, out var scene) && Application.CanStreamedLevelBeLoaded(scene)) { SceneManager.LoadScene(scene); return; }
            Debug.LogError("[GSG] Unbekanntes Spiel: " + id);
            var hud = Hud.Create();
            hud.SetControlsVisible(false);
            hud.SetTopVisible(false);
            hud.Panel("Unity-Test", "Spiel nicht gefunden", $"„{id}“ gibt es in diesem Build nicht. Bitte die App neu laden.", new List<(string, Hud.Tone, System.Action)>());
        }
    }
}
