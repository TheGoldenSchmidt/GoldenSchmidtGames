using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>
    /// Doors with a corridor behind each (as in Türenlotto): one corridor leads on, one ends at a
    /// solid exit door, one drops through a trapdoor, the last front door stays shut.
    /// </summary>
    public class LaneRow : MonoBehaviour
    {
        public BreakDoor[] fronts, exits;
        public GhostTile[] floors;

        void Awake()
        {
            int n = fronts.Length;
            var order = new int[n];
            for (int i = 0; i < n; i++) order[i] = i;
            for (int i = n - 1; i > 0; i--) { int j = Random.Range(0, i + 1); (order[i], order[j]) = (order[j], order[i]); }
            for (int k = 0; k < n; k++)
            {
                int lane = order[k];
                // k = 0 through, 1 dead end, 2 trapdoor, 3+ shut.
                fronts[lane].real = k < 3;
                exits[lane].real = k != 1;
                floors[lane].carries = k != 2;
            }
        }
    }
}
