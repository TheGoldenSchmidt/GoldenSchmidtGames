using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>
    /// Spinning bar about a vertical post. Low bars (pink) are jumped, high bars (yellow) ducked
    /// under – the trigger volume is the bar itself, so jumping or ducking simply misses it.
    /// A hit flings the runner along the bar's motion and outwards.
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    public class Sweeper : MonoBehaviour
    {
        public float speed = 1.5f;   // rad/s, sign = direction
        public float phase;
        public float knock = 8.5f, knockUp = 4.5f, fling = 3f;

        Rigidbody body;

        void Awake()
        {
            body = GetComponent<Rigidbody>();
            body.isKinematic = true;
            body.interpolation = RigidbodyInterpolation.Interpolate;
        }

        void FixedUpdate()
        {
            float angle = (phase + speed * (Time.fixedTime + Time.fixedDeltaTime)) * Mathf.Rad2Deg;
            body.MoveRotation(Quaternion.Euler(0f, -angle, 0f));
        }

        void OnTriggerStay(Collider other)
        {
            var runner = other.attachedRigidbody ? other.attachedRigidbody.GetComponent<ParcoursRunner>() : null;
            if (!runner) return;
            var r = runner.transform.position - transform.position; r.y = 0f;
            // Tangential velocity of the bar where it meets the runner (rotation about -y for positive speed).
            var tangent = Vector3.Cross(Vector3.down * Mathf.Sign(speed), r).normalized;
            var push = tangent * knock + r.normalized * fling + Vector3.up * knockUp;
            runner.Knock(push, 0.65f, true);
        }
    }
}
