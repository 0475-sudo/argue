/**
 * ルーム間の類似度を評価して関連候補を抽出する。
 * タイトルの最長共通部分文字列 (5文字以上) を条件とし、
 * 同ホストの場合はスコアを加点する。
 */

export type RoomLike = {
  id: string;
  title: string;
  source_url: string | null;
  source_url_normalized: string | null;
  status: string;
};

export type RelatedRoom = RoomLike & {
  matchReason: string;
  score: number;
};

const MIN_OVERLAP = 5;
const SAME_HOST_BOOST = 3;

export function findRelatedRooms(
  current: RoomLike,
  candidates: RoomLike[],
  limit = 5
): RelatedRoom[] {
  const currentHost = extractHost(
    current.source_url_normalized ?? current.source_url
  );
  const currentTitle = normalizeTitle(current.title);

  const scored: RelatedRoom[] = [];

  for (const c of candidates) {
    if (c.id === current.id) continue;

    const candidateHost = extractHost(
      c.source_url_normalized ?? c.source_url
    );
    const candidateTitle = normalizeTitle(c.title);

    const overlap = findLongestCommonSubstring(currentTitle, candidateTitle);
    const sameHost =
      currentHost !== null &&
      candidateHost !== null &&
      currentHost === candidateHost;

    if (overlap.length < MIN_OVERLAP) continue;

    const score = overlap.length + (sameHost ? SAME_HOST_BOOST : 0);
    const reason = sameHost
      ? `同じ ${candidateHost} /「${overlap}」`
      : `「${overlap}」を含む`;

    scored.push({ ...c, matchReason: reason, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

function extractHost(url: string | null): string | null {
  if (!url) return null;
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h.startsWith("www.") ? h.slice(4) : h;
  } catch {
    return null;
  }
}

function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ");
}

/**
 * 最長共通部分文字列 (連続一致) を DP で求める。
 * O(m*n) メモリ節約のため 2 行分だけ保持。
 */
function findLongestCommonSubstring(a: string, b: string): string {
  if (!a || !b) return "";
  const m = a.length;
  const n = b.length;
  let maxLen = 0;
  let endIdx = 0;
  let prev = new Uint32Array(n + 1);
  let curr = new Uint32Array(n + 1);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        if (curr[j] > maxLen) {
          maxLen = curr[j];
          endIdx = i;
        }
      } else {
        curr[j] = 0;
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }

  return a.slice(endIdx - maxLen, endIdx);
}
