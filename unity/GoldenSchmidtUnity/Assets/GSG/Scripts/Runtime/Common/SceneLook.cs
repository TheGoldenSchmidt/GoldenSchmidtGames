using UnityEngine;
using UnityEngine.Rendering;

namespace GSG
{
    /// <summary>
    /// Light story of a scene from the palette: palette sky, a three-colour ambient gradient (so
    /// shadow sides stay alive without baked lighting) and palette-tinted distance fog.
    /// </summary>
    public class SceneLook : MonoBehaviour
    {
        public Material sky;
        public Color ambientSky = new Color(0.56f, 0.55f, 0.88f);
        public Color ambientEquator = new Color(0.78f, 0.62f, 0.72f);
        public Color ambientGround = new Color(0.23f, 0.17f, 0.31f);
        public Color fog = new Color(0.55f, 0.42f, 0.66f);
        public float fogStart = 70f, fogEnd = 240f;

        void Awake() { Apply(); }

        public void Apply()
        {
            if (sky) RenderSettings.skybox = sky;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = ambientSky;
            RenderSettings.ambientEquatorColor = ambientEquator;
            RenderSettings.ambientGroundColor = ambientGround;
            // Ambient probe built directly from the gradient: no baked lighting data is needed.
            var sh = new SphericalHarmonicsL2();
            sh.AddAmbientLight(ambientEquator);
            sh.AddDirectionalLight(Vector3.up, (ambientSky - ambientEquator) * 1.2f, 1f);
            sh.AddDirectionalLight(Vector3.down, (ambientGround - ambientEquator) * 1.2f, 1f);
            RenderSettings.ambientProbe = sh;
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = fog;
            RenderSettings.fogStartDistance = fogStart;
            RenderSettings.fogEndDistance = fogEnd;
        }
    }
}
