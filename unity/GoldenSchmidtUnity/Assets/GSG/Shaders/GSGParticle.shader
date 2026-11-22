// Particles without textures: vertex colour times a procedural soft disc (or a crisp square for
// confetti and shards). Alpha blended; colours always come from the palette via the systems.
Shader "GSG/Particle"
{
    Properties
    {
        _Square ("Quadrat statt Kreis", Float) = 0
        _Softness ("Weiche", Range(0.01,0.5)) = 0.25
        _Boost ("HDR-Verstaerkung", Float) = 1
    }

    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "RenderPipeline"="UniversalPipeline" "IgnoreProjector"="True" }
        Blend SrcAlpha OneMinusSrcAlpha
        ZWrite Off
        Cull Off

        Pass
        {
            Tags { "LightMode"="UniversalForward" }

            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma multi_compile_fog
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            CBUFFER_START(UnityPerMaterial)
                float _Square;
                float _Softness;
                float _Boost;
            CBUFFER_END

            struct Attributes { float4 positionOS : POSITION; float4 color : COLOR; float2 uv : TEXCOORD0; };
            struct Varyings { float4 positionCS : SV_POSITION; float4 color : COLOR; float2 uv : TEXCOORD0; float fog : TEXCOORD1; };

            Varyings Vert(Attributes input)
            {
                Varyings o;
                o.positionCS = TransformObjectToHClip(input.positionOS.xyz);
                o.color = input.color;
                o.uv = input.uv;
                o.fog = ComputeFogFactor(o.positionCS.z);
                return o;
            }

            half4 Frag(Varyings i) : SV_Target
            {
                float2 d = abs(i.uv - 0.5) * 2.0;
                float r = _Square > 0.5 ? max(d.x, d.y) : length(d);
                float a = 1.0 - smoothstep(1.0 - _Softness * 2.0, 1.0, r);
                half3 c = MixFog(i.color.rgb * _Boost, i.fog);
                return half4(c, i.color.a * a);
            }
            ENDHLSL
        }
    }
    FallBack Off
}
