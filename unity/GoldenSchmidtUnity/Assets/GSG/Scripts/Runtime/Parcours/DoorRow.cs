using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>A wall of doors; at run start <see cref="real"/> of them are drawn to break open.</summary>
    public class DoorRow : MonoBehaviour
    {
        public BreakDoor[] doors;
        public int real = 2;

        void Awake()
        {
            var order = new int[doors.Length];
            for (int i = 0; i < order.Length; i++) order[i] = i;
            for (int i = order.Length - 1; i > 0; i--) { int j = Random.Range(0, i + 1); (order[i], order[j]) = (order[j], order[i]); }
            for (int i = 0; i < doors.Length; i++) doors[order[i]].real = i < real;
        }
    }
}
