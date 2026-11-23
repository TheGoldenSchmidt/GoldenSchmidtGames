using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>Ground that carries a runner standing on it (moving islands, belts).</summary>
    /// <summary>Whoever runs a race: the solo probe level or a run against bots.</summary>
    public interface IRaceHost
    {
        void Reached(Checkpoint cp, ParcoursRunner runner);
        void CheckFall(ParcoursRunner runner);
        void Finish(Vector3 at, ParcoursRunner runner);
    }

    public interface IPlatform
    {
        Vector3 VelocityAt(Vector3 point);
    }
}
