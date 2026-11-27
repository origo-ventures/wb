# Contact form setup

Everything about the form (fields, texts, look, where messages go) is edited in the **Control Panel > Site > Contact form**.
This guide connects the recommended delivery method: **Google Sheet + email** using a free Google Apps Script. Every enquiry is saved in a Google Sheet first, then emailed to you.

## 1. Create the sheet and paste the code (5 minutes)

1. Create a new Google Sheet (for example "Wedding Berries enquiries").
2. In the sheet: **Extensions > Apps Script**. Delete the sample code.
3. Open `apps-script/Code.gs` from this repository, copy everything and paste it in.
4. At the top of the code set `NOTIFY_EMAIL` to the address that should receive enquiries (for example `contact@weddingberriesbd.com`). Optional: change `SITE_NAME`, the auto-reply text, `COOLDOWN_SECONDS`, `DAILY_LIMIT`.
5. Click **Save**.

## 2. Publish it as a web app

1. **Deploy > New deployment > Select type (gear) > Web app**.
2. *Execute as*: **Me**. *Who has access*: **Anyone**.
3. **Deploy**, allow the permissions Google asks for (it needs your Sheet and Gmail to save rows and send mail), and copy the **Web app URL** (it ends with `/exec`).

## 3. Connect it to the website

1. Open the Control Panel > **Site > Contact form**.
2. Delivery method: **Google Sheet + email**. Paste the URL into **Google Apps Script link**.
3. **Save to GitHub**. Wait for the rebuild.
4. Open the Contact page, send a test message. A new row appears in the sheet (tab "Inquiries") and an email arrives.

## Important

- **After every edit of Code.gs** you must publish a new version: **Deploy > Manage deployments > pencil icon > Version: New version > Deploy**. Otherwise Google keeps running the old code (the usual cause of "script function not found" or no emails).
- The sheet columns follow the field names in the Control Panel. If you add a field, a new column is added automatically.
- Gmail limits scripts to about 100 emails a day on a free account (about 1500 on Google Workspace). The auto-reply to visitors counts too; set `SEND_AUTOREPLY: false` if you expect many enquiries.
- Spam protection: a hidden field bots fill in, a short wait before the first submit, a cooldown per visitor and a daily limit.
- Other delivery methods (no Google account needed): **WhatsApp** opens WhatsApp with the message filled in; **Email** opens the visitor's own email app. These need a phone number / email in Site > Contact info, and the visitor must press Send themselves.

## If messages do not arrive

1. Control Panel > Tools > Launch checklist: "The contact form can deliver messages" must say DONE.
2. Open the Apps Script link in a browser: it should say "... endpoint is running."
3. In Apps Script: **Executions** (left menu) shows each submission and any error.
4. Check the Spam folder of `NOTIFY_EMAIL`. Replies go to the visitor because their email is set as reply-to.
