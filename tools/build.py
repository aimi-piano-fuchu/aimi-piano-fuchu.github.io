#!/usr/bin/env python3
"""あいみピアノ教室サイトのビルド。

src/pages/*.html（本文だけ）に共通のヘッダー・フッターをかぶせて、
サイト直下に完成した HTML を書き出す。お知らせは news-data/posts.json と
src/news-extra.json から news/index.html と news/<id>.html を作る。

使い方:  python3 tools/build.py
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"

SITE = {
    "name": "あいみピアノ教室",
    "name_en": "Aimi Piano School",
    "area": "東京都府中市四谷",
    "instagram": "https://www.instagram.com/aimi_piano_/",
    # 独自ドメインを取ったらここに入れる（例: "https://aimi-piano.com"）。空なら canonical/OGP の絶対URLを出さない
    "base_url": "",
    # サイトのルートのパス。GitHub Pages の https://<user>.github.io/aimi-piano/ なら "/aimi-piano/"、独自ドメインなら "/"
    # 404.html はどの深さのURLでも表示されるので、ここから絶対パスでCSSや画像を読む
    "abs_root": "/aimi-piano/",
}

NAV = [
    ("about.html", "教室について"),
    ("lesson.html", "レッスン・月謝"),
    ("teacher.html", "講師紹介"),
    ("recital.html", "発表会"),
    ("news/index.html", "お知らせ"),
    ("faq.html", "よくある質問"),
]

ICONS = {
    "arrow": '<svg class="btn__arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4"/></svg>',
    "chev": '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>',
    "note": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
    "ig": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    "wave": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/><path d="M4 18c1.5-2 3-2 4.5 0M15.5 6c1.5-2 3-2 4.5 0"/></svg>',
    "user": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>',
    "star": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
    "video": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="M15.5 10.5l6-3.5v10l-6-3.5z"/></svg>',
    "pin": '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
}


def ripple(cls="ripple", rings=7, fill=True):
    """ケースの波紋＝音の広がり。同心円を外側ほど薄く描く。"""
    parts = [f'<svg class="{cls}" viewBox="0 0 400 400" aria-hidden="true" focusable="false">']
    if fill:
        parts.append('<circle class="r-fill" cx="200" cy="200" r="70"/>')
    for i in range(rings):
        r = 70 + i * 22
        op = max(0.12, 0.7 - i * 0.09)
        parts.append(f'<circle cx="200" cy="200" r="{r}" stroke-width="1" opacity="{op:.2f}"/>')
    parts.append("</svg>")
    return "".join(parts)


def hero_rings():
    parts = ['<svg class="hero__rings ripple" viewBox="0 0 400 400" aria-hidden="true" focusable="false">']
    for i in range(9):
        r = 60 + i * 17
        op = max(0.10, 0.55 - i * 0.05)
        parts.append(f'<circle cx="200" cy="200" r="{r}" stroke-width="1" opacity="{op:.2f}"/>')
    for _ in range(3):
        parts.append('<circle class="wave" cx="200" cy="200" r="196" stroke-width="1.2"/>')
    parts.append("</svg>")
    return "".join(parts)


LOGO = (
    '<svg class="brand__mark" viewBox="0 0 40 40" aria-hidden="true">'
    '<circle cx="20" cy="20" r="19" fill="#8A9AB0"/>'
    '<circle cx="20" cy="20" r="13.5" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1"/>'
    '<circle cx="20" cy="20" r="8.5" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1"/>'
    '<path d="M21.5 11v11.2a3.3 3.3 0 11-1.6-2.8V11h1.6z" fill="#fff"/>'
    '<path d="M21.5 11c1.8 1.2 4 2 4.3 4.6" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>'
    "</svg>"
)


def e(s):
    return html.escape(s, quote=True)


def header(root, current):
    items = []
    for href, label in NAV:
        cur = ' aria-current="page"' if href == current or (current.startswith("news/") and href.startswith("news/")) else ""
        items.append(f'<li><a href="{root}{href}"{cur}>{label}</a></li>')
    items.append(
        f'<li class="gnav__ig"><a href="{SITE["instagram"]}" target="_blank" rel="noopener" aria-label="Instagram（新しいタブで開きます）">{ICONS["ig"]}<span class="gnav__ig-label">Instagram</span></a></li>'
    )
    items.append(
        f'<li class="gnav__cta"><a class="btn btn--primary btn--sm" href="{root}contact.html">体験レッスン</a></li>'
    )
    return f"""<a class="skip" href="#main">本文へスキップ</a>
