/**
 * あいみピアノ教室 お問い合わせフォーム受信（Google Apps Script）
 *
 * 1. Google アカウントで script.new を開き（単体のスクリプト）、このファイルの中身を貼る。
 *    受付記録のスプレッドシートは初回のお問い合わせで自動作成される。
 * 2. 「プロジェクトの設定 → スクリプト プロパティ」に
 *      NOTIFY_EMAILS = 通知を受け取るアドレス（複数ならカンマ区切り）
 *    を追加する。（個人のアドレスを公開リポジトリに書かないため、コードには入れない）
 * 3. 「デプロイ → 新しいデプロイ → 種類：ウェブアプリ」
 *      次のユーザーとして実行：自分
 *      アクセスできるユーザー：全員
 *    で出た URL を、サイトの js/config.js の formEndpoint に入れる。
 * 4. 直したときは「デプロイを管理 → 鉛筆 → バージョン：新しいバージョン」で更新する。
 *    （「新しいデプロイ」を作ると URL が変わってフォームが止まる）
 *
 * 5. 空き枠の管理画面（admin.html）用に、「プロジェクトの設定 → スクリプト プロパティ」で
 *      ADMIN_ACCOUNTS = 管理画面に入れる人。「メールアドレス パスコード」を1人ずつ（改行かスペース区切り）
 *                       例）hanako@example.com abcd1234 taro@example.com efgh5678
 *    （パスコードはここにだけ置く。サイトやGitHubには書かない）
 *    を追加する。空き枠データもスクリプト プロパティ（SLOTS）に保存される。
 *
 * MailApp を使う（GmailApp はパスワード変更で認証が切れやすいので使わない）。
 */

var SHEET_NAME = 'お問い合わせ';
var SCHOOL = 'あいみピアノ教室';

// ---- 空き枠：サイトが読む（GET ?action=slots）
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'slots') {
    var raw = PropertiesService.getScriptProperties().getProperty('SLOTS');
    return json_({ result: 'success', slots: raw ? JSON.parse(raw) : null });
  }
  return json_({ result: 'error', message: 'unknown action' });
}

function doPost(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'checkPass') return json_(checkPass_(p.id, p.pass) ? { result: 'success' } : { result: 'error', message: 'pass' });
  if (p.action === 'saveSlots') return saveSlots_(p);
  return contact_(p);
}

// ID（メールアドレス）とパスコードの確認。10分間に10回まちがえたら、しばらく受け付けない
function checkPass_(id, pass) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('pass_fails') || 0);
  if (fails >= 10) return false;
  // 「メール パスコード」の組を順に読む（改行でもスペース区切りの1行でも可）
  var words = String(PropertiesService.getScriptProperties().getProperty('ADMIN_ACCOUNTS') || '').trim().split(/\s+/);
  var who = String(id || '').trim().toLowerCase();
  var ok = false;
  for (var i = 0; i + 1 < words.length; i += 2) {
    if (who && pass && words[i].toLowerCase() === who && words[i + 1] === pass) ok = true;
  }
  if (!ok) cache.put('pass_fails', String(fails + 1), 600);
  return ok;
}

function saveSlots_(p) {
  if (!checkPass_(p.id, p.pass)) return json_({ result: 'error', message: 'pass' });
  try {
    var data = JSON.parse(p.slots);
    if (!data || !Array.isArray(data.days)) throw new Error('bad data');
    data.updated = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
    var text = JSON.stringify(data);
    if (text.length > 8000) throw new Error('too large');
    PropertiesService.getScriptProperties().setProperty('SLOTS', text);
    return json_({ result: 'success', slots: data });
  } catch (err) {
    return json_({ result: 'error', message: String(err) });
  }
}

// ---- お問い合わせフォーム
function contact_(p) {
  try {
    if (!p.name || !p.email) return json_({ result: 'error', message: 'missing fields' });

    var row = [
      new Date(), p.type || '', p.name || '', p.kana || '', p.age || '', p.experience || '',
      p.days || '', p.times || '', p.email || '', p.tel || '', p.message || ''
    ];
    sheet_().appendRow(row);

    var body =
      'ホームページからお問い合わせがありました。\n\n' +
      '内容：' + p.type + '\n' +
      'お名前：' + p.name + '（' + (p.kana || '') + '）\n' +
      '年齢：' + p.age + '\n' +
      'ピアノ経験：' + (p.experience || '') + '\n' +
      '希望曜日：' + (p.days || '') + '\n' +
      '希望日時：' + (p.times || '') + '\n' +
      'メール：' + p.email + '\n' +
      '電話：' + (p.tel || '') + '\n\n' +
      'ご要望・ご質問：\n' + (p.message || '') + '\n';
    var notify = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAILS');
    if (notify) MailApp.sendEmail(notify, '【HP】' + p.type + '（' + p.name + '様）', body, { replyTo: p.email, name: SCHOOL });

    var reply =
      p.name + ' 様\n\n' +
      SCHOOL + 'です。お問い合わせありがとうございます。\n' +
      '以下の内容で受け付けました。\n\n' +
      '――――――――――\n' + body.replace('ホームページからお問い合わせがありました。\n\n', '') + '――――――――――\n\n' +
      '※まだ予約は確定していません。内容を確認のうえ、あらためてご連絡いたします。\n' +
      '※このメールは送信専用です。\n\n' + SCHOOL + '\nhttps://www.instagram.com/aimi_piano_/\n';
    MailApp.sendEmail(p.email, '【' + SCHOOL + '】お問い合わせを受け付けました', reply, { name: SCHOOL });

    return json_({ result: 'success' });
  } catch (err) {
    console.error(err);
    return json_({ result: 'error', message: String(err) });
  }
}

// 受付記録のスプレッドシート。単体のスクリプトなら初回に自動で作り、IDを覚えておく
function sheet_() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var id = props.getProperty('SHEET_ID');
    ss = id ? SpreadsheetApp.openById(id) : null;
    if (!ss) {
      ss = SpreadsheetApp.create('あいみピアノ教室 お問い合わせ記録');
      props.setProperty('SHEET_ID', ss.getId());
    }
  }
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['受付日時', '内容', 'お名前', 'フリガナ', '年齢', 'ピアノ経験', '希望曜日', '希望日時', 'メール', '電話', 'ご要望・ご質問']);
    sh.setFrozenRows(1);
  }
  return sh;
}

// 最初に一度だけ手動で実行して、メール送信とスプレッドシートの権限を許可する
function setup() {
  sheet_();
  MailApp.getRemainingDailyQuota();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
