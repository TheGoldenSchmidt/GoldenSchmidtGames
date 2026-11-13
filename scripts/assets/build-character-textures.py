"""Builds the web textures for the rigged characters (Quaternius Universal
Base Characters, CC0) from src/3DModels into public/models/tex/:

- body_<m|f>_<light|dark>.jpg  512 px skin/clothing colour maps
- outfit_<m|f>.png             256 px mask of the dark underwear (white = clothing),
                               tinted with the player colour at runtime
- hair_<1|2>.jpg, eye.jpg      hair and eye colour maps

Normal and roughness maps are left out on purpose: on phone screens they cost
download and GPU time without visible gain at this camera distance.
Run: python3 scripts/assets/build-character-textures.py
"""
from pathlib import Path
from PIL import Image, ImageFilter

SRC = Path("src/3DModels/Universal Base Characters[Standard]/Base Characters/Textures")
OUT = Path("public/models/tex")
OUT.mkdir(parents=True, exist_ok=True)

def jpg(src: str, out: str, size: int) -> None:
    Image.open(SRC / src).convert("RGB").resize((size, size), Image.LANCZOS).save(OUT / out, quality=86, optimize=True)

bodies = {
    "m": {"light": "T_Superhero_Male_Ligh.png", "dark": "T_Superhero_Male_Dark.png"},
    "f": {"light": "T_Superhero_Female_Light_BaseColor.png", "dark": "T_Superhero_Female_Dark_BaseColor.png"},
}
for body, skins in bodies.items():
    for skin, name in skins.items():
        jpg(name, f"body_{body}_{skin}.jpg", 512)
    # Clothing = neutral grey (no saturation); skin is always warm and saturated.
    img = Image.open(SRC / skins["light"]).convert("RGB").resize((512, 512), Image.LANCZOS)
    mask = Image.new("L", img.size)
    px, mp = img.load(), mask.load()
    for y in range(img.size[1]):
        for x in range(img.size[0]):
            r, g, b = px[x, y]
            lum = (r * 299 + g * 587 + b * 114) / 255000
            sat = (max(r, g, b) - min(r, g, b)) / 255
            mp[x, y] = 255 if sat < .07 and .25 < lum < .9 else 0
    mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1)).resize((256, 256), Image.LANCZOS).save(OUT / f"outfit_{body}.png", optimize=True)

jpg("T_Hair_1_BaseColor.png", "hair_1.jpg", 512)
jpg("T_Hair_2_BaseColor.png", "hair_2.jpg", 512)
jpg("T_Eye_Brown.png", "eye.jpg", 128)
for f in sorted(OUT.iterdir()):
    print(f"{f.name}: {f.stat().st_size // 1024} KB")