<header class="site-header" id="top">
  <div class="wrap site-header__inner">
    <a class="brand" href="{root}index.html" aria-label="{SITE['name']} トップページ">
      {LOGO}
      <span class="brand__text"><span class="brand__ja">{SITE['name']}</span><span class="brand__en">{SITE['name_en']}</span></span>
    </a>
    <button class="menu-toggle" type="button" aria-controls="gnav" aria-expanded="false"><span class="menu-toggle__bar" aria-hidden="true"></span><span class="sr-only">メニューを開く</span></button>
    <nav class="gnav" id="gnav" aria-label="メインメニュー">
      <ul class="gnav__list">
        {''.join(items)}
      </ul>
    </nav>
  </div>
</header>"""


def cta_band(root):
    return f"""<section class="cta" aria-labelledby="cta-title">
  {ripple(rings=9, fill=False)}
  <div class="wrap cta__inner">
    <span class="eyebrow">Trial Lesson</span>
    <h2 id="cta-title">まずは体験レッスンへ</h2>
    <p>楽譜が読めなくても、ピアノに触ったことがなくても大丈夫です。教室の雰囲気や先生との相性を、30分の体験レッスンで確かめてください。</p>
    <p class="cta__price">体験レッスン 30分 <b class="num">1,000</b>円</p>
    <a class="btn btn--primary" href="{root}contact.html">体験レッスンを申し込む{ICONS['arrow']}</a>
  </div>
</section>"""


def footer(root, float_cta=True):
    return f"""<footer class="site-footer">
  <div class="wrap">
    <div class="site-footer__grid">
      <div class="site-footer__about">
        <a class="brand" href="{root}index.html">{LOGO}<span class="brand__text"><span class="brand__ja">{SITE['name']}</span><span class="brand__en">{SITE['name_en']}</span></span></a>
        <p>{SITE['area']}のピアノ教室です。リトミックを取り入れた個人レッスンで、3歳から大人の方（女性）まで一人ひとりに合わせて指導しています。</p>
        <a class="ig-link" href="{SITE['instagram']}" target="_blank" rel="noopener">{ICONS['ig']}@aimi_piano_</a>
      </div>
      <div>
        <h2>Menu</h2>
        <ul>
          <li><a href="{root}about.html">教室について</a></li>
          <li><a href="{root}lesson.html">レッスン・月謝</a></li>
          <li><a href="{root}teacher.html">講師紹介</a></li>
          <li><a href="{root}recital.html">発表会・イベント</a></li>
        </ul>
      </div>
      <div>
        <h2>Information</h2>
        <ul>
          <li><a href="{root}news/index.html">お知らせ・教室日記</a></li>
          <li><a href="{root}faq.html">よくある質問</a></li>
          <li><a href="{root}access.html">アクセス</a></li>
          <li><a href="{root}contact.html">お問い合わせ</a></li>
          <li><a href="{root}privacy.html">プライバシー<wbr>ポリシー</a></li>
        </ul>
      </div>
    </div>
    <div class="site-footer__bottom">
      <span>&copy; <span class="num">2026</span> {SITE['name']}</span>
      <a href="#top">ページの先頭へ</a>
    </div>
  </div>
</footer>
""" + (f'<div class="float-cta"><a class="btn btn--primary" href="{root}contact.html">体験レッスンを申し込む{ICONS["arrow"]}</a></div>' if float_cta else "")


def page(title, description, body, root="", current="", cta=True, extra_head="", extra_js=""):
    full_title = f"{title}｜{SITE['name']}（{SITE['area']}）" if title else f"{SITE['name']}｜{SITE['area']}のピアノ教室"
    canonical = ""
    og_image = f"{root}images/og.jpg"
    if SITE["base_url"]:
        path = current if current else "index.html"
        canonical = f'<link rel="canonical" href="{SITE["base_url"]}/{path.replace("index.html", "")}">'
        og_image = f'{SITE["base_url"]}/images/og.jpg'
    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(full_title)}</title>
<meta name="description" content="{e(description)}">
<meta name="theme-color" content="#8A9AB0">
{canonical}
<meta property="og:type" content="website">
<meta property="og:site_name" content="{SITE['name']}">
<meta property="og:title" content="{e(full_title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:image" content="{og_image}">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{root}images/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="{root}images/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Shippori+Mincho:wght@500;600&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">
<link rel="stylesheet" href="{root}css/style.css">
<script>document.documentElement.classList.add('js')</script>
{extra_head}
</head>
<body>
{header(root, current)}
<main id="main">
{body}
{cta_band(root) if cta else ''}
</main>
{footer(root, float_cta=current not in ("contact.html", "admin.html"))}
<script src="{root}js/main.js" defer></script>
{extra_js}
</body>
</html>
"""


