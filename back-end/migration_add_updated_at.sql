-- 数据库迁移脚本：添加 updated_at 字段
-- 如果自动迁移失败，可以手动执行此脚本

-- 方法 1: 使用 DO 块（兼容所有 PostgreSQL 版本）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- 方法 2: 如果使用 PostgreSQL 9.6+，可以直接使用
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 为已存在的记录设置 updated_at 值
UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;

-- 验证
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users';
