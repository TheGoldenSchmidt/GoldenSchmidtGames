using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>Ground that carries a runner standing on it (moving islands, belts).</summary>
    public interface IPlatform
    {
        Vector3 VelocityAt(Vector3 point);
    }
}
