// GET /api/recipe?url=https://...  → {title, ingredients, steps, memo, source}
const dec = s => String(s || '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&nbsp;/g, ' ')
  .trim();

const isRecipe = n => n && [].concat(n['@type'] || []).includes('Recipe');
function findRecipe(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const x of node) { const r = findRecipe(x); if (r) return r; } return null; }
  if (isRecipe(node)) return node;
  return findRecipe(node['@graph']);
}
function steps(v) {
  if (!v) return [];
  if (typeof v === 'string') return dec(v).split('\n').map(s => s.trim()).filter(Boolean);
  if (Array.isArray(v)) return v.flatMap(steps);
  if (v.itemListElement) return steps(v.itemListElement);
  return steps(v.text || v.name || '');
}
function meta(html, prop) {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i'));
  const c = m && m[0].match(/content=["']([^"']*)["']/i);
  return c ? dec(c[1]) : '';
}
function extract(html) {
  let recipe = null;
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) && !recipe) {
    try { recipe = findRecipe(JSON.parse(m[1].trim())); } catch (e) {}
  }
  const title = (recipe && dec(recipe.name)) || meta(html, 'og:title') ||
    dec((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
  if (recipe) {
    const ing = [].concat(recipe.recipeIngredient || []).map(dec).filter(Boolean);
    return { title, ingredients: ing.join('\n'), steps: steps(recipe.recipeInstructions).join('\n'),
             memo: '', structured: true };
  }
  // SNS・構造化データなし: 説明文だけメモに入れる
  return { title, ingredients: '', steps: '', memo: meta(html, 'og:description'), structured: false };
}

function blocked(u) {
  const h = u.hostname;
  return !/^https?:$/.test(u.protocol) || h === 'localhost' || h.endsWith('.local') ||
    /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[)/.test(h);
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=3600');
  let u;
  try { u = new URL(req.query.url); } catch (e) { return res.status(400).json({ error: 'URLが不正です' }); }
  if (blocked(u)) return res.status(400).json({ error: 'このURLは取得できません' });
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(u.hostname)) {
    try {
      const o = await fetch('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(u.href), { signal: AbortSignal.timeout(6000) });
      if (o.ok) { const j = await o.json();
        return res.status(200).json({ title: j.title || '', ingredients: '', steps: '', memo: '', structured: false, video: true, source: u.href }); }
    } catch (e) {}
  }
  try {
    const r = await fetch(u, {
      redirect: 'follow', signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
                 'Accept-Language': 'ja,en;q=0.8' }
    });
    if (!r.ok) return res.status(502).json({ error: `取得失敗 (${r.status})` });
    const html = (await r.text()).slice(0, 2_000_000);
    res.status(200).json({ ...extract(html), source: u.href });
  } catch (e) {
    res.status(502).json({ error: '取得できませんでした' });
  }
};
module.exports.extract = extract;
