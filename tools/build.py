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
    "base_url": "https://aimipiano-fuchu.com",
    # サイトのルートのパス。https://aimi-piano-fuchu.github.io/ や独自ドメインなら "/"、https://<user>.github.io/<repo>/ なら "/<repo>/"
    # 404.html はどの深さのURLでも表示されるので、ここから絶対パスでCSSや画像を読む
    "abs_root": "/",
}

NAV = [
    ("index.html", "ホーム", "Home", "home"),
    ("about.html", "教室について", "About", "about"),
    ("lesson.html", "レッスン・月謝", "Lesson", "lesson"),
    ("teacher.html", "講師紹介", "Teacher", "teacher"),
    ("recital.html", "イベント", "Event", "event"),
    ("news/index.html", "お知らせ", "News", "news"),
    ("faq.html", "よくある質問", "FAQ", "faq"),
    ("access.html", "アクセス", "Access", "access"),
]

# スマホのメニューで項目の左に出す小さな絵（線画）
_NI = '<svg class="gnav__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{}</svg>'
NAV_ICONS = {
    "home": _NI.format('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
    "about": _NI.format('<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>'),
    "lesson": _NI.format('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v9M12 5v9M16 5v9"/><path d="M8 14v5M12 14v5M16 14v5" opacity=".5"/>'),
    "teacher": _NI.format('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
    "event": _NI.format('<path d="M12 3l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.3 6.8 19.1l1-5.8L3.5 9.2l5.9-.8z"/>'),
    "news": _NI.format('<path d="M4 10v4h3l6 4V6L7 10z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>'),
    "faq": _NI.format('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>'),
    "access": _NI.format('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>'),
}

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
    '<svg class="brand__mark" viewBox="-4 -7 108 108" aria-hidden="true">'
    '<path d="M 60.5 10.6 A 40 40 0 1 0 87.5 36" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/> <path d="M 22 93 L 57.5 3.5 L 63.5 71" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="miter" stroke-miterlimit="10"/> <ellipse cx="53.5" cy="74.5" rx="12.5" ry="9" transform="rotate(-24 53.5 74.5)" fill="currentColor"/> <path d="M 58.2 8.5 C 64 16, 78 18, 83.5 30 C 86.5 37, 84 44, 79 49 C 81 38, 74 30, 60.3 28.5 Z" fill="currentColor"/> <path d="M 33.5 64 L 62 60" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>'
    "</svg>"
)


def e(s):
    return html.escape(s, quote=True)


def header(root, current):
    items = []
    for href, label, en, icon in NAV:
        cur = ' aria-current="page"' if href == current or (current.startswith("news/") and href.startswith("news/")) else ""
        cls = ' class="gnav__home"' if href == "index.html" else ""
        items.append(f'<li{cls}><a href="{root}{href}"{cur}>{NAV_ICONS[icon]}<span class="gnav__label">{label}</span><span class="gnav__en">{en}</span></a></li>')
    items.append(
        f'<li class="gnav__ig"><a href="{SITE["instagram"]}" target="_blank" rel="noopener" aria-label="Instagram（新しいタブで開きます）">{ICONS["ig"]}<span class="gnav__ig-label">Instagram</span></a></li>'
    )
    items.append(
        f'<li class="gnav__cta"><a class="btn btn--primary btn--sm" href="{root}contact.html">お問い合わせ</a></li>'
    )
    return f"""<a class="skip" href="#main">本文へスキップ</a>
<header class="site-header" id="top">
  <div class="wrap site-header__inner">
    <a class="brand" href="{root}index.html">
      {LOGO}
      <span class="brand__text"><span class="brand__ja">{SITE['name']}</span><span class="brand__en">{SITE['name_en']}</span></span>
    </a>
    <a class="header-cta" href="{root}contact.html">お問い合わせ</a>
    <a class="header-home" href="{root}index.html">{NAV_ICONS["home"]}ホーム</a>
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
    <p><span class="nw">楽譜が読めなくても、</span><span class="nw">ピアノに触ったことがなくても</span><span class="nw">大丈夫です。</span><span class="nw">教室の雰囲気や先生との相性を、</span><span class="nw">30分の体験レッスンで</span><span class="nw">確かめてください。</span></p>
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
        <p>{SITE['name']}（愛実ピアノ教室）は、{SITE['area']}のピアノ教室です。リトミックを取り入れた個人レッスンで、3歳から大人の方（女性）まで一人ひとりに合わせて指導しています。</p>
        <a class="ig-link" href="{SITE['instagram']}" target="_blank" rel="noopener">{ICONS['ig']}@aimi_piano_</a>
      </div>
      <div>
        <h2>Menu</h2>
        <ul>
          <li><a href="{root}about.html">教室について</a></li>
          <li><a href="{root}lesson.html">レッスン・月謝</a></li>
          <li><a href="{root}teacher.html">講師紹介</a></li>
          <li><a href="{root}recital.html">イベント</a></li>
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


def breadcrumb_ld(body, current):
    """本文のパンくず（.crumbs）から BreadcrumbList の構造化データを作る。"""
    m = re.search(r'<ol class="crumbs">(.*?)</ol>', body, re.S)
    if not m or not SITE["base_url"]:
        return ""
    items = re.findall(r'<li>(?:<a href="([^"]*)">)?([^<]+)(?:</a>)?</li>', m.group(1))
    base = SITE["base_url"]
    here = current.replace("index.html", "")
    here = here[:-5] if here.endswith(".html") else here
    out = []
    for i, (href, name) in enumerate(items):
        if href:
            h = href.replace("../", "").replace("index.html", "")
            if h.endswith(".html"):
                h = h[:-5]
            if current.startswith("news/") and not href.startswith("../") and href != "":
                h = "news/" + h
            url = f"{base}/{h}"
        else:
            url = f"{base}/{here}"
        out.append({"@type": "ListItem", "position": i + 1, "name": html.unescape(name.strip()), "item": url})
    data = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": out}
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + "</script>"


def page(title, description, body, root="", current="", cta=True, extra_head="", extra_js="", full_title=None, og_image=None):
    if not full_title:
        # 検索結果で教室名が先に出るように「教室名｜ページ名」
        full_title = f"{SITE['name']}｜{title}" if title else f"{SITE['name']}｜府中市四谷のピアノ教室"
    canonical = ""
    og_url = ""
    og_image = f"{root}images/og.jpg"
    if SITE["base_url"] and current != "404.html":
        path = current if current else "index.html"
        clean = path.replace("index.html", "")
        clean = clean[:-5] if clean.endswith(".html") else clean
        canonical = f'<link rel="canonical" href="{SITE["base_url"]}/{clean}">'
        og_url = f'<meta property="og:url" content="{SITE["base_url"]}/{clean}">'
        og_image = og_image or f'{SITE["base_url"]}/images/og.jpg'
    return phrase_breaks(bust_cache(clean_links(f"""<!DOCTYPE html>
<html lang="ja" data-root="{root}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(full_title)}</title>
<meta name="description" content="{e(description)}">
<meta name="theme-color" content="#8A9AB0">
<meta name="msvalidate.01" content="BE1878E3A6D76EAEF1C8F0F5BFEA0041">
{canonical}
<meta property="og:type" content="website">
<meta property="og:site_name" content="{SITE['name']}">
<meta property="og:title" content="{e(full_title)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:image" content="{og_image}">
{og_url}
{breadcrumb_ld(body, current)}
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{root}images/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="{root}images/apple-touch-icon.png">
<link rel="preload" href="{root}fonts/shippori-600.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{root}css/style.css">
<script>document.documentElement.classList.add('js');setTimeout(function(){{[].forEach.call(document.querySelectorAll('.reveal'),function(e){{e.classList.add('is-in')}})}},4000)</script>
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
""")))


def clean_links(html_text):
    """サイト内リンクの .html を外す（GitHub Pages は /about で about.html を返す）。
    index.html はフォルダ名だけにする（index.html → ./、news/index.html → news/）。"""
    def fix(m):
        url, frag = m.group(1), m.group(2) or ""
        if ":" in url or url.startswith("//"):
            return m.group(0)
        if url.endswith("index.html"):
            url = url[: -len("index.html")] or "./"
        elif url.endswith(".html"):
            url = url[: -len(".html")]
        return f'href="{url}{frag}"'
    return re.sub(r'href="([^"#?]+?\.html)(#[^"]*)?"', fix, html_text)


_BUDOUX = None
# 長いカタカナ語は、狭い画面ではこの切れ目で折ってよい
SPLIT_WORDS = ["発表会|無事", "プライバシー|ポリシー", "ヤングアーチスト|ピアノ|コンクール", "ピアノ|コンクール", "オンライン|レッスン", "ダルクローズ|リトミック"]
KEEP_WORDS = ["その他", "習い事", "飾り付け", "やむを得ず", "いくつか", "一人ひとり", "ごほうび", "か月", "取り入れ", "身につけ", "読み書き", "例え", "うかがい", "よくある質問", "お一人", "その都度", "音楽そのもの", "お子さま", "問い合わせ", "体験レッスン", "ワンレッスン", "レッスン", "ピアノ教室", "リトミック",
              "ソルフェージュ", "コインパーキング", "ステップアップ", "グレード", "コンクール", "アイムホール", "バルトホール",
              "女性総合センター", "市民活動センター", "運営設備費", "入会金", "月謝", "発表会", "万願寺駅", "中河原駅", "矢川駅"]


def phrase_breaks(html_text):
    """日本語の文章に、文節の切れ目だけ <wbr> を入れる（BudouX）。
    CSS の word-break: keep-all と組み合わせて、iPhone の Safari でも単語の途中で改行されないようにする。
    <strong> などをまたいだ段落全体で文節を判定する（タグごとに切ると「体｜験料」のようにおかしくなる）。"""
    global _BUDOUX
    try:
        import budoux
    except ImportError:
        print("budoux がないので文節改行は省略（pip3 install budoux）")
        return html_text
    if _BUDOUX is None:
        _BUDOUX = budoux.load_default_japanese_parser()
    jp = re.compile(r"[\u3040-\u30ff\u3400-\u9fff]")
    ent = re.compile(r"&[#\w]+;")
    INLINE = {"strong", "b", "em", "i", "u", "span", "a", "small", "time", "mark", "wbr", "sup", "sub", "abbr", "cite", "q", "s"}
    NO_BEFORE = set("。、，．）」』】〕！？!?,.)ー～〜…・ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ％%円")
    NO_AFTER = set("（「『【〔(")

    def breaks_for(text):
        """text（エンティティは1文字に置換済み）の、改行してよい位置の集合"""
        if not jp.search(text):
            return set()
        pos, n = set(), 0
        for c in _BUDOUX.parse(text)[:-1]:
            n += len(c)
            pos.add(n)
        # 短いかっこ書き・1語として扱う言葉の中では切らない
        for m in re.finditer(r"（[^（）]{1,8}）|「[^「」]{1,10}」|\([^()]{1,8}\)", text):
            pos -= set(range(m.start() + 1, m.end()))
        for w in KEEP_WORDS:
            for m in re.finditer(re.escape(w), text):
                pos -= set(range(m.start() + 1, m.end()))
        # 漢字どうし・カタカナどうしの間では切らない（「年｜齢」「ソルフェー｜ジュ」を防ぐ）
        kan = re.compile(r"[\u3400-\u9fff々]")
        kata = re.compile(r"[\u30a0-\u30ffー]")
        def run(i, step):
            n, j = 0, i
            while 0 <= j < len(text) and kan.match(text[j]):
                n += 1
                j += step
            return n
        # 漢字の間は、どちらかが1文字だけのとき（「年｜齢」）は切らない。「以上｜練習」のような2字熟語どうしは切ってよい
        pos = {i for i in pos if not (0 < i < len(text) and (
            (kan.match(text[i - 1]) and kan.match(text[i]) and (run(i - 1, -1) < 2 or run(i, 1) < 2))
            or (kata.match(text[i - 1]) and kata.match(text[i]))))}
        for w in SPLIT_WORDS:
            for m in re.finditer(re.escape(w.replace("|", "")), text):
                k = m.start()
                for piece in w.split("|")[:-1]:
                    k += len(piece)
                    pos.add(k)
        # 長い文節（狭い画面で押し出されて変な位置で折れる）は「ように」などの後で折れるようにする
        n = 0
        for c in _BUDOUX.parse(text):
            if len(c) >= 9:
                for m in re.finditer(r"(ように|ことが|ことを|ための|について|として|なって|てきた|られる|できる)(?=.)", c):
                    if 3 <= m.end() <= len(c) - 3:
                        pos.add(n + m.end())
                # 「ウイルス｜感染拡大」「ピアノ｜発表会」のように、カタカナと漢字の境目でも折ってよい
                for k in range(3, len(c) - 2):
                    a, b = c[k - 1], c[k]
                    if (kan.match(a) and kata.match(b) and b != "ー") or (kata.match(a) and kan.match(b)):
                        pos.add(n + k)
            n += len(c)
        # 数字・英字の途中では切らない
        for m in re.finditer(r"[0-9A-Za-z,:.〜~\-]+", text):
            pos -= set(range(m.start() + 1, m.end()))
        # 句読点や閉じかっこの前、開きかっこの後では切らない
        emoji = re.compile(r"[\U0001F300-\U0001FAFF\u2600-\u27BF\u2728\u2B50]")
        return {i for i in pos if 0 < i < len(text) and text[i] not in NO_BEFORE and not emoji.match(text[i]) and text[i - 1] not in NO_AFTER
                and not text[i].isspace() and not text[i - 1].isspace()}

    head_end = html_text.find("<body")
    if head_end < 0:
        return html_text
    head, body = html_text[:head_end], html_text[head_end:]
    parts = re.split(r"(<script\b.*?</script>|<style\b.*?</style>|<textarea\b.*?</textarea>|<!--.*?-->|<[^>]+>)", body, flags=re.S)

    def is_inline(tag):
        m = re.match(r"</?\s*([a-zA-Z0-9]+)", tag)
        return bool(m) and m.group(1).lower() in INLINE

    out, group = [], []  # group: 同じ段落のテキスト部分の添字

    def flush():
        if not group:
            return
        # エンティティを1文字に置き換えて、段落全体の文字列を作る
        segs = []
        for gi in group:
            toks = re.split(r"(&[#\w]+;)", out[gi])
            segs.append(toks)
        flat = "".join("\uE000" if ent.fullmatch(t) else t for toks in segs for t in toks)
        pos = breaks_for(flat)
        off = 0
        for gi, toks in zip(group, segs):
            res = []
            for t in toks:
                if ent.fullmatch(t):
                    if off in pos and res:
                        res.append("<wbr>")
                    res.append(t)
                    off += 1
                    continue
                for ch in t:
                    if off in pos and (res or True):
                        res.append("<wbr>")
                    res.append(ch)
                    off += 1
            out[gi] = "".join(res)
        group.clear()

    for p in parts:
        if not p:
            continue
        if p.startswith("<"):
            if not is_inline(p):
                flush()
            out.append(p)
        else:
            out.append(p)
            group.append(len(out) - 1)
    flush()
    t = "".join(out)
    # タグの直前・直後に重なった <wbr> を整理
    t = re.sub(r"(<wbr>)+", "<wbr>", t)
    t = re.sub(r"<wbr>(\s*<wbr>)+", "<wbr>", t)
    # 「9:00〜18:00」「30〜40分」の〜の前後と、「／」の前では折らない（U+2060 WORD JOINER）
    def wj(x):
        if x.startswith("<"):
            return x
        x = re.sub(r"(?<=[0-9０-９])〜(?=[0-9０-９])", "\u2060〜\u2060", x)
        x = re.sub(r"(?<=\S)〜(?=[0-9０-９])", "\u2060〜\u2060", x)
        # 閉じかっこの直後の助詞、文の直後の絵文字の前では折らない
        x = re.sub(r"(?<=[』」）)])(?=[\u3041-\u309f])", "\u2060", x)
        x = re.sub(r"(?<=[\u3040-\u9fff！？!?。、♪])(?=[\U0001F300-\U0001FAFF\u2600-\u27BF])", "\u2060", x)
        return re.sub(r"(?<=\S)／", "\u2060／", x)
    t = "".join(wj(x) for x in re.split(r"(<script\b.*?</script>|<style\b.*?</style>|<[^>]+>)", t, flags=re.S))
    return head + t


def bust_cache(html_text):
    """css/js の URL に中身のハッシュを付ける。更新したら必ず新しいファイルが読まれる（GitHub Pages は10分キャッシュするため）。"""
    import hashlib
    def fix(m):
        attr, url = m.group(1), m.group(2)
        local = ROOT / re.sub(r"^(\.\./|/)+", "", url)
        if not local.exists():
            return m.group(0)
        h = hashlib.md5(local.read_bytes()).hexdigest()[:8]
        return f'{attr}="{url}?v={h}"'
    return re.sub(r'(src|href)="((?:\.\./|/)?(?:css|js)/[^"?#]+\.(?:css|js))"', fix, html_text)


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


def fetch_admin_posts():
    """管理画面から投稿したお知らせを GAS から取得（静的ページにして検索に載せる）。失敗しても build は続ける。"""
    import urllib.request
    cfg = (ROOT / "js" / "config.js").read_text(encoding="utf-8")
    m = re.search(r"formEndpoint:\s*'([^']+)'", cfg)
    if not m:
        return []
    try:
        with urllib.request.urlopen(m.group(1) + "?action=news", timeout=60) as r:
            data = json.loads(r.read().decode("utf-8"))
        posts = data.get("posts") or []
        print("admin posts:", len(posts))
        posts = [p for p in posts if "テスト" not in p.get("title", "")]  # 動作確認用の投稿は載せない
        return [{"id": p["id"], "title": p["title"], "date": p["date"], "categories": [p.get("category") or "お知らせ"],
                 "body": p.get("body", ""), "images": p.get("images", []), "embeds": [], "admin": True} for p in posts]
    except Exception as err:
        print("admin posts: skipped", err)
        return []


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
    items += fetch_admin_posts()
    items.sort(key=lambda x: x["date"], reverse=True)
    return items


def fmt_date(d):
    return d.replace("-", ".")


def news_row(item, root):
    cat = item["categories"][0]
    return (
        f'<li data-cat="{e(cat)}" data-id="{e(item["id"])}"><a class="news-item" href="{root}news/{item["id"]}.html">'
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
    order = ["お知らせ", "イベント", "活動報告", "とある日のレッスン", "NEW生徒さん", "レッスンについて", "アイテム紹介", "演奏動画", "その他"]
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
        page("お知らせ・教室日記", "あいみピアノ教室からのお知らせと、レッスン・発表会の様子を綴った教室日記です。", body, root, "news/index.html",
             extra_js='<script src="../js/config.js"></script><script src="../js/news.js" defer></script>'),
        encoding="utf-8",
    )

    dyn = f"""<section class="section section--tight">
  <div class="wrap wrap--narrow">
    <ol class="crumbs"><li><a href="{root}index.html">ホーム</a></li><li><a href="index.html">お知らせ</a></li><li>記事</li></ol>
    <article class="article" id="dyn-article"><p class="field__hint">読み込んでいます…</p></article>
  </div>
</section>"""
    (out_dir / "p.html").write_text(
        page("お知らせ", "あいみピアノ教室からのお知らせ", dyn, root, "news/p.html",
             extra_head='<meta name="robots" content="noindex">', extra_js='<script src="../js/config.js"></script><script src="../js/news.js" defer></script>'),
        encoding="utf-8",
    )

    # 同じ題名の記事（NEW生徒さん♪ など）は年月を付けて区別する
    from collections import Counter
    counts = Counter(it["title"] for it in items)
    ov_path = SRC / "news-overrides.json"
    overrides = json.loads(ov_path.read_text(encoding="utf-8")) if ov_path.exists() else {}
    for it in items:
        o = overrides.get(it["id"], {})
        it["page_title"] = o.get("title") or (f'{it["title"]}（{int(it["date"][:4])}年{int(it["date"][5:7])}月）' if counts[it["title"]] > 1 else it["title"])
    month_counts = Counter(it["page_title"] for it in items)
    for it in items:
        if month_counts[it["page_title"]] > 1 and it["page_title"].endswith("月）"):
            it["page_title"] = it["page_title"][:-1] + f'{int(it["date"][8:10])}日）'
        o = overrides.get(it["id"], {})
        it["note"] = o.get("note", "")
        # 本文がほぼ無い記事・動画告知・古い募集記事は検索に出さない（一覧には残す）
        it["noindex"] = bool(o.get("noindex")) or (len(it["body"]) < 80 and not it["id"].startswith("20")) or "Instagramに動画" in it["title"]

    for i, it in enumerate(items):
        newer = items[i - 1] if i > 0 else None
        older = items[i + 1] if i + 1 < len(items) else None
        imgs = "".join(
            f'<img src="{src if src.startswith("http") else root + src}" alt="「{e(it["title"])}」の写真 {n + 1}" loading="lazy" referrerpolicy="no-referrer">' for n, src in enumerate(it["images"])
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
      <h1>{e(it["page_title"])}</h1>
      {f'<p class="pill-note">{e(it["note"])}</p>' if it["note"] else ''}
      {f'<div class="article__body">{body_text}</div>' if body_text else ''}
      {f'<div class="article__images">{imgs}</div>' if imgs else ''}
      {embeds}
      {nav}
      <p><a class="btn btn--ghost btn--sm" href="index.html">お知らせ一覧へ戻る</a></p>
      <p class="field__hint">あいみピアノ教室は府中市四谷のピアノ教室です。<a href="{root}contact.html">体験レッスンのお申し込み</a>／<a href="{root}access.html">アクセス</a>／<a href="{root}lesson.html">レッスン・月謝</a></p>
    </article>
  </div>
</section>"""
        ld = {"@context": "https://schema.org", "@type": "BlogPosting", "headline": it["title"][:110],
              "datePublished": it["date"], "author": {"@type": "Person", "name": "野口愛実"},
              "publisher": {"@type": "Organization", "name": SITE["name"]},
              "mainEntityOfPage": f'{SITE["base_url"]}/news/{it["id"]}'}
        abs_imgs = [src if src.startswith("http") else f'{SITE["base_url"]}/{src}' for src in it["images"][:3]]
        if abs_imgs:
            ld["image"] = abs_imgs
        (out_dir / f'{it["id"]}.html').write_text(
            page(it["page_title"], desc, art, root, "news/" + it["id"] + ".html", og_image=(abs_imgs[0] if abs_imgs else None),
                 extra_head=('<meta name="robots" content="noindex">' if it["noindex"] else "") + '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + "</script>"),
            encoding="utf-8",
        )
    return items


def subset_font():
    """フォントを自前で配信するために、使う文字だけに絞って fonts/ に書き出す。
    明朝（見出し用）は見出しなど明朝で表示する部分の文字だけ、Cormorant（英字ラベル）は英数字だけ。"""
    import glob as _glob
    import html as _html
    from html.parser import HTMLParser
    try:
        from fontTools import subset as _subset
        from fontTools.varLib import instancer
        from fontTools.ttLib import TTFont
    except ImportError:
        print("fontTools がないのでフォントの作り直しは省略")
        return

    display_tags = {"h1", "h2", "h3", "h4"}
    display_classes = {"brand__ja", "concept__quote", "cycle__node", "facts__value", "merits", "day__name", "teacher__name",
                       "timeline__what", "poster", "hero__badge", "course__price", "cta__price", "step__no", "numbered",
                       "slots__title", "admin-day__head", "admin-tabs", "cycle__center"}

    class P(HTMLParser):
        def __init__(self):
            super().__init__()
            self.stack, self.chars = [], set()
        def handle_starttag(self, tag, attrs):
            if tag in ("br", "img", "input", "meta", "link", "wbr", "source"):
                return
            cls = set((dict(attrs).get("class") or "").split())
            self.stack.append(tag in display_tags or bool(cls & display_classes))
        def handle_endtag(self, tag):
            if self.stack and tag not in ("br", "img", "input", "meta", "link", "wbr", "source"):
                self.stack.pop()
        def handle_data(self, data):
            if any(self.stack):
                self.chars |= set(data)

    chars = set("0123456789０１２３４５６７８９!?.,:;()[]'\"-+/&%#@*=_~ 　、。・「」『』（）！？：；ー―〜～／…①②③④")
    chars |= {chr(c) for c in range(0x3041, 0x3097)} | {chr(c) for c in range(0x30A1, 0x30FB)}  # ひらがな・カタカナ全部
    chars |= set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
    for f in _glob.glob(str(ROOT / "*.html")) + _glob.glob(str(ROOT / "news" / "*.html")):
        pp = P()
        pp.feed(Path(f).read_text(encoding="utf-8"))
        chars |= pp.chars
    for f in _glob.glob(str(ROOT / "js" / "*.js")):  # 画面に出す見出し（完了パネルなど）
        chars |= set("".join(re.findall(r"'([^'\n]*)'", Path(f).read_text(encoding="utf-8"))))
    text = "".join(sorted(c for c in chars if ord(c) >= 0x20))
    (ROOT / "fonts").mkdir(exist_ok=True)

    def save(src, out, txt, wght=None):
        opts = _subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["kern", "liga", "palt"]
        font = TTFont(str(ROOT / "tools" / "fonts" / src))
        if wght and "fvar" in font:
            font = instancer.instantiateVariableFont(font, {"wght": wght})
        sub = _subset.Subsetter(opts)
        sub.populate(text=txt)
        sub.subset(font)
        _subset.save_font(font, str(ROOT / "fonts" / out), opts)

    save("ShipporiMincho-SemiBold.ttf", "shippori-600.woff2", text)
    latin = "".join(chr(c) for c in range(0x20, 0x7F)) + "–—’“”…·&"
    save("CormorantGaramond-VF.ttf", "cormorant-500.woff2", latin, wght=500)
    save("CormorantGaramond-Italic-VF.ttf", "cormorant-500i.woff2", latin, wght=500)
    print("font subset:", len(text), "chars", {p.name: p.stat().st_size for p in (ROOT / "fonts").glob("*.woff2")})

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
        if name == "faq.html":
            qa = re.findall(r"<summary>(.*?)</summary>\s*<div class=\"answer\">(.*?)</div>", body, re.S)
            ents = [{"@type": "Question", "name": html.unescape(re.sub(r"<[^>]+>", "", q)).strip(),
                     "acceptedAnswer": {"@type": "Answer", "text": html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", a))).strip()}} for q, a in qa]
            meta["head"] = meta.get("head", "") + '<script type="application/ld+json">' + json.dumps(
                {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": ents}, ensure_ascii=False) + "</script>"
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
            full_title=meta.get("full_title"),
            extra_js=meta.get("js", ""),
        )
        (ROOT / name).write_text(out, encoding="utf-8")
        print("built", name)
    print("built news:", len(items), "items")
    subset_font()
    write_sitemap(items)


def write_sitemap(items):
    """sitemap.xml と robots.txt。URLは .html なし。管理画面と404は載せない。"""
    base = SITE["base_url"]
    pages = ["", "about", "lesson", "teacher", "recital", "news/", "faq", "access", "contact", "privacy"]
    import datetime
    today = datetime.date.today().isoformat()
    entries = [(f"{base}/{p}", today) for p in pages] + [(f"{base}/news/{it['id']}", it["date"]) for it in items if not it.get("noindex")]
    urls = [u for u, _ in entries]
    body = "".join(f"  <url><loc>{e(u)}</loc><lastmod>{d}</lastmod></url>\n" for u, d in entries)
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + body + "</urlset>\n",
        encoding="utf-8",
    )
    (ROOT / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {base}/sitemap.xml\n", encoding="utf-8")
    print("sitemap:", len(urls), "urls")


if __name__ == "__main__":
    main()
