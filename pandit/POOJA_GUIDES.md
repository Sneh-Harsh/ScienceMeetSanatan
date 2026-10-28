# Pooja Vidhi guides: how to update the content

The guides on the Pandit Booking page (`/pandits/`) are plain data. Nothing about a ritual is written in the
page code.

| File | What it holds |
|---|---|
| `static/pandit/pooja/guides.json` | The guides: preparation, samagri, ordered steps, mantras, sources, review status |
| `static/pandit/pooja/images.json` | The Cloudinary image configuration, one entry per guide |
| `static/pandit/pooja.js` / `pooja.css` | The library and the step-by-step reader (read-only code; no content) |
| `static/pandit/vendor/` | Vanilla-JS adaptations of React Bits *Glass Surface*, *Specular Button* and *Silk* (hero background, saffron `#FF9933`); licence notice inside each file |

## Review status (important)

Every guide carries a `review` object.

* `draft-pandit-review-needed`: shown as **"Draft — Pandit Review Needed"**. This is the status of both guides today.
* `reviewed-approved`: shown as **"Reviewed and Approved"**. Set it **only** after a knowledgeable pandit has actually reviewed the guide, and fill in
  `reviewedBy` and `reviewedOn`. A test (`test_pooja_guides.py`) fails if the status says "reviewed" without those fields.
* `in-preparation`: the guide appears in the library but has **no steps at all** (the test enforces this).

## Guide shape (`guides.json`)

```
guides[]
  id, name{en,hi}, deity{en,hi}, summary{en,hi}, tradition{en,hi}, duration (null unless a source states it)
  availability: "documented" | "in-preparation"
  review{status,label,reviewedBy,reviewedOn,note}
  havan: null | {...}      havanNote: why there is no havan (only add a havan when the procedure documents it)
  variation{en,hi}         regional / family differences
  preparation{conduct[], conductNote, samagri[{id,name,essential,note}], substitution}
  steps[]
    id, group ("prep"|"upa"|"close"), number, title{en,hi}, do{en,hi}, materials[samagri ids]
    mantras[{id, devanagari, transliteration, meaning{en,hi}, optional?, note?}]
    after, notes[], safety, variation, optional?
    pending{en,hi}         a step whose text is NOT included yet (it shows "Not available yet": never invent a mantra)
    sources[{source, cite}]  source = a key of top-level "sources"
sources{ key: {title, publisher, url|null, note} }
```

All optional fields can be left out. To add a guide, add an entry (copy `ganesh-puja`), keep `availability: "in-preparation"`
until the steps are complete, and give it a row in `images.json`.

## Where the current content comes from

All fifteen guides are readable (including Bhai Dooj, Chitragupta Puja and Chhath Puja). Each opens with cleaning the house/place, purification, setting up the
chowki and idol, then the preparatory rites, the main puja, aarti and closing prayers.

* **Mantras and aartis** were researched from public pages (Veda Union, BhaktiBharat, Vedic Pañcāṅg/ Drik Panchang, Wikisource, Kavita Kosh,
  Arya Samaj Agnihotra text, Pāraskara/Āśvalāyana Gṛhya-sūtra editions, and others; each guide lists its own sources). A script checked that every
  Devanagari text appears **verbatim** in the saved copy of the page it cites; texts that failed were dropped. The Sanskrit is therefore copied,
  never retyped. The **transliteration (IAST) is machine-generated** from the Devanagari. The **Hindi and English meanings and the plain-language
  instructions were written for this site** and need a pandit's review.
* **Sixteen-step worship, prep steps and closing prayers** (Ganesh, Lakshmi, Other and inside Satyanarayan / Griha Pravesh) come from the Veda Union
  pūjā class. **Licence / permission:** that site states no licence; please ask for written permission (or have your pandit supply the texts).
* **Not included yet:** each guide lists its own gaps (shown as "Not included yet"). Long Vedic recitations (full Rudram, Satyanarayan katha
  chapters, full wedding mantras, Prithvi Sukta beyond four verses, mandala deity lists) are marked "pending", never invented. The saṅkalpa wording is
  not sourced. Aarti wording varies between sites and families.
