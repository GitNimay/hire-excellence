-- Profile snapshot from Clerk, refreshed whenever the user writes something
CREATE TABLE users (
  id         TEXT PRIMARY KEY,           -- Clerk user id
  name       TEXT NOT NULL,
  image_url  TEXT,
  headline   TEXT,
  updated_at INTEGER NOT NULL
);

-- A post, or a repost when repost_of is set (then body is empty and media is NULL)
CREATE TABLE posts (
  id            TEXT PRIMARY KEY,
  author_id     TEXT NOT NULL REFERENCES users(id),
  body          TEXT NOT NULL DEFAULT '',
  media         TEXT,                    -- JSON [{ "key": "...", "type": "image/png" }]
  repost_of     TEXT REFERENCES posts(id) ON DELETE CASCADE,
  like_count    INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  repost_count  INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL         -- epoch ms
);
CREATE INDEX posts_created ON posts(created_at DESC);
CREATE INDEX posts_author_created ON posts(author_id, created_at DESC);
CREATE UNIQUE INDEX posts_repost_once ON posts(repost_of, author_id) WHERE repost_of IS NOT NULL;

CREATE TABLE likes (
  user_id    TEXT NOT NULL,
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, post_id)
) WITHOUT ROWID;
CREATE INDEX likes_post ON likes(post_id);

CREATE TABLE comments (
  id         TEXT PRIMARY KEY,
  post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX comments_post_created ON comments(post_id, created_at);
CREATE INDEX comments_author_created ON comments(author_id, created_at);

CREATE TABLE follows (
  follower_id TEXT NOT NULL,
  followee_id TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
) WITHOUT ROWID;

-- Counters stay correct no matter which code path writes
CREATE TRIGGER likes_ins AFTER INSERT ON likes BEGIN
  UPDATE posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
END;
CREATE TRIGGER likes_del AFTER DELETE ON likes BEGIN
  UPDATE posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
END;
CREATE TRIGGER comments_ins AFTER INSERT ON comments BEGIN
  UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
END;
CREATE TRIGGER comments_del AFTER DELETE ON comments BEGIN
  UPDATE posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
END;
CREATE TRIGGER reposts_ins AFTER INSERT ON posts WHEN NEW.repost_of IS NOT NULL BEGIN
  UPDATE posts SET repost_count = repost_count + 1 WHERE id = NEW.repost_of;
END;
CREATE TRIGGER reposts_del AFTER DELETE ON posts WHEN OLD.repost_of IS NOT NULL BEGIN
  UPDATE posts SET repost_count = repost_count - 1 WHERE id = OLD.repost_of;
END;
