import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function ProfilePage(
  props: PageProps<"/profile/[id]">
) {
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, created_at")
    .eq("id", id)
    .single();

  if (!profile) {
    notFound();
  }

  const { data: arguments_ } = await supabase
    .from("arguments")
    .select("id, stance, content, created_at, room_id, rooms(title)")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const initial = (profile.username || "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center gap-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200 text-2xl font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {initial}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {profile.username}
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            {new Date(profile.created_at).toLocaleDateString("ja-JP")}
            に参加
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          参加したディベート
        </h2>
        {!arguments_ || arguments_.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm text-zinc-500">
              まだディベートに参加していません
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {arguments_.map((arg) => (
              <Link
                key={arg.id}
                href={`/room/${arg.room_id}`}
                className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      arg.stance === "for"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400"
                        : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                    }`}
                  >
                    {arg.stance === "for" ? "同じです" : "ほかにもあります"}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {((arg.rooms as unknown as { title: string } | null))?.title ?? "不明なルーム"}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {arg.content}
                </p>
                <p className="mt-2 text-xs text-zinc-400">
                  {new Date(arg.created_at).toLocaleDateString("ja-JP")}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
