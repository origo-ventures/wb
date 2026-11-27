/* Control Panel schema: every editable section, which content file it edits and which fields it shows.
   Field types: text, link, textarea, paras, tags, select, bool, date, color, image, images, group, list, sep, contrast. */
(function () {
  'use strict';
  var BTN = function (key, label) { return { key: key, label: label, type: 'group', fields: [{ key: 'text', label: 'Button text', type: 'text' }, { key: 'link', label: 'Link (a page like contact.html, or https://…)', type: 'link' }] }; };
  var SEP = function (label) { return { type: 'sep', label: label }; };
  var TOG = function (key, label) { return { key: key, label: label, type: 'bool', def: true }; };
  var T = function (key, label, ph, hint) { return { key: key, label: label, type: 'text', ph: ph, hint: hint }; };
  var TA = function (key, label, rows, hint) { return { key: key, label: label, type: 'textarea', rows: rows || 3, hint: hint }; };
  var HERO = function () { return [T('eyebrow', 'Small label above the title'), T('title', 'Page title'), TA('lead', 'Intro paragraph', 3)]; };
  var OBJ = function (id, title, intro, sub, fields, extra) {
    var s = { id: id, group: 'Page text', title: title, intro: intro, file: 'pages.json', kind: 'object', sub: sub, dir: 'pages', fields: fields };
    if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
    return s;
  };
  var TITLE_TEXT = function (it) { return it.title || ''; };

  var SECTIONS = [
    /* ---------------- Page text ---------------- */
    OBJ('home', 'Home', 'Every heading, button, number and block on the Home page. Services, projects and testimonials shown here come from the Content group.', 'home', [
      SEP('Top of the page'), T('eyebrow', 'Small label above the title'), TA('title', 'Main title', 2), TA('lead', 'Intro line', 2), BTN('btn1', 'Button 1'), BTN('btn2', 'Button 2'),
      { key: 'marquee', label: 'Scrolling phrases (the moving strip under the top)', type: 'list', item: 'Phrase', titleFn: function (m) { return m.text || ''; }, fields: [T('text', 'Phrase')] },
      SEP('Numbers strip'), TOG('showStats', 'Show the numbers strip'),
      { key: 'stats', label: 'Numbers', type: 'list', item: 'Number', titleFn: function (s) { return (s.value || '') + (s.suffix || '') + ' ' + (s.label || ''); }, fields: [T('value', 'Number', '250', 'Digits only so it counts up (e.g. 250).'), T('suffix', 'After the number', '+', 'e.g. +, k, yrs'), T('label', 'Label')] },
      SEP('Services block'), TOG('showServices', 'Show the services block'), T('servicesEyebrow', 'Small label'), T('servicesTitle', 'Heading'), TA('servicesLead', 'Intro line', 2),
      SEP('Portfolio block'), TOG('showWork', 'Show the selected-work block (uses projects ticked "Featured")'), T('workEyebrow', 'Small label'), T('workTitle', 'Heading'),
      SEP('About block'), TOG('showAbout', 'Show the about block'), T('aboutEyebrow', 'Small label'), T('aboutTitle', 'Heading'), TA('aboutLead', 'Text', 3), { key: 'aboutImage', label: 'Photo', type: 'image' },
      SEP('Wedding countdown'), TOG('showCountdown', 'Show the wedding countdown'), T('countdownEyebrow', 'Small label'), T('countdownTitle', 'Heading'),
      SEP('Testimonial'), TOG('showTestimonial', 'Show one testimonial (the one ticked "Featured")')
    ]),
    OBJ('about', 'About', 'Text on the About page.', 'about', HERO().concat([
      SEP('Story'), T('storyEyebrow', 'Small label'), T('storyTitle', 'Heading'), { key: 'story', label: 'Story (blank line = new paragraph)', type: 'paras' }, { key: 'image', label: 'Photo', type: 'image' },
      SEP('Principles'), T('principlesEyebrow', 'Small label'), T('principlesTitle', 'Heading'),
      { key: 'principles', label: 'Principles', type: 'list', item: 'Principle', tk: 'title', fields: [T('title', 'Title'), TA('text', 'Text', 3)] },
      SEP('Timeline'), TOG('showTimeline', 'Show the timeline'), T('timelineEyebrow', 'Small label'), T('timelineTitle', 'Heading'),
      { key: 'timeline', label: 'Milestones', type: 'list', item: 'Milestone', titleFn: function (m) { return (m.year || '') + ' ' + (m.title || ''); }, fields: [T('year', 'Year'), T('title', 'Title'), TA('text', 'Text', 3)] }
    ])),
    OBJ('servicesText', 'Services page', 'Heading text and the process steps of the Services page. (The services themselves are under Content > Services.)', 'services', HERO().concat([
      SEP('Process'), T('processEyebrow', 'Small label'), T('processTitle', 'Heading'),
      { key: 'process', label: 'Steps', type: 'list', item: 'Step', tk: 'title', fields: [T('title', 'Title'), TA('text', 'Text', 3)] }
    ])),
    OBJ('portfolioText', 'Portfolio page', 'Heading text of the Portfolio page. (Projects are under Content > Projects.)', 'portfolio', HERO().concat([T('allLabel', 'Label of the "show all" filter button', 'All')])),
    OBJ('teamText', 'Team page', 'Heading text of the Team page. (People are under Content > Team.)', 'team', HERO()),
    OBJ('testimonialsText', 'Testimonials page', 'Heading text of the Testimonials page.', 'testimonials', HERO()),
    OBJ('faqText', 'FAQ page', 'Heading text of the FAQ page.', 'faq', HERO()),
    OBJ('contactText', 'Contact page', 'Texts of the Contact page. (Email, phone and address are under Site > Contact info.)', 'contact', HERO().concat([T('directTitle', 'Heading of the contact details'), T('responseTime', 'Response time', '', 'Shown with the contact details.'), T('formTitle', 'Heading of the enquiry area'), TA('formNote', 'Text of the enquiry area', 3)])),
    OBJ('menu', 'Menu', 'Names in the top menu. Leave a box empty to keep the default.', 'nav', [T('about', 'About', 'About'), T('services', 'Services', 'Services'), T('portfolio', 'Portfolio', 'Portfolio'), T('team', 'Team', 'Team'), T('cta', 'Button (top right)', 'Enquire')]),
    OBJ('footer', 'Footer', 'The copyright line in the footer of every page (the year is added automatically).', 'footer', [T('copyright', 'Copyright text', 'Wedding Berries. All rights reserved.')]),
    OBJ('cta', 'Call-to-action', 'The dark "Let\u2019s plan your day" block at the bottom of most pages.', 'cta', [T('eyebrow', 'Small label'), T('title', 'Title'), TA('text', 'Paragraph', 3), BTN('btn1', 'Button 1'), BTN('btn2', 'Button 2')]),
    OBJ('legal', 'Privacy and Terms', 'Text of the Privacy policy and Terms pages. Write or paste text approved by you or your legal adviser (blank line = new paragraph).', 'legal', [{ key: 'privacy', label: 'Privacy policy', type: 'paras', rows: 12 }, { key: 'terms', label: 'Terms', type: 'paras', rows: 12 }]),

    /* ---------------- Content ---------------- */
    { id: 'services', group: 'Content', title: 'Services', file: 'services.json', kind: 'list', dir: 'services', item: 'Service', tk: 'title',
      intro: 'Each service gets its own page. The first three also appear on the Home page.',
      fields: [T('title', 'Service name'), TA('summary', 'Short description (shown in lists)', 2), { key: 'description', label: 'Full description (blank line = new paragraph)', type: 'paras' }, { key: 'image', label: 'Photo', type: 'image' }] },
    { id: 'projects', group: 'Content', title: 'Projects', file: 'projects.json', kind: 'list', dir: 'projects', item: 'Project', tk: 'title',
      intro: 'Each project gets its own page with a photo gallery. Projects with the same Category are grouped under one filter button on the Portfolio page.',
      fields: [T('title', 'Couple / project name'), T('venue', 'Venue and city'), T('date', 'Date (text shown on the page)', '', 'e.g. 12 December 2026'), T('category', 'Category', '', 'Same spelling = same filter button.'),
        { key: 'featured', label: 'Featured (show on the Home page; first 3 are used)', type: 'bool' }, { key: 'cover', label: 'Cover photo', type: 'image' },
        { key: 'images', label: 'Gallery photos', type: 'images' }, { key: 'story', label: 'Story (blank line = new paragraph)', type: 'paras' }] },
    { id: 'team', group: 'Content', title: 'Team', file: 'team.json', kind: 'list', dir: 'team', item: 'Person', tk: 'name',
      intro: 'People shown on the Team page.',
      fields: [T('name', 'Name'), T('role', 'Role'), TA('bio', 'Short bio', 4), { key: 'photo', label: 'Photo (square works best)', type: 'image' }] },
    { id: 'testimonials', group: 'Content', title: 'Testimonials', file: 'testimonials.json', kind: 'list', dir: 'testimonials', item: 'Testimonial', tk: 'names',
      intro: 'Use real testimonials with the couple\u2019s permission. One ticked "Featured" appears on the Home page.',
      fields: [TA('quote', 'Testimonial', 4), T('names', 'Couple names'), T('event', 'Event (optional)'), { key: 'featured', label: 'Featured on the Home page', type: 'bool' }] },
    { id: 'faq', group: 'Content', title: 'FAQ', file: 'faq.json', kind: 'list', dir: 'faq', item: 'Question', tk: 'q',
      intro: 'Questions and answers on the FAQ page (also helps Google show them in search results).',
      fields: [T('q', 'Question'), TA('a', 'Answer', 4)] },

    /* ---------------- Site ---------------- */
    { id: 'brand', group: 'Site', title: 'Brand and logo', file: 'site.json', kind: 'object', sub: 'brand', dir: 'brand', intro: 'Business name, logo and website icon. The logo appears in the top menu, footer and the opening animation.',
      fields: [T('name', 'Business name'), T('tagline', 'Tagline'), SEP('Logo'),
        { key: 'logo', label: 'Logo (transparent PNG or SVG works best)', type: 'image', svg: true, alpha: true, max: 900 },
        { key: 'logoDark', label: 'Logo for dark backgrounds (footer). Optional.', type: 'image', svg: true, alpha: true, max: 900 },
        { key: 'logoHeight', label: 'Logo size in the menu', type: 'select', options: { small: 'Small', medium: 'Medium', large: 'Large' } },
        { key: 'showName', label: 'Also show the business name next to the logo', type: 'bool' },
        { key: 'footerWhite', label: 'If there is no dark-background logo, show the main logo in white in the footer', type: 'bool', def: true },
        SEP('Browser tab icon'), { key: 'favicon', label: 'Website icon (a square picture; it is cropped to a square automatically)', type: 'image', icon: 256 }] },
    { id: 'contactinfo', group: 'Site', title: 'Contact info', file: 'site.json', kind: 'object', sub: 'contact',
      intro: 'Shown in the footer and on the Contact page. Leave a box empty to hide it.',
      fields: [T('email', 'Email'), T('phone', 'Phone'), T('address', 'Studio address'),
        TA('mapQuery', 'Address for the Google map', 2, 'Type the full address. Empty = no map.'), { key: 'mapLink', label: 'Google Maps share link (optional)', type: 'link' },
        { key: 'showWhatsapp', label: 'Show the WhatsApp chat button on every page', type: 'bool' }, T('whatsapp', 'WhatsApp number', '+8801XXXXXXXXX', 'Empty = use the phone number above.'), T('whatsappText', 'First WhatsApp message')] },
    { id: 'contactform', group: 'Site', title: 'Contact form', file: 'form.json', kind: 'root',
      intro: 'The enquiry form on the Contact page: where messages go, which fields it has, how it looks and what it says. The heading and intro above the form are under Page text > Contact page. The form appears on the website only once it can deliver messages (a valid link, number or email below).',
      fields: [TOG('enabled', 'Show the enquiry form on the Contact page'),
        SEP('Where do enquiries go?'),
        { key: 'method', label: 'Delivery method', type: 'select', def: 'script', options: { script: 'Google Sheet + email (Google Apps Script, recommended)', whatsapp: 'Open WhatsApp with the message (needs a phone number in Site > Contact info)', email: 'Open the visitor\u2019s email app (needs an email in Site > Contact info)' } },
        { key: 'scriptUrl', label: 'Google Apps Script link (ends with /exec)', type: 'link', ph: 'https://script.google.com/macros/s/\u2026/exec', hint: 'Only for "Google Sheet + email". Step-by-step guide: docs/contact-form-setup.md in your repository. Code to paste: apps-script/Code.gs.' },
        SEP('Look'),
        { key: 'layout', label: 'Layout', type: 'select', def: 'two', options: { two: 'Two columns (short fields side by side)', single: 'One column' } },
        { key: 'look', label: 'Field style', type: 'select', def: 'boxed', options: { boxed: 'Boxed fields', underline: 'Underline only' } },
        SEP('Fields'),
        { key: 'fields', label: 'Form fields (drag order with Up / Down)', type: 'list', item: 'Field', titleFn: function (f) { return (f.label || '') + (f.required ? ' *' : ''); },
          fields: [T('label', 'Field name (also the column name in the Google Sheet)'),
            { key: 'type', label: 'Type', type: 'select', def: 'text', options: { text: 'Short text', email: 'Email', tel: 'Phone number', date: 'Date', number: 'Number', select: 'Drop-down list', textarea: 'Long text (message)' } },
            { key: 'required', label: 'Required', type: 'bool' },
            { key: 'width', label: 'Width (in two-column layout)', type: 'select', def: 'half', options: { half: 'Half', full: 'Full width' } },
            T('placeholder', 'Hint text inside the field (for a drop-down: the first, empty choice)'),
            { key: 'options', label: 'Choices for a drop-down (separate with commas)', type: 'tags' }] },
        SEP('Texts'),
        T('submitText', 'Send button text', 'Send enquiry'), T('sendingText', 'Text on the button while sending', 'Sending\u2026'),
        T('successTitle', 'Success heading', 'Thank you!'), TA('successText', 'Success message', 3), TA('errorText', 'Message if sending fails', 3),
        SEP('Consent'),
        TOG('consentOn', 'Ask visitors to tick a consent box (recommended)'), T('consentText', 'Consent text'),
        TOG('whatsappFallback', 'If sending fails, offer a "Message us on WhatsApp" link (uses the number in Site > Contact info)')] },
    { id: 'social', group: 'Site', title: 'Social links', file: 'site.json', kind: 'object', sub: 'social', intro: 'Leave a link empty to hide it.',
      fields: [{ key: 'facebook', label: 'Facebook', type: 'link' }, { key: 'instagram', label: 'Instagram', type: 'link' }, { key: 'youtube', label: 'YouTube', type: 'link' }, { key: 'tiktok', label: 'TikTok', type: 'link' }, { key: 'pinterest', label: 'Pinterest', type: 'link' }] },
    { id: 'seo', group: 'Site', title: 'Google and tracking', file: 'site.json', kind: 'root', intro: 'Default description for search results and the Google Analytics ID.',
      fields: [{ key: 'seo', type: 'group', label: 'Search results', fields: [TA('description', 'Default description (about 150 characters)', 3)] }, T('analyticsId', 'Google Analytics ID (optional)', 'G-XXXXXXXXXX')] },

    /* ---------------- Design ---------------- */
    { id: 'design', group: 'Design', title: 'Colours, fonts and effects', file: 'design.json', kind: 'root', intro: 'Change the look of the whole website. Effects can be switched off if the site feels too busy.',
      fields: [SEP('Colours'),
        { key: 'colors', type: 'group', label: 'Brand colours', fields: [{ key: 'berry', label: 'Main brand colour (buttons, links)', type: 'color' }, { key: 'rose', label: 'Rose accent', type: 'color' }, { key: 'gold', label: 'Gold detail', type: 'color' }, { key: 'ivory', label: 'Page background', type: 'color' }, { key: 'ink', label: 'Text colour', type: 'color' }] },
        { type: 'contrast' },
        SEP('Fonts'), { type: 'fontpairs' },
        { key: 'fonts', type: 'group', label: 'Your fonts', fields: [
          { key: 'display', type: 'fontpick', role: 'display', label: 'Display font (big titles and headings)' },
          { key: 'body', type: 'fontpick', role: 'body', label: 'Writing font (paragraphs, menu and buttons)' },
          { key: 'scale', label: 'Heading size', type: 'select', options: { small: 'Smaller', normal: 'Normal', large: 'Larger (good for script fonts)' } }] },
        SEP('Effects'), { key: 'effects', type: 'group', label: 'Turn effects on or off', fields: [TOG('preloader', 'Opening animation (first visit)'), { key: 'preloaderLength', label: 'Opening animation length', type: 'select', def: 'normal', options: { short: 'Short (1.7 seconds)', normal: 'Normal (2.7 seconds)', long: 'Long (3.7 seconds)' } }, TOG('petals', 'Falling petals'), TOG('cursor', 'Soft cursor ring (desktop)'), TOG('pageTransitions', 'Page fade between pages'), TOG('marquee', 'Scrolling phrase strip')] }] }
  ];

  window.WB_SCHEMA = {
    SECTIONS: SECTIONS,
    DEFAULTS: { 'form.json': {"enabled": true, "method": "script", "scriptUrl": "", "layout": "two", "look": "boxed", "fields": [{"label": "Your name", "type": "text", "required": true, "width": "half", "placeholder": "", "options": []}, {"label": "Email", "type": "email", "required": true, "width": "half", "placeholder": "", "options": []}, {"label": "Phone / WhatsApp", "type": "tel", "required": true, "width": "half", "placeholder": "", "options": []}, {"label": "Event date", "type": "date", "required": false, "width": "half", "placeholder": "", "options": []}, {"label": "Subject", "type": "select", "required": false, "width": "full", "placeholder": "Choose one", "options": ["Wedding", "Engagement", "Reception", "Other"]}, {"label": "Message", "type": "textarea", "required": true, "width": "full", "placeholder": "Tell us about your day", "options": []}], "submitText": "Send enquiry", "sendingText": "Sending…", "successTitle": "Thank you!", "successText": "Your message has been sent. We will get back to you soon.", "errorText": "We could not send your message. Please try again in a moment.", "consentOn": true, "consentText": "I agree to be contacted about my enquiry.", "whatsappFallback": true} },
    FILES: ['site.json', 'pages.json', 'services.json', 'projects.json', 'team.json', 'testimonials.json', 'faq.json', 'design.json', 'form.json'],
    PAGES: [['index.html', 'Home'], ['about.html', 'About'], ['services.html', 'Services'], ['portfolio.html', 'Portfolio'], ['team.html', 'Team'], ['testimonials.html', 'Testimonials'], ['contact.html', 'Contact'], ['faq.html', 'FAQ']]
  };
})();
