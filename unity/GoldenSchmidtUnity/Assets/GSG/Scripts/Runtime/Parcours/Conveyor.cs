using UnityEngine;

namespace GSG.Parcours
{
    /// <summary>Conveyor belt: carries runners along its local forward; the chevrons scroll at the same speed.</summary>
    public class Conveyor : MonoBehaviour, IPlatform
    {
        public float speed = -3.4f;

        void Start()
        {
            var r = GetComponent<Renderer>();
            if (r) r.material.SetFloat("_Scroll", speed);
        }

        public Vector3 VelocityAt(Vector3 point) => transform.forward * speed;
    }
}
