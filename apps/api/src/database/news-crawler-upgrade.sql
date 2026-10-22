-- Bảng nguồn thu thập tin tức (RSS / Web Feed)
CREATE TABLE IF NOT EXISTS news_sources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'ai',
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  items_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bảng bài viết thu thập và xử lý bởi AI
CREATE TABLE IF NOT EXISTS news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id INT REFERENCES news_sources(id) ON DELETE SET NULL,
  source_name TEXT NOT NULL DEFAULT 'Nguồn ngoài',
  source_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  impact TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'ai',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'posted' | 'rejected'
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  posted_by TEXT,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_articles_status ON news_articles (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_category ON news_articles (category);

-- Cấu hình hệ thống crawler & monitor Telegram
CREATE TABLE IF NOT EXISTS news_crawler_config (
  id INT PRIMARY KEY DEFAULT 1,
  auto_post BOOLEAN NOT NULL DEFAULT false,
  telegram_enabled BOOLEAN NOT NULL DEFAULT false,
  telegram_bot_token TEXT,
  telegram_chat_id TEXT,
  default_bot TEXT NOT NULL DEFAULT 'ainews',
  ai_model TEXT NOT NULL DEFAULT 'n7ai-per',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cấu hình mặc định
INSERT INTO news_crawler_config (id, auto_post, telegram_enabled, default_bot, ai_model)
VALUES (1, false, false, 'ainews', 'n7ai-per')
ON CONFLICT (id) DO NOTHING;

-- Seed các nguồn tin công nghệ & AI phổ biến
INSERT INTO news_sources (name, url, category, enabled)
VALUES 
  ('Google News — Trí tuệ nhân tạo (AI)', 'https://news.google.com/rss/search?q=Artificial+Intelligence+AI&hl=en-US&gl=US&ceid=US:en', 'ai', true),
  ('OpenAI Newsroom', 'https://openai.com/news/rss.xml', 'ai', true),
  ('The Verge — Công nghệ', 'https://www.theverge.com/rss/index.xml', 'tech', true),
  ('TechCrunch', 'https://techcrunch.com/feed/', 'tech', true),
  ('BleepingComputer — An ninh mạng', 'https://www.bleepingcomputer.com/feed/', 'security', true),
  ('ArXiv CS.AI — Nghiên cứu khoa học AI', 'https://export.arxiv.org/rss/cs.AI', 'ai', true)
ON CONFLICT (url) DO NOTHING;