* **Havan** appears only in the Havan guide (with fire-safety first), in Griha Pravesh and Navagraha where the sources include it, and in Vastu/Bhoomi
  as a pointer. Other guides state that no havan is included.
* **Regional variation:** no Bihar (Maithil / Bhojpuri / Magahi) sources were found. Every guide needs a Bihar pandit's review.
* Meanings of some mantras are loose renderings (e.g. the Bhoomi water-pouring mantra) and are flagged for review.

## Images (Cloudinary)

`images.json` maps each guide id to a Cloudinary asset.

* `status: "supplied"` + `publicId` shows the image (delivered through Cloudinary with automatic format/quality, 4:3 crop, responsive widths, lazy loading).
* `status: "placeholder"` + `publicId: null` shows a labelled "Image coming soon" tile, never a made-up picture.
* `resourceType: "video"` uses the first frame of a video already in your Media Library (that is how the four current images work: they are frames of the
  Ganesha / Lakshmi / Shiva / Vishnu clips already used on the Baby Names page). Use `"image"` for a normal upload.

To replace or add an image: upload it in the Cloudinary Media Library (Media Library → Upload), copy its **public ID** (for example
`v1712345678/ganesha-puja_abc123`), and set `publicId`, `resourceType`, `alt` and `attribution` in `images.json`. Only use images you own or are licensed to use.
**Never put an API key or secret in this file** (a test checks for that). There is deliberately no public upload tool: uploads must go through your
Cloudinary account (or an authenticated admin workflow), never an open form.

## WhatsApp number

`WHATSAPP_NUMBER` at the top of `static/pandit/booking.js` is the only place to change it (country code + number, digits only).

## Deity images (added)

Eleven pictures were taken from Wikimedia Commons (public domain, CC0 or CC BY-SA 4.0 only) and uploaded to the Cloudinary folder `sms/pooja`.
Each entry in `images.json` records its `license` and `sourceUrl`, and the credit line is shown on the picture. Substitutions to review: Griha Pravesh
shows Ganesha with Riddhi and Siddhi, Bhai Dooj shows Yama alone, Vivah shows Rama and Sita at the swayamvara. Replace any of them by uploading your
own artwork and changing `publicId` (set `fit` to `pad` for a wide image).

## Coming-up festivals (`pooja/festivals.json`)

Dates for Patna from Drik Panchang (each entry has its `sourceUrl`; 2026-10 to 2027-12). The library shows a "Coming up" band, puts guides for festivals
in the next 45 days first with a ribbon, and offers a "Coming up" filter. A real festival outranks a monthly vrat (Sankashti, Pradosh, Purnima).
Refresh the file each year (rebuild from the panchang) and re-check dates against your own panchang. Known doubts: Govardhan Puja 2026 (Nov 9 vs 10),
two-day tithis, Shravan Somvar 2027 derived from Purnima dates.

## Vrat Katha library (`pooja/kathas.json`, `pooja/katha/*.pdf`)

Only texts that are free to redistribute are included: five Skanda Purana chapters from Sanskrit Wikisource (CC BY-SA 4.0): Satyanarayan katha (with the
Hindi translation on Wikisource), Yama Dwitiya (Bhai Dooj), Prabodhini Ekadashi, Bhishma Panchaka (Kartik Purnima) and Vaikuntha Chaturdashi. PDFs were made from
that text with the credit and licence on the last page; keep the credit if you reuse them. They are uploaded to Cloudinary (`sms/katha/*`) and shown
page by page from there. **Cloudinary blocks direct PDF delivery by default** (HTTP 401): "Open/Download PDF" therefore serves the copy in `pooja/katha/`.
To serve PDFs from Cloudinary instead, enable "PDF and ZIP files delivery" in Cloudinary Settings → Security.
Not found under a free licence: Chhath, Chitragupta, Diwali/Lakshmi, Dhanteras, Karwa Chauth, Santoshi Mata, Tulsi Vivah (most are only in modern
copyrighted books). Two scanned PDFs (Ganesh Chaturthi 1956, a Shivratri manuscript) were held back because their licence could not be verified.
