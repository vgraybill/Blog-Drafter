import { createHash } from 'node:crypto';

export const hash = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function resolve(text, values, images = {}, html = false) {
  const result = String(text || '').replace(/{{\s*([^{}]+?)\s*}}/g, (_, raw) => {
    const key = raw.trim();
    if (key.startsWith('image:')) {
      if (!html) throw new Error('Image placeholders belong in content only.');
      const image = images[key.slice(6)];
      if (!image) throw new Error(`Missing image: ${key.slice(6)}`);
      return `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}">`;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(key)) throw new Error(`Invalid placeholder: ${key}`);
    const value = Object.hasOwn(values, key) ? values[key] : undefined;
    if (value === undefined || value === null || String(value).trim() === '') throw new Error(`Missing personalization: ${key}`);
    if (key.endsWith('_url') && !/^https:\/\//i.test(String(value))) throw new Error(`${key} must be an HTTPS URL.`);
    return html ? escapeHtml(value) : String(value);
  });
  if (/{{|}}/.test(result)) throw new Error('Unresolved or malformed placeholder.');
  return result;
}
export function requiredAssets(article) {
  return [...new Set([...(article.content.matchAll(/{{\s*image:([a-z0-9-]+)\s*}}/g)).map(m => m[1]), ...(article.featured ? [article.featured] : [])])];
}
export function render(article, site, images) {
  return {title:resolve(article.title, site.personalization, {}, true), content:resolve(article.content, site.personalization, images, true), excerpt:resolve(article.excerpt, site.personalization, {}, true)};
}
export function validateArticle(article) {
  if (!article || !/^[a-zA-Z0-9_-]{1,80}$/.test(article.id || '')) throw new Error('Article ID must contain 1–80 letters, numbers, underscores or hyphens.');
  for (const key of ['title','content']) if (typeof article[key] !== 'string' || !article[key].trim()) throw new Error(`${key} is required.`);
  if (article.title.length > 1000 || article.content.length > 500000) throw new Error('Article is too large.');
  if (article.excerpt !== undefined && typeof article.excerpt !== 'string') throw new Error('Excerpt must be text.');
  // Keep the initial HTML contract small: no executable tags or unquoted attributes.
  if (/<\s*(script|iframe|object|embed|style|link|meta|base|form|svg|math)\b/i.test(article.content) || /\bon[a-z]+\s*=/i.test(article.content) || /(?:javascript|vbscript|data)\s*:/i.test(article.content)) throw new Error('Content contains unsupported active HTML. Use ordinary article HTML.');
  for (const tag of article.content.matchAll(/<[^>]+>/g)) {
    if (/{{\s*image:/.test(tag[0])) throw new Error('Image placeholders must appear between HTML tags, not inside attributes.');
    if (/=\s*[^\s"']/.test(tag[0])) throw new Error('HTML attribute values must be quoted.');
  }
  for (const key of requiredAssets(article)) if (!article.assets?.[key]?.assetId) throw new Error(`Choose a local file for image: ${key}`);
  return article;
}
