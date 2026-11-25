using System;

namespace GSG.RollItUp
{
    // Mirrors of src/unityRollItUp.ts (flat data for JsonUtility). The rules stay in shared/party.ts;
    // these classes only carry what the board needs to draw and which decisions are open.

    [Serializable] public class RollEnvelope { public string type; }

    [Serializable]
    public class RollField
    {
        public int id; public float x, z; public string type; public int[] next; public string station, name, help; public int price;
    }

    /// <summary>`board` picks the scenery (bauschale, grinder); `tunnels` lists each pneumatic tube once as a flat pair.</summary>
    [Serializable] public class RollBoardMessage { public string type, board, name; public int[] tunnels; public RollField[] fields; }

    [Serializable]
    public class RollPlayer
    {
        public string id, name, characterId; public int slot, position, coins; public int[] supplies; public string[] items;
        public bool bot, shield, active, me;
    }

    [Serializable] public class RollPath { public int field; public string title, detail; public int[] route; }

    [Serializable]
    public class RollItem { public string id, name, icon, description; public int price; public bool affordable; }

    [Serializable]
    public class RollState
    {
        public string type;
        public double serverNow; public string phase; public int phaseId, round, turn;
        public string viewer, active; public bool canAct, busy, connected; public string error; public double deadline;
        public int[] dice; public string diceKey; public int boost, steps; public bool itemUsed;
        public bool moving; public int moveFrom, moveTo; public double departAt, arriveAt;
        public RollPlayer[] players; public string[] order;
        public string headline, status;
        public RollPath[] paths;
        public string supplyName; public int supplyPrice; public bool supplyAffordable;
        public RollItem[] shop; public string gift, giftName, giftDescription; public bool needsReplace; public string[] ownItems;
        public string summary, summaryType;
        public int objectiveField; public string objectiveText; public int[] route;
        public string[] log; public bool reduced;

        public RollPlayer Player(string id)
        {
            if (players == null) return null;
            foreach (var p in players) if (p.id == id) return p;
            return null;
        }

        public RollPlayer Me => Player(viewer);
        public RollPlayer Active => Player(active);
    }

    [Serializable] public class RollVisible { public string type; public bool on; }

    /// <summary>A board decision sent back to the app (checked there before it reaches the room).</summary>
    [Serializable]
    public class RollAction
    {
        public string type; public int destination; public bool buy; public string item = ""; public bool accept; public int replace;
    }

    [Serializable] public class RollActionMessage { public string type = "action"; public RollAction action; }
    [Serializable] public class RollPanelMessage { public string type = "panel"; public string panel; }
    [Serializable] public class RollReadyMessage { public string type = "ready"; }
}
