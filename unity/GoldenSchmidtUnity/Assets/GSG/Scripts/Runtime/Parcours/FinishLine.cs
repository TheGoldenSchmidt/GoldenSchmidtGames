using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>The finish arch: crossing it ends the run.</summary>
    public class FinishLine : MonoBehaviour
    {
        void OnTriggerEnter(Collider other)
        {
            var runner = other.attachedRigidbody ? other.attachedRigidbody.GetComponent<ParcoursRunner>() : null;
            if (runner && runner.game) runner.game.Finish(transform.position);
        }
    }
}
