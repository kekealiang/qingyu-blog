-- 音乐播放列表（元数据存 D1；音频文件本体在 Cloudflare R2，url 为公开可读地址）
CREATE TABLE IF NOT EXISTS music (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  artist     TEXT DEFAULT '',
  url        TEXT NOT NULL,
  cover      TEXT DEFAULT '',
  size       INTEGER DEFAULT 0,
  duration   INTEGER DEFAULT 0,
  sort       INTEGER DEFAULT 0,
  created_at TEXT DEFAULT ''
);