def fill(text, root):
    text = text.replace("{{root}}", root)
    text = re.sub(r"\{\{icon:(\w+)\}\}", lambda m: ICONS[m.group(1)], text)
    text = text.replace("{{ripple}}", ripple())
    text = text.replace("{{ripple-soft}}", ripple(rings=6, fill=False))
    text = text.replace("{{hero-rings}}", hero_rings())
    return text


# ---------------------------------------------------------------- news
BOILER = re.compile(r"^\s*(\*･゜|＊|✳︎・・・|\*･)")


def clean_body(body):
    lines = body.split("\n")
    out = []
    for ln in lines:
        if BOILER.match(ln):
            break  # 以降は毎回の定型文（体験レッスンの案内・ハッシュタグ等）
        out.append(ln)
    text = "\n".join(out)
    text = re.sub(r"(\n\s*\.\s*)+$", "", text.rstrip())  # 末尾の「.」だけの行
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def load_news():
    posts = json.loads((ROOT / "news-data" / "posts.json").read_text(encoding="utf-8"))
    extra_path = SRC / "news-extra.json"
    extra = json.loads(extra_path.read_text(encoding="utf-8")) if extra_path.exists() else []
    hide_path = SRC / "news-hide.json"
    hide = set(json.loads(hide_path.read_text(encoding="utf-8"))["images"]) if hide_path.exists() else set()
    items = []
    for p in extra:
        items.append({**p, "images": p.get("images", []), "embeds": p.get("embeds", []), "body": p["body"]})
    for p in posts:
        items.append({
            "id": p["id"],
            "title": p["title"].strip(),
            "date": p["date"],
            "categories": p.get("categories") or ["その他"],
            "body": clean_body(p.get("body", "")),
            "images": ["images/news/" + Path(i).name for i in p.get("images", []) if Path(i).name not in hide],
            "embeds": p.get("embeds", []),
        })
    items.sort(key=lambda x: x["date"], reverse=True)
    return items


def fmt_date(d):
    return d.replace("-", ".")


def news_row(item, root):
    cat = item["categories"][0]
    return (
        f'<li data-cat="{e(cat)}"><a class="news-item" href="{root}news/{item["id"]}.html">'
        f'<time datetime="{item["date"]}">{fmt_date(item["date"])}</time>'
        f'<span class="news-item__cat">{e(cat)}</span>'
        f'<span class="news-item__title">{e(item["title"])}</span>{ICONS["chev"]}</a></li>'
    )


