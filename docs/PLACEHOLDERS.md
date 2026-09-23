# Guide to {{placeholders}}

Placeholders let you write one article and personalize it for each selected WordPress site. The app replaces them with saved site information or uploaded images before creating a draft. This is a deterministic substitution: no AI and no WordPress plugin or shortcode is involved.

These placeholders are not WordPress post tags or categories. The finished post contains ordinary text, links, and image HTML.

## Quick reference

| Placeholder | What it inserts | Example site value |
| --- | --- | --- |
| `{{practice_name}}` | Practice name | Blue & Gold Eye Care |
| `{{doctor_name}}` | Doctor name, exactly as configured | Evelyn Hart, M.D. |
| `{{city}}` | City | Portland |
| `{{phone}}` | Phone number, exactly as configured | (503) 555-0100 |
| `{{appointment_url}}` | Appointment page URL | https://example.com/appointments/ |
| `{{image:exam-room}}` | A complete inline image element | The image you choose for exam-room |

The text fields above are conventions used by the sample site registry. They must be configured for each target site; the app does not look them up automatically.

## Text personalization

Use text placeholders in the **Title**, **Article HTML**, or **Excerpt**:

```text
Eye care in {{city}} with {{practice_name}}
```

```html
<p>{{doctor_name}} welcomes you to {{practice_name}} in {{city}}.</p>
<p>Call {{phone}} to learn more.</p>
```

For a site configured with Evelyn Hart, M.D., Blue & Gold Eye Care and Portland, that paragraph becomes:

```html
<p>Evelyn Hart, M.D. welcomes you to Blue & Gold Eye Care in Portland.</p>
```

For another site, the same source article uses that site's values instead. Titles such as “Dr.” are not added automatically: if your configured doctor_name already includes “Dr.”, do not also type it before the placeholder.

Values are inserted as text, with HTML-sensitive characters escaped. A value such as `Smith & Jones` displays correctly. Do not store HTML markup inside personalization values.

## Links

To make a clickable appointment link, put the URL placeholder inside a quoted href attribute:

```html
<p><a href="{{appointment_url}}">Book an appointment at {{practice_name}}</a>.</p>
```

Putting `{{appointment_url}}` in a paragraph by itself inserts URL text; it does not automatically create a link. All personalization keys ending in `_url` require values beginning with `https://`.

A phone number is also plain text by default. If you want a phone link, configure an additional field such as `phone_digits` with `+15035550100`, then use:

```html
<a href="tel:{{phone_digits}}">{{phone}}</a>
```

## Inline images

1. In **Article HTML**, put an image placeholder between paragraphs or other HTML elements:

   ```html
   <p>Take a look inside our practice.</p>
   {{image:exam-room}}
   <p>We look forward to seeing you.</p>
   ```

2. An image row named **exam-room** appears under **Images** automatically.
3. Click **Choose File** and choose a JPEG, PNG or WebP file, up to 10 MB.
4. Enter **Alt text**, such as “Eye examination room with a vision chart.” Alt text is an image description, not a visible caption. Use literal text here; alt text placeholders are not expanded in v0.1.
5. Add additional placeholders with different keys for more images, for example `{{image:eye-diagram}}`.

Choosing a file saves it locally. Confirming draft creation uploads the image separately to each site's Media Library. The app replaces the placeholder with a complete element, conceptually:

```html
<img src="https://target-site.example/uploads/exam-room.jpg"
     alt="Eye examination room with a vision chart.">
```

The actual URL comes from that site's upload response. Repeating the same image placeholder repeats the image in the article without requiring another file selection or another upload on that site.

**Do not put image placeholders inside an img tag.** They produce the whole tag, not just a URL:

```html
<!-- Correct -->
{{image:exam-room}}

<!-- Incorrect -->
<img src="{{image:exam-room}}">
```

Use image placeholders only in Article HTML, not the title, excerpt, or HTML attributes. In v0.1, all selected sites receive the same source image and alt text for each asset key; there is no per-site image mapping.

## Featured image options

| Option | Behavior |
| --- | --- |
| None | No featured image. Inline images still work. |
| Separate featured image | Adds a `featured` file picker. The image is assigned as the featured image; it is not automatically inserted in the article. |
| Use inline: exam-room | Assigns that inline image as the featured image too, reusing its upload on each site. |

Use descriptive inline keys such as `exam-room`; keep `featured` for the separate featured-image slot to avoid confusing the two controls.

## Naming rules

- Use two opening and two closing braces: `{{city}}`.
- Names are case-sensitive. Use lowercase: `{{city}}`, not `{{City}}`.
- Text keys start with a letter and can contain lowercase letters, numbers and underscores: `{{office_hours}}`.
- Image keys can contain lowercase letters, numbers and hyphens: `{{image:exam-room}}`. Do not use spaces or underscores in image keys.
- Spaces around a text key are accepted (`{{ city }}`), but the compact form is easiest to use consistently. Keep image syntax exactly as shown.
- Placeholders can repeat. There are no conditionals, loops, filters, default values or nested placeholders.
- Do not use placeholders as HTML tag names or attribute names. Attribute values must be quoted.
- Only title, article content and excerpt undergo text substitution. File names, alt text, article IDs and site configuration values are not templates.

## Adding a new personalization field

In `config/sites.json`, add the key under the `personalization` object for every site that will use it. For example, this is a partial site configuration:

```json
{
  "personalization": {
    "practice_name": "Blue & Gold Eye Care",
    "doctor_name": "Evelyn Hart, M.D.",
    "city": "Portland",
    "phone": "(503) 555-0100",
    "appointment_url": "https://example.com/appointments/",
    "office_hours": "Monday–Friday, 8 AM–5 PM"
  }
}
```

Merge the new field into the existing object; preserve the site's ID, URL, group, author/category mappings and other values. Then use `{{office_hours}}` in your article. No code change is needed. Keep credentials out of this file.

## Preflight and troubleshooting

| Message or symptom | What to check |
| --- | --- |
| Missing personalization: phone | That site's personalization.phone is missing or blank. Add it, or remove the placeholder from your article. |
| Invalid placeholder | Check spelling, lowercase letters, underscores for text keys and the braces. |
| Missing image / Choose a local file | Select the file for that image key. Imported article JSON references local assets; it does not include the image bytes. |
| Unresolved or malformed placeholder | Look for missing braces, unsupported syntax, or braces embedded in a configured value. |
| appointment_url must be an HTTPS URL | Configure the full URL beginning with https://. |
| Image placeholders must appear between HTML tags | Remove the surrounding img tag and use the image placeholder on its own. |

Missing data blocks only the affected site during preflight; other ready sites can proceed. The app does not silently replace a missing value with an empty string.

After changing article inputs or site configuration, run **Preflight** again, open a personalized **Preview**, and explicitly confirm before creating drafts. Inspect each site's draft in WordPress to verify its final appearance.
