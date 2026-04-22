-- ============================
-- Migration 005: rooms.source_url_normalized for dedup
-- ============================

alter table public.rooms
  add column if not exists source_url_normalized text;

-- Backfill: 各 source_url について最古の 1 件にだけ値を入れる。
-- 既存の重複ルームは normalized=null のまま残り、ユニーク索引と衝突しない。
with oldest_per_url as (
  select source_url, min(created_at) as first_at
  from public.rooms
  where source_url is not null
  group by source_url
)
update public.rooms r
set source_url_normalized = r.source_url
from oldest_per_url o
where r.source_url = o.source_url
  and r.created_at = o.first_at
  and r.source_url_normalized is null;

-- 部分ユニーク索引: null は複数許容、値が入っているものは一意
create unique index if not exists rooms_source_url_normalized_key
  on public.rooms(source_url_normalized)
  where source_url_normalized is not null;