def build_news(items):
    out_dir = ROOT / "news"
    out_dir.mkdir(exist_ok=True)
    root = "../"
    cats = []
    for it in items:
        c = it["categories"][0]
        if c not in cats:
            cats.append(c)
    order = ["お知らせ", "活動報告", "とある日のレッスン", "NEW生徒さん", "レッスンについて", "アイテム紹介", "演奏動画", "その他"]
    cats.sort(key=lambda c: order.index(c) if c in order else 99)
    filters = ['<button class="filter-btn" type="button" data-filter="" aria-pressed="true">すべて</button>'] + [
        f'<button class="filter-btn" type="button" data-filter="{e(c)}" aria-pressed="false">{e(c)}</button>' for c in cats
    ]
    rows = "\n".join(news_row(it, root) for it in items)
    body = f"""<section class="page-hero">
  {ripple()}
  <div class="wrap page-hero__inner">
    <ol class="crumbs"><li><a href="{root}index.html">ホーム</a></li><li>お知らせ</li></ol>
    <span class="eyebrow">News &amp; Diary</span>
    <h1>お知らせ・教室日記</h1>
    <p>教室からのお知らせと、レッスンや発表会の様子をお届けします。最新の様子は<a href="{SITE['instagram']}" target="_blank" rel="noopener">Instagram</a>でも発信しています。</p>
  </div>
</section>
<section class="section section--tight">
  <div class="wrap wrap--narrow">
    <div class="news-tools" role="group" aria-label="カテゴリで絞り込む">{''.join(filters)}</div>
    <p class="field__hint" id="news-count" aria-live="polite"></p>
    <ul class="news-list" id="news-list" data-per-page="20">
{rows}
    </ul>
    <nav class="pager" id="pager" aria-label="ページ送り"></nav>
  </div>
</section>"""
    (out_dir / "index.html").write_text(
        page("お知らせ・教室日記", "あいみピアノ教室からのお知らせと、レッスン・発表会の様子を綴った教室日記です。", body, root, "news/index.html"),
        encoding="utf-8",
    )

    for i, it in enumerate(items):
        newer = items[i - 1] if i > 0 else None
        older = items[i + 1] if i + 1 < len(items) else None
        imgs = "".join(
            f'<img src="{root}{src}" alt="「{e(it["title"])}」の写真 {n + 1}" loading="lazy">' for n, src in enumerate(it["images"])
        )
        embeds = ""
        ig = [x for x in it["embeds"] if x.get("type") == "instagram"]
        if ig:
            embeds = "<p>" + " ".join(
                f'<a class="btn btn--ghost btn--sm" href="{e(x["url"])}" target="_blank" rel="noopener">Instagramで見る</a>' for x in ig
            ) + "</p>"
        body_text = e(it["body"]) if it["body"] else ""
        nav = '<nav class="article__nav" aria-label="前後の記事">'
        nav += f'<a href="{older["id"]}.html">← {e(older["title"][:24])}</a>' if older else "<span></span>"
        nav += f'<a href="{newer["id"]}.html">{e(newer["title"][:24])} →</a>' if newer else "<span></span>"
        nav += "</nav>"
        desc = re.sub(r"\s+", " ", it["body"])[:110] or it["title"]
        art = f"""<section class="section section--tight">
  <div class="wrap wrap--narrow">
    <ol class="crumbs"><li><a href="{root}index.html">ホーム</a></li><li><a href="index.html">お知らせ</a></li><li>{e(it["title"][:20])}</li></ol>
    <article class="article">
      <div class="article__meta"><time datetime="{it["date"]}" class="num">{fmt_date(it["date"])}</time><span class="news-item__cat">{e(it["categories"][0])}</span></div>
      <h1>{e(it["title"])}</h1>
      {f'<div class="article__body">{body_text}</div>' if body_text else ''}
      {f'<div class="article__images">{imgs}</div>' if imgs else ''}
      {embeds}
      {nav}
      <p><a class="btn btn--ghost btn--sm" href="index.html">お知らせ一覧へ戻る</a></p>
    </article>
  </div>
</section>"""
        (out_dir / f'{it["id"]}.html').write_text(
            page(it["title"], desc, art, root, "news/" + it["id"] + ".html"), encoding="utf-8"
        )
    return items


def main():
    items = load_news()
    build_news(items)
    latest = "\n".join(news_row(it, "") for it in items[:4])

    for src in sorted((SRC / "pages").glob("*.html")):
        raw = src.read_text(encoding="utf-8")
        m = re.match(r"<!--\s*(\{.*?\})\s*-->\s*", raw, re.S)
        meta = json.loads(m.group(1)) if m else {}
        body = raw[m.end():] if m else raw
        body = fill(body, "").replace("{{latest-news}}", latest)
        name = src.name
        root = SITE["abs_root"] if name == "404.html" else ""
        if root:
            body = fill(raw[m.end():] if m else raw, root)
        out = page(
            meta.get("title", ""),
            meta.get("description", ""),
            body,
            root,
            name,
            cta=meta.get("cta", True),
            extra_head=meta.get("head", ""),
            extra_js=meta.get("js", ""),
        )
        (ROOT / name).write_text(out, encoding="utf-8")
        print("built", name)
    print("built news:", len(items), "items")


if __name__ == "__main__":
    main()
