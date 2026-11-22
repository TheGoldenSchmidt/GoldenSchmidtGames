using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>Rows of identical tiles over the void; at run start one connected path is drawn that carries.</summary>
    public class GhostPath : MonoBehaviour
    {
        public int columns = 4;
        public GhostTile[] tiles; // row after row

        void Awake()
        {
            int rows = tiles.Length / columns, col = Random.Range(0, columns);
            foreach (var t in tiles) t.carries = false;
            for (int r = 0; r < rows; r++)
            {
                tiles[r * columns + col].carries = true;
                // The next row continues straight or one step to the side.
                col = Mathf.Clamp(col + Random.Range(-1, 2), 0, columns - 1);
            }
        }
    }
}
