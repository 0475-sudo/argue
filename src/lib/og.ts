/**
 * URLからタイトルを取得する。
 * YouTube / TikTok は公式 oEmbed API を使用。
 * Instagram / その他は HTML の OGP / <title> タグから抽出。
 * 取得失敗時は null を返す（投稿処理は止めない）。
 */
export async function fetchOgTitle(url: string): Promise<string | null> {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace("www.", "");

    // YouTube (youtube.com/shorts/*, youtu.be/*, youtube.com/watch*)
    if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com") {
      return await fetchYouTubeTitle(url);
    }

    // TikTok
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
      return await fetchTikTokTitle(url);
    }

    // Instagram
    if (host === "instagram.com") {
      return await fetchHtmlTitle(url);
    }

    // その他: HTML から OGP / <title> を抽出
    return await fetchHtmlTitle(url);
  } catch {
    return null;
  }
}

/**
 * YouTube oEmbed API
 * https://oembed.com/providers にある公式エンドポイント
 */
async function fetchYouTubeTitle(url: string): Promise<string | null> {
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.title ?? null;
  } catch {
    return null;
  }
}

/**
 * TikTok oEmbed API
 * https://developers.tiktok.com/doc/embed-oembed/
 */
async function fetchTikTokTitle(url: string): Promise<string | null> {
  try {
    const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.title ?? null;
  } catch {
    return null;
  }
}

/**
 * 根拠 URL の可視テキストを抽出する（ファクトチェック用）。
 * 取得失敗・HTML以外の場合は null。タグを除去した本文を最大 maxChars 文字まで返す。
 */
export async function fetchEvidenceText(
  url: string,
  maxChars = 8000
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      return null;
    }

    const html = await res.text();

    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    if (!stripped) return null;

    return stripped.length > maxChars
      ? stripped.slice(0, maxChars) + "…（以下省略）"
      : stripped;
  } catch {
    return null;
  }
}

/**
 * HTML の og:title または <title> タグからタイトルを抽出する。
 * Instagram 等でブロックされた場合は null を返す。
 */
async function fetchHtmlTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const html = await res.text();
    const head = html.slice(0, 10000);

    // og:title を優先
    const ogMatch =
      head.match(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
      ) ??
      head.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i
      );

    if (ogMatch?.[1]) return ogMatch[1].trim();

    // フォールバック: <title>
    const titleMatch = head.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) return titleMatch[1].trim();

    return null;
  } catch {
    return null;
  }
}
