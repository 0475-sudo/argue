/**
 * ルーム重複排除のための URL 正規化。
 * - host を小文字化し `www.` を剥がす
 * - トラッキングパラメータを除去
 * - 主要 SNS / 動画サービスの表記ゆれを寄せる (twitter ↔ x, youtu.be → youtube.com)
 * - fragment と末尾スラッシュを除去
 *
 * 失敗時は入力をそのまま返す（呼び出し側でバリデーションする前提）。
 */
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_name",
  "fbclid",
  "gclid",
  "gclsrc",
  "yclid",
  "msclkid",
  "mc_eid",
  "mc_cid",
  "ref",
  "ref_src",
  "ref_url",
  "_hsenc",
  "_hsmi",
  "hsctatracking",
  "igshid",
  "igsh",
  "si",
  "feature",
  "spm",
]);

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());

    // Host 正規化
    let host = u.hostname.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    if (host === "mobile.twitter.com" || host === "twitter.com") host = "x.com";
    if (host === "m.youtube.com") host = "youtube.com";

    // youtu.be → youtube.com/watch?v=ID
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (id) {
        host = "youtube.com";
        u.pathname = "/watch";
        u.searchParams.set("v", id);
      }
    }
    u.hostname = host;

    // クエリからトラッキングパラメータを除去
    const keep: [string, string][] = [];
    for (const [k, v] of u.searchParams.entries()) {
      if (!TRACKING_PARAMS.has(k.toLowerCase())) {
        keep.push([k, v]);
      }
    }
    // 並び順を安定させるためキーでソート
    keep.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    u.search = "";
    for (const [k, v] of keep) u.searchParams.append(k, v);

    // Fragment は常に破棄
    u.hash = "";

    // X/Twitter の /photo/N, /video/N サフィックスを落とす
    if (host === "x.com") {
      u.pathname = u.pathname.replace(/\/(photo|video)\/\d+$/i, "");
    }

    // 末尾スラッシュ除去 (ルートは維持)
    if (u.pathname.length > 1 && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }

    return u.toString();
  } catch {
    return raw.trim();
  }
}
