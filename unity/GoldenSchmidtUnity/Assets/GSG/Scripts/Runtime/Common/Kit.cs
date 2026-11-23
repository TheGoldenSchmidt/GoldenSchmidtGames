using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace GSG
{
    /// <summary>
    /// Building kit of the runtime-built Unity scenes: palette toon materials (cached per colour)
    /// and primitives/generated meshes with neutral UVs (GSG/Toon draws its comic border where the
    /// UV reaches 0 or 1, so generated meshes without UVs would turn black).
    /// </summary>
    public static class Kit
    {
        // ---- materials ---------------------------------------------------------------------

        static Material baseToon;
        static readonly Dictionary<string, Material> cache = new();

        public static Material Toon(Color c, float edge = 1.3f, float rim = 0.2f, Color? emission = null)
        {
            string key = $"{ColorUtility.ToHtmlStringRGBA(c)}/{edge}/{rim}/{(emission.HasValue ? ColorUtility.ToHtmlStringRGBA(emission.Value) : "")}";
            if (cache.TryGetValue(key, out var m)) return m;
            if (!baseToon) baseToon = Resources.Load<Material>("GSG/Materials/Flag");
            m = new Material(baseToon) { name = "Bauschale " + key };
            m.SetColor("_BaseColor", c);
            m.SetFloat("_EdgeWidth", edge);
            m.SetFloat("_RimPower", rim);
            m.SetColor("_ShadowTint", new Color(0.5f, 0.5f, 0.82f));
            m.SetColor("_EmissionColor", emission ?? Color.black);
            cache[key] = m;
            return m;
        }

        // ---- meshes ------------------------------------------------------------------------

        public static GameObject Part(Transform parent, string name, Mesh mesh, Material mat, Vector3 pos, Vector3? scale = null, bool shadows = true)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale ?? Vector3.one;
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            if (!shadows) r.shadowCastingMode = ShadowCastingMode.Off;
            return go;
        }

        public static GameObject Prim(PrimitiveType type, Transform parent, Color color, Vector3 pos, Vector3 scale, float edge = 1.3f, bool collider = false)
        {
            var go = GameObject.CreatePrimitive(type);
            if (!collider) Object.Destroy(go.GetComponent<Collider>());
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.transform.localScale = scale;
            go.GetComponent<Renderer>().sharedMaterial = Toon(color, edge);
            return go;
        }

        /// <summary>Unity's cylinder is 2 high and 1 wide: this takes radius and height like three.js.</summary>
        public static GameObject Cyl(Transform parent, Color color, Vector3 pos, float radius, float height, float edge = 1.3f) =>
            Prim(PrimitiveType.Cylinder, parent, color, pos, new Vector3(radius * 2f, height / 2f, radius * 2f), edge);

        public static GameObject Box(Transform parent, Color color, Vector3 pos, Vector3 size, float edge = 1.3f) =>
            Prim(PrimitiveType.Cube, parent, color, pos, size, edge);

        /// <summary>The toon shader draws its comic border where uv reaches 0 or 1: generated meshes get a neutral uv (no border).</summary>
        public static void NeutralUv(Mesh m)
        {
            var uv = new Vector2[m.vertexCount];
            for (int i = 0; i < uv.Length; i++) uv[i] = new Vector2(0.5f, 0.5f);
            m.uv = uv;
        }

        static Mesh Finish(Mesh m, bool twoSided)
        {
            NeutralUv(m);
            m.RecalculateNormals();
            if (!twoSided) { m.RecalculateBounds(); return m; }
            var v = m.vertices; var n = m.normals; var t = m.triangles;
            var v2 = new Vector3[v.Length * 2]; var n2 = new Vector3[v.Length * 2]; var t2 = new int[t.Length * 2];
            for (int i = 0; i < v.Length; i++) { v2[i] = v[i]; n2[i] = n[i]; v2[i + v.Length] = v[i]; n2[i + v.Length] = -n[i]; }
            for (int i = 0; i < t.Length; i += 3)
            {
                t2[i] = t[i]; t2[i + 1] = t[i + 1]; t2[i + 2] = t[i + 2];
                t2[t.Length + i] = t[i] + v.Length; t2[t.Length + i + 1] = t[i + 2] + v.Length; t2[t.Length + i + 2] = t[i + 1] + v.Length;
            }
            var o = new Mesh { name = m.name, vertices = v2, normals = n2, triangles = t2 };
            NeutralUv(o);
            o.RecalculateBounds();
            return o;
        }

        /// <summary>A surface of revolution from (radius, height) points.</summary>
        public static Mesh Lathe(IList<Vector2> profile, int segments, bool twoSided = false)
        {
            var verts = new List<Vector3>(); var tris = new List<int>();
            int rows = profile.Count;
            for (int s = 0; s <= segments; s++)
            {
                float a = s * Mathf.PI * 2f / segments;
                foreach (var p in profile) verts.Add(new Vector3(Mathf.Cos(a) * p.x, p.y, Mathf.Sin(a) * p.x));
            }
            for (int s = 0; s < segments; s++)
                for (int r = 0; r < rows - 1; r++)
                {
                    int i = s * rows + r, j = (s + 1) * rows + r;
                    tris.AddRange(new[] { i, i + 1, j, j, i + 1, j + 1 });
                }
            return Finish(new Mesh { name = "Drehkörper", vertices = verts.ToArray(), triangles = tris.ToArray() }, twoSided);
        }

        public static Mesh Torus(float radius, float tube, int segments = 48, int sides = 8)
        {
            var profile = new List<Vector2>();
            for (int i = 0; i <= sides; i++)
            {
                float a = -i * Mathf.PI * 2f / sides;
                profile.Add(new Vector2(radius + Mathf.Cos(a) * tube, Mathf.Sin(a) * tube));
            }
            return Lathe(profile, segments);
        }

        public static Mesh Cone(int sides = 7) => Lathe(new[] { new Vector2(0f, 0f), new Vector2(1f, 0f), new Vector2(0f, 1f) }, sides);

        /// <summary>Flat-shaded icosahedron (stones, buds) with unit radius.</summary>
        public static Mesh Ico()
        {
            float t = (1f + Mathf.Sqrt(5f)) / 2f;
            var p = new[] { new Vector3(-1, t, 0), new Vector3(1, t, 0), new Vector3(-1, -t, 0), new Vector3(1, -t, 0), new Vector3(0, -1, t), new Vector3(0, 1, t),
                new Vector3(0, -1, -t), new Vector3(0, 1, -t), new Vector3(t, 0, -1), new Vector3(t, 0, 1), new Vector3(-t, 0, -1), new Vector3(-t, 0, 1) };
            int[] f = { 0,11,5, 0,5,1, 0,1,7, 0,7,10, 0,10,11, 1,5,9, 5,11,4, 11,10,2, 10,7,6, 7,1,8, 3,9,4, 3,4,2, 3,2,6, 3,6,8, 3,8,9, 4,9,5, 2,4,11, 6,2,10, 8,6,7, 9,8,1 };
            var v = new Vector3[f.Length]; var tri = new int[f.Length];
            for (int i = 0; i < f.Length; i++) { v[i] = p[f[i]].normalized; tri[i] = i; }
            var m = new Mesh { name = "Ikosaeder", vertices = v, triangles = tri };
            NeutralUv(m); m.RecalculateNormals(); m.RecalculateBounds();
            return m;
        }

    }
}
