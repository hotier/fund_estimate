-- ===========================================
-- 修复自定义认证系统的外键约束问题
-- ===========================================
-- 此脚本用于移除 user_groups 和 user_favorites 表中
-- 指向 auth.users 的外键约束，改为不使用外键约束
-- ===========================================

-- 1. 删除 user_groups 表的外键约束
ALTER TABLE user_groups
DROP CONSTRAINT IF EXISTS user_groups_user_id_fkey;

-- 2. 删除 user_favorites 表的外键约束
ALTER TABLE user_favorites
DROP CONSTRAINT IF EXISTS user_favorites_user_id_fkey;

-- 3. 删除 user_favorites 表的 group_id 外键约束（如果需要保留分组功能，可以选择不删除）
-- ALTER TABLE user_favorites
-- DROP CONSTRAINT IF EXISTS user_favorites_group_id_fkey;

-- 4. 添加注释说明不再使用外键约束
COMMENT ON COLUMN user_groups.user_id IS '用户ID（不再使用外键约束，由应用层保证数据一致性）';
COMMENT ON COLUMN user_favorites.user_id IS '用户ID（不再使用外键约束，由应用层保证数据一致性）';

-- ===========================================
-- 完成提示
-- ===========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '外键约束修复完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '已删除的外键约束：';
  RAISE NOTICE '  - user_groups.user_id → auth.users';
  RAISE NOTICE '  - user_favorites.user_id → auth.users';
  RAISE NOTICE '========================================';
  RAISE NOTICE '现在可以正常使用自定义认证系统创建分组了';
  RAISE NOTICE '========================================';
END $$;