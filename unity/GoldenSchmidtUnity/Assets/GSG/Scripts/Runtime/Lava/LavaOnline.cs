using System;

namespace GSG.Lava
{
    // Floor is Lava in a room (pilot). Mirrors shared/matches/lavaSnap.ts and lavaHost.ts as flat
    // data for JsonUtility: positions in tiles (x 0–9, y 0–13), `floor` 0 = top, `h` height above
    // that floor in floors. The same snapshot is drawn by every scene in "view" role (Variant A from
    // the room's rules, Variant B from the host's reports) and written by the simulating host.

    [Serializable]
    public class LavaSnapRunner
    {
        public string id, act = "";
        public float x, y, h, vx, vy, fx, fy, points, gain, jump, shove, dive;
        public int floor;
        public bool alive, air, won;
    }

    [Serializable]
    public class LavaSnap
    {
        public string type = "snap", phase = "play", tiles, regen, tiebreakWinner = "";
        public float time, roundTime;
        public int round, rings;
        public bool tiebreak, done;
        public LavaSnapRunner[] runners;
    }

    /// <summary>"hostsnap" / "hostdone" from the simulating host to its app.</summary>
    [Serializable] public class LavaHostMessage { public string type; public LavaSnap snap; }

    /// <summary>The own input of this device (field direction and cumulative tap counters).</summary>
    [Serializable] public class LavaOwnInput { public float x, y; public int ca, cb, cn; }

    [Serializable] public class LavaPlayerInput { public string id; public float x, y; public int ca, cb, cn; public bool gone; }

    /// <summary>Everyone's inputs as the room holds them (only the simulating host gets them).</summary>
    [Serializable] public class LavaInputs { public float time; public LavaPlayerInput[] players; }
}
