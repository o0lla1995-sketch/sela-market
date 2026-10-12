#!/usr/bin/env python3
"""سيلا ماركت — توليد كل أيقونات التطبيق من مفهوم A (الحقيبة البرتقالية).

المصدر: ملف هوية سيلا ماركت — download/sela-market-identity (الجولة 57).
يولّد:
  • طبقات الأيقونة التكيفية (background تدرج + foreground العلامة) بكل الكثافات
  • ic_launcher / ic_launcher_round القديمة بكل الكثافات
  • أيقونة الإشعار ic_stat_market (كيس أبيض شفاف الخلفية) بكل الكثافات
  • شعار السبلاش splash_logo (كيس أبيض + س برتقالية) بكل الكثافات

الاستخدام:  python3 scripts/generate_app_icons.py
"""
import os
import shutil
import subprocess

import cairosvg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
FONT_DIR = os.path.join(ROOT, "android", "app", "src", "main", "assets", "fonts")

# ─── رموز الهوية (مطابقة لملف الهوية الأم) ───
ORANGE = "#F97316"       # برتقالي سيلا
ORANGE_HI = "#FB923C"    # القطب الفاتح
ORANGE_DEEP = "#EA580C"  # القطب الغامق
WHITE = "#FFFFFF"

S = 1024  # اللوحة الأساسية


def install_fonts():
    """تثبيت Tajawal لعارض cairosvg النصي (نفس خط أنابيب نقطة البيع)."""
    fonts_home = os.path.expanduser("~/.fonts")
    os.makedirs(fonts_home, exist_ok=True)
    for w in ["Regular", "Medium", "Bold", "Black"]:
        src = os.path.join(FONT_DIR, f"Tajawal-{w}.ttf")
        dst = os.path.join(fonts_home, f"Tajawal-{w}.ttf")
        if os.path.isfile(src) and not os.path.isfile(dst):
            shutil.copy(src, dst)
    subprocess.run(["fc-cache", "-f"], capture_output=True)


def bag_paths(cx=512, cy=560, w=520, h=460, r=74, handle_drop=132):
    """مسارا جسم الحقيبة (مستطيل مدوّر) ومقبضها (قوس أنبوبي)."""
    x0, y0 = cx - w / 2, cy - h / 2
    x1, y1 = cx + w / 2, cy + h / 2
    body = (
        f"M {x0+r} {y0} H {x1-r} Q {x1} {y0} {x1} {y0+r} V {y1-r} "
        f"Q {x1} {y1} {x1-r} {y1} H {x0+r} Q {x0} {y1} {x0} {y1-r} "
        f"V {y0+r} Q {x0} {y0} {x0+r} {y0} Z"
    )
    hw = w * 0.34
    handle = (
        f"M {cx-hw} {y0+30} C {cx-hw} {y0-handle_drop}, "
        f"{cx+hw} {y0-handle_drop}, {cx+hw} {y0+30}"
    )
    return body, handle


def glyph_s(x, y, size, fill, o=0):
    return (
        f'<text x="{x}" y="{y+o}" font-family="Tajawal" font-weight="900" '
        f'font-size="{size}" fill="{fill}" text-anchor="middle">س</text>'
    )


def defs():
    return f'''<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{ORANGE_HI}"/>
      <stop offset="55%" stop-color="{ORANGE}"/>
      <stop offset="100%" stop-color="{ORANGE_DEEP}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="34%" r="66%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>'''


def full_icon():
    """الأيقونة الكاملة (مفهوم A): تدرج برتقالي + حقيبة بيضاء + س برتقالية."""
    body, handle = bag_paths()
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 {S} {S}">
  {defs()}
  <rect width="{S}" height="{S}" fill="url(#bg)"/>
  <rect width="{S}" height="{S}" fill="url(#glow)"/>
  <path d="{handle}" fill="none" stroke="{WHITE}" stroke-width="54" stroke-linecap="round"/>
  <path d="{body}" fill="{WHITE}"/>
  <path d="{body}" fill="none" stroke="{ORANGE_DEEP}" stroke-opacity="0.18" stroke-width="10"/>
  {glyph_s(512, 700, 300, ORANGE, o=-6)}
</svg>'''


def adaptive_background():
    """خلفية الأيقونة التكيفية: التدرج البرتقالي وحده."""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 {S} {S}">
  {defs()}
  <rect width="{S}" height="{S}" fill="url(#bg)"/>
</svg>'''


def adaptive_foreground():
    """طبقة أمامية للتكيفية: العلامة (مقبض+حقيبة+س) مصغّرة إلى المنطقة
    الآمنة المركزية حتى لا تقصّها أقنعة المشغّل الدائرية."""
    body, handle = bag_paths(cx=512, cy=596, w=380, h=336)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 {S} {S}">
  <path d="{handle}" fill="none" stroke="{WHITE}" stroke-width="54" stroke-linecap="round"/>
  <path d="{body}" fill="{WHITE}"/>
  {glyph_s(512, 690, 210, ORANGE, o=-4)}
