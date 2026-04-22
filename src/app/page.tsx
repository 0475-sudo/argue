import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const categoryLabels: Record<string, string> = {
  politics: "政治",
  technology: "テクノロジー",
  society: "社会",
  education: "教育",
  environment: "環境",
  other: "その他",
};

const statusLabels: Record<string, string> = {
  open: "募集中",
  active: "進行中",
  closed: "終了",
};

const statusColors: Record<string, string> = {
  open: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  active: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  closed: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function Home(props: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await props.searchParams;
  const query = q?.trim() ?? "";
  const supabase = await createClient();

  let roomsQuery = supabase
    .from("rooms")
    .select("id, title, description, category, status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (query) {
    // PostgREST の ilike はワイルドカードに % を使う。
    // ユーザー入力に % / _ が含まれるとメタ文字扱いされるのでエスケープ。
    const escaped = query.replace(/([%_\\])/g, "\\$1");
    roomsQuery = roomsQuery.ilike("title", `%${escaped}%`);
  }

  const { data: rooms } = await roomsQuery;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <section className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          議論を、もっと建設的に。
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Argue は
          AIモデレーターが議論の質を高める次世代ディスカッションプラットフォームです。
          テーマごとのディベートルームで意見を交わし、AIが論点整理・ファクトチェック・要約をリアルタイムで行います。
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/room/new"
            className="rounded-full bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            ルームを作成
          </Link>
          {!user && (
            <Link
              href="/signup"
              className="rounded-full border border-zinc-300 px-6 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              アカウント作成
            </Link>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            ディベートルーム
          </h2>
        </div>

        <form
          role="search"
          action="/"
          method="get"
          className="mb-6 flex items-center gap-2"
        >
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="タイトルで検索"
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            検索
          </button>
          {query && (
            <Link
              href="/"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-900"
            >
              クリア
            </Link>
          )}
        </form>

        {!rooms || rooms.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-500 dark:text-zinc-400">
              {query
                ? `「${query}」に一致するルームが見つかりませんでした。`
                : "まだルームがありません。最初のディベートルームを作成しましょう！"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {rooms.map((room) => (
              <Link
                key={room.id}
                href={`/room/${room.id}`}
                className="group rounded-lg border border-zinc-200 p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[room.status] ?? statusColors.open}`}
                  >
                    {statusLabels[room.status] ?? room.status}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {categoryLabels[room.category] ?? room.category}
                  </span>
                </div>
                <h3 className="mb-1 font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-300">
                  {room.title}
                </h3>
                {room.description && (
                  <p className="line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {room.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-zinc-400">
                  {new Date(room.created_at).toLocaleDateString("ja-JP")}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
