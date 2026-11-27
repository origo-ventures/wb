/**
 * Wedding Berries: contact form endpoint (Google Apps Script web app).
 *
 * What it does for every enquiry sent from the website:
 *   1. saves it as a new row in a Google Sheet (tab "Inquiries"; columns follow your form fields),
 *   2. emails you a notification (reply-to is the visitor),
 *   3. optionally emails the visitor an automatic "we received your message",
 *   4. blocks spam (hidden honeypot field, per-visitor cooldown, daily limit).
 *
 * SETUP: see docs/contact-form-setup.md. After EVERY edit of this file you must deploy a NEW VERSION
 * (Deploy > Manage deployments > pencil > Version: New version > Deploy), otherwise the old code keeps running.
 */
var CONFIG = {
  SHEET_ID: '',               // leave empty if this script was opened from the Google Sheet (Extensions > Apps Script)
  SHEET_NAME: 'Inquiries',
  NOTIFY_EMAIL: '',           // REQUIRED for notifications, e.g. 'contact@weddingberriesbd.com'
  SITE_NAME: 'Wedding Berries',
  SEND_AUTOREPLY: true,
  AUTOREPLY_SUBJECT: 'We received your message',
  AUTOREPLY_TEXT: 'Thank you for contacting {site}. We have received your message and will reply soon.',
  COOLDOWN_SECONDS: 45,       // the same visitor cannot send again for this long
  DAILY_LIMIT: 300,           // maximum enquiries accepted per day
  MAX_FIELD_LENGTH: 4000
};

function doGet() {
  return ContentService.createTextOutput(CONFIG.SITE_NAME + ' contact form endpoint is running.');
}

function doPost(e) {
  var p = (e && e.parameter) || {};
  var id = String(p._id || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
  try {
    if (p.website) return reply_('ok', id);                                  // honeypot filled: pretend success, store nothing
    var fields = clean_(p);
    var keys = Object.keys(fields);
    if (!keys.length) return reply_('err', id, 'Please fill in the form.');
    var email = findEmail_(fields);
    var who = (email || fields[keys[0]] || '').toLowerCase().slice(0, 80);

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var cache = CacheService.getScriptCache();
      var ck = 'cd_' + Utilities.base64EncodeWebSafe(who).slice(0, 60);
      if (cache.get(ck)) return reply_('err', id, 'Please wait a minute before sending another message.');
      var props = PropertiesService.getScriptProperties();
      var day = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'UTC', 'yyyy-MM-dd');
      var counter = props.getProperty('day') === day ? parseInt(props.getProperty('count') || '0', 10) : 0;
      if (counter >= CONFIG.DAILY_LIMIT) return reply_('err', id, 'We are receiving a lot of messages right now. Please try again later.');
      saveRow_(fields, p._page);
      props.setProperty('day', day); props.setProperty('count', String(counter + 1));
      cache.put(ck, '1', CONFIG.COOLDOWN_SECONDS);
    } finally {
      lock.releaseLock();
    }

    try { notify_(fields, email, p._page); } catch (err) { console.error('notify failed: ' + err); }       // a mail problem must never lose the saved row
    try { autoreply_(email); } catch (err2) { console.error('autoreply failed: ' + err2); }
    return reply_('ok', id);
  } catch (err3) {
    console.error(err3);
    return reply_('err', id, 'Something went wrong. Please try again later.');
  }
}

/* ---------------- helpers ---------------- */
function reply_(status, id, msg) {
  var payload = JSON.stringify({ wb: status, id: id, msg: msg || '' }).replace(/</g, '\\u003c');
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><script>window.top.postMessage(' + payload + ',"*");</script>' + (status === 'ok' ? 'OK' : 'Error'))
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function clean_(p) {
  var out = {};
  Object.keys(p).forEach(function (k) {
    if (k.charAt(0) === '_' || k === 'website') return;
    var v = String(p[k] == null ? '' : p[k]).replace(/\r/g, '').trim().slice(0, CONFIG.MAX_FIELD_LENGTH);
    if (v) out[String(k).slice(0, 80)] = v;
  });
  return out;
}

function findEmail_(fields) {
  var found = '';
  Object.keys(fields).forEach(function (k) {
    if (!found && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields[k]) && /mail/i.test(k)) found = fields[k];
  });
  return found;
}

function sheet_() {
  var ss = CONFIG.SHEET_ID ? SpreadsheetApp.openById(CONFIG.SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  return sh;
}

function safeCell_(v) {                       // stop spreadsheet formula injection
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function saveRow_(fields, page) {
  var sh = sheet_();
  var last = sh.getLastColumn();
  var header = last ? sh.getRange(1, 1, 1, last).getValues()[0].map(String) : [];
  if (!header.length) header = ['Timestamp'];
  Object.keys(fields).forEach(function (k) { if (header.indexOf(k) < 0) header.push(k); });
  if (header.indexOf('Page') < 0) header.push('Page');
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  var row = header.map(function (h) {
    if (h === 'Timestamp') return new Date();
    if (h === 'Page') return safeCell_(String(page || '').slice(0, 200));
    return fields[h] ? safeCell_(fields[h]) : '';
  });
  sh.appendRow(row);
}

function esc_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function notify_(fields, email, page) {
  if (!CONFIG.NOTIFY_EMAIL) return;
  var keys = Object.keys(fields);
  var text = keys.map(function (k) { return k + ': ' + fields[k]; }).join('\n') + '\n\nPage: ' + (page || '');
  var html = '<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif">' + keys.map(function (k) {
    return '<tr><td style="border:1px solid #ddd;background:#f7f2ee"><b>' + esc_(k) + '</b></td><td style="border:1px solid #ddd">' + esc_(fields[k]).replace(/\n/g, '<br>') + '</td></tr>';
  }).join('') + '</table>';
  var opts = { htmlBody: html, name: CONFIG.SITE_NAME + ' website' };
  if (email) opts.replyTo = email;
  MailApp.sendEmail(CONFIG.NOTIFY_EMAIL, 'New enquiry from ' + CONFIG.SITE_NAME + ' website' + (email ? ' (' + email + ')' : ''), text, opts);
}

function autoreply_(email) {
  if (!CONFIG.SEND_AUTOREPLY || !email) return;
  MailApp.sendEmail(email, CONFIG.AUTOREPLY_SUBJECT, CONFIG.AUTOREPLY_TEXT.replace('{site}', CONFIG.SITE_NAME), { name: CONFIG.SITE_NAME });
}
