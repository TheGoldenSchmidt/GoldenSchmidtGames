using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>
    /// Kinematic box on a sine path (moving islands, pushers, rolling logs). It carries runners
    /// standing on it and shoves runners it drives into faster than <see cref="shoveSpeed"/>.
    /// A roll visual turns like a log rolling along its path.
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    public class Mover : MonoBehaviour, IPlatform
    {
        public Vector3 axis = Vector3.right;
        public float amplitude = 3f, period = 2.6f, phase;
        public bool shoves;
        public float shoveSpeed = 1.2f, shoveForce = 7f;
        public Transform rollVisual;
        public float rollRadius = 0.3f;

        Rigidbody body;
        Vector3 home, velocity;
        float rolled;

        void Awake()
        {
            body = GetComponent<Rigidbody>();
            body.isKinematic = true;
            body.interpolation = RigidbodyInterpolation.Interpolate;
            home = transform.position;
        }

        Vector3 At(float t) => home + axis.normalized * (amplitude * Mathf.Sin(2f * Mathf.PI * t / period + phase));

        void FixedUpdate()
        {
            // The room's clock when a room's run is drawn, so islands and pushers stand where the room has them.
            float t = CourseClock.Room != null ? CourseClock.Room() - Time.fixedDeltaTime : Time.fixedTime;
            var next = At(t + Time.fixedDeltaTime);
            velocity = (next - body.position) / Time.fixedDeltaTime;
            body.MovePosition(next);
            if (rollVisual)
            {
                float along = Vector3.Dot(velocity, axis.normalized) * Time.fixedDeltaTime;
                rolled -= along / Mathf.Max(rollRadius, 0.05f) * Mathf.Rad2Deg;
                rollVisual.localRotation = Quaternion.AngleAxis(rolled, Vector3.Cross(Vector3.up, axis.normalized).normalized * -1f) ;
            }
        }

        public Vector3 VelocityAt(Vector3 point) => velocity;

        void OnCollisionStay(Collision c)
        {
            if (!shoves || !c.rigidbody) return;
            var runner = c.rigidbody.GetComponent<ParcoursRunner>();
            if (!runner) return;
            var away = runner.transform.position - transform.position; away.y = 0f;
            var dir = velocity; dir.y = 0f;
            if (dir.magnitude < shoveSpeed || Vector3.Dot(dir, away) <= 0f) return;
            // Only a side hit shoves; standing on top just rides along.
            if (runner.transform.position.y > transform.position.y + 0.5f * transform.lossyScale.y - 0.05f) return;
            runner.Knock(dir.normalized * shoveForce + Vector3.up * 3f, 0.32f);
        }
    }
}