</svg>'''


def stat_icon():
    """أيقونة الإشعار: كيس أبيض بسيط (بدون نص) على خلفية شفافة —
    متطلب أندرويد: glyph أبيض أحادي."""
    body, handle = bag_paths(cx=512, cy=580, w=560, h=500)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 {S} {S}">
  <path d="{handle}" fill="none" stroke="{WHITE}" stroke-width="76" stroke-linecap="round"/>
  <path d="{body}" fill="{WHITE}"/>
</svg>'''


def splash_logo():
    """شعار السبلاش: نفس العلامة على شفاف — فوق خلفية السبلاش البرتقالية."""
    body, handle = bag_paths(cx=512, cy=560, w=520, h=460)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 {S} {S}">
  <path d="{handle}" fill="none" stroke="{WHITE}" stroke-width="54" stroke-linecap="round"/>
  <path d="{body}" fill="{WHITE}"/>
  {glyph_s(512, 700, 300, ORANGE, o=-6)}
</svg>'''


# (مجلد الهدف، دالة svg، الحجم بالبكسل، اسم الملف)
JOBS = [
    # أيقونات تكيفية — طبقتان (108dp أساس: mdpi=108 … xxxhdpi=432)
    ("mipmap-mdpi", adaptive_background, 108, "ic_launcher_background"),
    ("mipmap-hdpi", adaptive_background, 162, "ic_launcher_background"),
    ("mipmap-xhdpi", adaptive_background, 216, "ic_launcher_background"),
    ("mipmap-xxhdpi", adaptive_background, 324, "ic_launcher_background"),
    ("mipmap-xxxhdpi", adaptive_background, 432, "ic_launcher_background"),
    ("mipmap-mdpi", adaptive_foreground, 108, "ic_launcher_foreground"),
    ("mipmap-hdpi", adaptive_foreground, 162, "ic_launcher_foreground"),
    ("mipmap-xhdpi", adaptive_foreground, 216, "ic_launcher_foreground"),
    ("mipmap-xxhdpi", adaptive_foreground, 324, "ic_launcher_foreground"),
    ("mipmap-xxxhdpi", adaptive_foreground, 432, "ic_launcher_foreground"),
    # الأيقونات القديمة (48dp أساس)
    ("mipmap-mdpi", full_icon, 48, "ic_launcher"),
    ("mipmap-hdpi", full_icon, 72, "ic_launcher"),
    ("mipmap-xhdpi", full_icon, 96, "ic_launcher"),
    ("mipmap-xxhdpi", full_icon, 144, "ic_launcher"),
    ("mipmap-xxxhdpi", full_icon, 192, "ic_launcher"),
    ("mipmap-mdpi", full_icon, 48, "ic_launcher_round"),
    ("mipmap-hdpi", full_icon, 72, "ic_launcher_round"),
    ("mipmap-xhdpi", full_icon, 96, "ic_launcher_round"),
    ("mipmap-xxhdpi", full_icon, 144, "ic_launcher_round"),
    ("mipmap-xxxhdpi", full_icon, 192, "ic_launcher_round"),
    # أيقونة الإشعار (24dp أساس، drawable)
    ("drawable-mdpi", stat_icon, 24, "ic_stat_market"),
    ("drawable-hdpi", stat_icon, 36, "ic_stat_market"),
    ("drawable-xhdpi", stat_icon, 48, "ic_stat_market"),
    ("drawable-xxhdpi", stat_icon, 72, "ic_stat_market"),
    ("drawable-xxxhdpi", stat_icon, 96, "ic_stat_market"),
    # شعار السبلاش
    ("drawable-mdpi", splash_logo, 120, "splash_logo"),
    ("drawable-hdpi", splash_logo, 180, "splash_logo"),
    ("drawable-xhdpi", splash_logo, 240, "splash_logo"),
    ("drawable-xxhdpi", splash_logo, 360, "splash_logo"),
    ("drawable-xxxhdpi", splash_logo, 480, "splash_logo"),
    ("drawable", splash_logo, 480, "splash_logo"),
]


def main():
    install_fonts()
    for folder, svg_fn, px, name in JOBS:
        out_dir = os.path.join(RES, folder)
        os.makedirs(out_dir, exist_ok=True)
        out = os.path.join(out_dir, f"{name}.png")
        cairosvg.svg2png(bytestring=svg_fn().encode("utf-8"),
                         write_to=out, output_width=px, output_height=px)
        print(f"  + {folder}/{name}.png ({px}x{px})")
    # معاينات داخل المستودع
    preview_dir = os.path.join(ROOT, "assets", "brand")
    os.makedirs(preview_dir, exist_ok=True)
    cairosvg.svg2png(bytestring=full_icon().encode("utf-8"),
                     write_to=os.path.join(preview_dir, "app-icon-512.png"),
                     output_width=512, output_height=512)
    cairosvg.svg2png(bytestring=splash_logo().encode("utf-8"),
                     write_to=os.path.join(preview_dir, "mark-white-512.png"),
                     output_width=512, output_height=512)
    with open(os.path.join(preview_dir, "concept-A-bag-orange.svg"), "w") as f:
        f.write(full_icon())
    print("  + assets/brand (icon 512 + mark + svg)")
    print("تم: كل أيقونات سيلا ماركت وُلّدت.")


if __name__ == "__main__":
    main()
