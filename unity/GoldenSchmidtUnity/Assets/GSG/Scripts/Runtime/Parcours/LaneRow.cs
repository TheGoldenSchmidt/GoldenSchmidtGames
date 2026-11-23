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
        /// <summary>Lanes that lead on, end at a solid exit, or drop through the floor (parcoursCourses.ts laneRow mix).</summary>
        public int through = 1, dead = 1, trap = 1;

        void Awake()
        {
            int n = fronts.Length;
            var order = new int[n];
            for (int i = 0; i < n; i++) order[i] = i;
            for (int i = n - 1; i > 0; i--) { int j = Random.Range(0, i + 1); (order[i], order[j]) = (order[j], order[i]); }
            for (int k = 0; k < n; k++)
            {
                int lane = order[k];
                // First the lanes that lead on, then dead ends, then trapdoors; the rest stay shut.
                bool isThrough = k < through, isDead = k >= through && k < through + dead, isTrap = k >= through + dead && k < through + dead + trap;
                fronts[lane].real = isThrough || isDead || isTrap;
                exits[lane].real = !isDead;
                floors[lane].carries = !isTrap;
            }
        }
    }
}
