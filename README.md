# あいみピアノ教室 ホームページ

東京都府中市四谷「あいみピアノ教室」の公式サイト（GitHub Pages で公開する静的サイト）。

## 更新のしかた

ページの本文は `src/pages/*.html`、共通のヘッダー・フッターは `tools/build.py` にあります。
直したら次を実行すると、サイト直下の HTML が作り直されます。

```
python3 tools/build.py
```

- お知らせを追加：`src/news-extra.json` に1件足して build（写真は `images/` に置いてパスを書く）
- 旧ブログの写真を非表示：`src/news-hide.json` にファイル名を足して build
- 旧ブログ（Ameba Ownd）の記事データ：`news-data/posts.json`（177件・2020〜2024）

## お問い合わせフォーム

`gas/Code.gs` を教室の Google アカウントで Apps Script にデプロイし、
出た URL を `js/config.js` の `formEndpoint` に入れる。空のままだとフォームは「準備中」表示になる。

## 独自ドメイン

ドメインを取ったら `CNAME` ファイルを作り、`tools/build.py` の `SITE["base_url"]` を設定して build。
