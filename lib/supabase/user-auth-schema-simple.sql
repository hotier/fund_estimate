-- ===========================================
-- 用户认证与自选基金数据存储 - 简化版（不使用 RLS）
-- ===========================================
-- 执行此 SQL 文件前，请确保已连接到 Supabase 数据库
-- ===========================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- 1. 用户配置表 (user_profiles)
-- ===========================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(100),                 -- 显示名称
  avatar_url TEXT,                           -- 头像URL
  role VARCHAR(20) DEFAULT 'user',           -- 用户角色：admin/user
  is_active BOOLEAN DEFAULT TRUE,            -- 账号是否激活
  preferences JSONB DEFAULT '{}',            -- 用户偏好设置
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) -- 创建者（管理员）
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_user_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_user_profile_updated_at();

COMMENT ON TABLE user_profiles IS '用户配置表，存储用户额外信息';
COMMENT ON COLUMN user_profiles.role IS '用户角色：admin（管理员）、user（普通用户）';
COMMENT ON COLUMN user_profiles.is_active IS '账号是否激活，false则无法登录';
COMMENT ON COLUMN user_profiles.preferences IS '用户偏好设置，JSON格式存储';

-- ===========================================
-- 2. 用户分组表 (user_groups)
-- ===========================================
CREATE TABLE IF NOT EXISTS user_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,                 -- 分组名称
  is_default BOOLEAN DEFAULT FALSE,           -- 是否默认分组
  sort_order INTEGER DEFAULT 0,               -- 排序顺序
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON user_groups(user_id);

-- 确保每个用户只有一个默认分组
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_groups_user_default
  ON user_groups(user_id, is_default)
  WHERE is_default = TRUE;

-- 添加更新时间触发器
CREATE TRIGGER update_user_groups_updated_at BEFORE UPDATE ON user_groups
    FOR EACH ROW EXECUTE FUNCTION update_user_profile_updated_at();

COMMENT ON TABLE user_groups IS '用户分组表，用于组织自选基金';
COMMENT ON COLUMN user_groups.is_default IS '是否为默认分组，每个用户只能有一个默认分组';

-- ===========================================
-- 3. 自选基金表 (user_favorites)
-- ===========================================
CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fund_code VARCHAR(10) NOT NULL,             -- 基金代码
  group_id UUID REFERENCES user_groups(id) ON DELETE SET NULL,
  holdings DECIMAL(20, 2) DEFAULT 0,          -- 持仓金额
  total_profit DECIMAL(20, 2) DEFAULT 0,      -- 总收益
  notes TEXT,                                 -- 备注
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, fund_code)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_fund_code ON user_favorites(fund_code);
CREATE INDEX IF NOT EXISTS idx_user_favorites_group_id ON user_favorites(group_id);

-- 添加更新时间触发器
CREATE TRIGGER update_user_favorites_updated_at BEFORE UPDATE ON user_favorites
    FOR EACH ROW EXECUTE FUNCTION update_user_profile_updated_at();

COMMENT ON TABLE user_favorites IS '自选基金表，存储用户的自选基金和持仓信息';
COMMENT ON COLUMN user_favorites.holdings IS '持仓金额，单位：元';
COMMENT ON COLUMN user_favorites.total_profit IS '累计总收益，单位：元';
COMMENT ON COLUMN user_favorites.notes IS '用户备注信息';

-- ===========================================
-- 4. 创建函数：用户注册时自动创建默认分组
-- ===========================================
CREATE OR REPLACE FUNCTION create_default_group_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 检查是否已存在默认分组
  IF NOT EXISTS (
    SELECT 1 FROM user_groups
    WHERE user_id = NEW.id AND is_default = TRUE
  ) THEN
    INSERT INTO user_groups (user_id, name, is_default, sort_order)
    VALUES (NEW.id, '全部', TRUE, 0);
  END IF;
  
  -- 创建用户配置记录
  INSERT INTO user_profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 5. 创建触发器：用户创建时自动执行
-- ===========================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_group_for_new_user();

-- ===========================================
-- 6. 创建视图：用户自选基金完整信息
-- ===========================================
CREATE OR REPLACE VIEW user_favorites_view AS
SELECT
  uf.id,
  uf.user_id,
  uf.fund_code,
  fi.name AS fund_name,
  fi.type AS fund_type,
  uf.group_id,
  ug.name AS group_name,
  uf.holdings,
  uf.total_profit,
  uf.notes,
  uf.created_at,
  uf.updated_at
FROM user_favorites uf
LEFT JOIN funds_index fi ON uf.fund_code = fi.code
LEFT JOIN user_groups ug ON uf.group_id = ug.id;

COMMENT ON VIEW user_favorites_view IS '用户自选基金完整信息视图，关联基金索引和分组信息';

-- ===========================================
-- 7. 创建函数：获取用户统计信息
-- ===========================================
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_funds BIGINT,
  total_holdings DECIMAL,
  total_profit DECIMAL,
  total_groups BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT uf.fund_code) AS total_funds,
    COALESCE(SUM(uf.holdings), 0) AS total_holdings,
    COALESCE(SUM(uf.total_profit), 0) AS total_profit,
    COUNT(DISTINCT ug.id) AS total_groups
  FROM user_favorites uf
  LEFT JOIN user_groups ug ON uf.group_id = ug.id
  WHERE uf.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_stats IS '获取用户统计信息：基金数量、总持仓、总收益、分组数量';

-- ===========================================
-- 8. 创建函数：移动基金到分组
-- ===========================================
CREATE OR REPLACE FUNCTION move_fund_to_group(
  p_user_id UUID,
  p_fund_code VARCHAR(10),
  p_group_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_group_exists BOOLEAN;
BEGIN
  -- 检查分组是否存在且属于当前用户
  SELECT EXISTS (
    SELECT 1 FROM user_groups
    WHERE id = p_group_id AND user_id = p_user_id
  ) INTO v_group_exists;
  
  IF NOT v_group_exists THEN
    RAISE EXCEPTION '分组不存在或无权限';
  END IF;
  
  -- 更新基金分组
  UPDATE user_favorites
  SET group_id = p_group_id, updated_at = NOW()
  WHERE user_id = p_user_id AND fund_code = p_fund_code;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION move_fund_to_group IS '移动基金到指定分组';

-- ===========================================
-- 9. 完成提示
-- ===========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '数据库表结构创建完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '已创建的表：';
  RAISE NOTICE '  - user_profiles (用户配置)';
  RAISE NOTICE '  - user_groups (用户分组)';
  RAISE NOTICE '  - user_favorites (自选基金)';
  RAISE NOTICE '========================================';
  RAISE NOTICE '已创建的视图：';
  RAISE NOTICE '  - user_favorites_view (自选基金完整信息)';
  RAISE NOTICE '========================================';
  RAISE NOTICE '已创建的函数：';
  RAISE NOTICE '  - create_default_group_for_new_user()';
  RAISE NOTICE '  - get_user_stats()';
  RAISE NOTICE '  - move_fund_to_group()';
  RAISE NOTICE '========================================';
  RAISE NOTICE '下一步：';
  RAISE NOTICE '1. 在 Supabase Dashboard 配置认证';
  RAISE NOTICE '2. 在代码中实现权限控制';
  RAISE NOTICE '3. 测试用户注册/登录功能';
  RAISE NOTICE '========================================';
END $$;