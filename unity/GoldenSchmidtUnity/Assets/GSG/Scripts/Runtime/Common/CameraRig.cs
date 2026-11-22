using Unity.Cinemachine;
using UnityEngine;

namespace GSG
{
    /// <summary>
    /// Cinemachine follow rig: an orbital follow (swipe turns it, it recenters behind the course
    /// direction after a pause), a rotation composer that keeps the figure on the lower third,
    /// and an impulse listener for screen shake. Movement input is read relative to its yaw.
    /// </summary>
    public class CameraRig : MonoBehaviour
    {
        public CinemachineCamera cam;
        public CinemachineOrbitalFollow orbit;
        public CinemachineRotationComposer composer;
        public Transform target;
        public float swipeYaw = 0.28f, swipePitch = 0.18f, recenterAfter = 2.2f;
        /// <summary>Yaw the rig returns to (0 = looking along +z, the course direction).</summary>
        public float homeYaw;
        float lastSwipe = -99f;

        public static CameraRig Create(Transform target, float radius, float pitch, float fov, Vector3 offset)
        {
            var main = Camera.main;
            if (!main.GetComponent<CinemachineBrain>()) main.gameObject.AddComponent<CinemachineBrain>();
            var go = new GameObject("Kamera-Rig");
            var rig = go.AddComponent<CameraRig>();
            rig.target = target;
            rig.cam = go.AddComponent<CinemachineCamera>();
            rig.cam.Target.TrackingTarget = target;
            var lens = rig.cam.Lens; lens.FieldOfView = fov; lens.NearClipPlane = 0.2f; lens.FarClipPlane = 400f; rig.cam.Lens = lens;
            rig.orbit = go.AddComponent<CinemachineOrbitalFollow>();
            rig.orbit.OrbitStyle = CinemachineOrbitalFollow.OrbitStyles.Sphere;
            rig.orbit.Radius = radius;
            rig.orbit.TargetOffset = offset;
            var tracker = rig.orbit.TrackerSettings;
            tracker.BindingMode = Unity.Cinemachine.TargetTracking.BindingMode.WorldSpace;
            tracker.PositionDamping = new Vector3(0.35f, 0.5f, 0.35f);
            rig.orbit.TrackerSettings = tracker;
            var h = rig.orbit.HorizontalAxis; h.Range = new Vector2(-180f, 180f); h.Wrap = true; h.Value = 0f; h.Center = 0f; rig.orbit.HorizontalAxis = h;
            var v = rig.orbit.VerticalAxis; v.Range = new Vector2(-5f, 70f); v.Wrap = false; v.Value = pitch; v.Center = pitch; rig.orbit.VerticalAxis = v;
            rig.composer = go.AddComponent<CinemachineRotationComposer>();
            rig.composer.TargetOffset = new Vector3(0f, 0.9f, 0f);
            rig.composer.Damping = new Vector2(0.6f, 0.5f);
            var comp = rig.composer.Composition;
            comp.ScreenPosition = new Vector2(0f, 0.12f);
            comp.DeadZone.Enabled = true; comp.DeadZone.Size = new Vector2(0.08f, 0.06f);
            rig.composer.Composition = comp;
            var listener = go.AddComponent<CinemachineImpulseListener>();
            listener.Gain = 1f;
            listener.UseCameraSpace = true;
            return rig;
        }

        public float Yaw => orbit ? orbit.HorizontalAxis.Value : 0f;

        /// <summary>Stick (x right, y up) to a world direction on the ground, relative to the camera.</summary>
        public Vector3 Relative(Vector2 stick)
        {
            var yaw = Quaternion.Euler(0f, Yaw, 0f);
            return yaw * new Vector3(stick.x, 0f, stick.y);
        }

        public void Swipe(Vector2 delta)
        {
            if (!orbit || delta.sqrMagnitude < 0.01f) return;
            lastSwipe = Time.unscaledTime;
            var h = orbit.HorizontalAxis; h.Value = Mathf.Repeat(h.Value + delta.x * swipeYaw + 180f, 360f) - 180f; orbit.HorizontalAxis = h;
            var v = orbit.VerticalAxis; v.Value = Mathf.Clamp(v.Value + delta.y * swipePitch, v.Range.x, v.Range.y); orbit.VerticalAxis = v;
        }

        public void Snap(float yaw)
        {
            homeYaw = yaw;
            var h = orbit.HorizontalAxis; h.Value = yaw; orbit.HorizontalAxis = h;
            cam.PreviousStateIsValid = false;
        }

        void LateUpdate()
        {
            if (!orbit || Time.unscaledTime - lastSwipe < recenterAfter) return;
            var h = orbit.HorizontalAxis;
            h.Value = Mathf.LerpAngle(h.Value, homeYaw, 1f - Mathf.Exp(-1.6f * Time.unscaledDeltaTime));
            orbit.HorizontalAxis = h;
            var v = orbit.VerticalAxis;
            v.Value = Mathf.Lerp(v.Value, v.Center, 1f - Mathf.Exp(-1.2f * Time.unscaledDeltaTime));
            orbit.VerticalAxis = v;
        }
    }
}
