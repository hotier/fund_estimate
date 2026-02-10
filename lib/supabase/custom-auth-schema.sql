-- ===========================================
-- 自定义用户认证系统数据库表结构
-- 不使用 Supabase Auth，完全自定义
-- ===========================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- 1. 用户表 (users)
-- ===========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,        -- bcrypt 加密的密码
  display_name VARCHAR(100),                 -- 显示名称
  avatar_url TEXT,                           -- 头像URL
  role VARCHAR(20) DEFAULT 'user',           -- 角色：admin/user
  is_active BOOLEAN DEFAULT TRUE,            -- 账号是否激活
  last_login_at TIMESTAMP,                    -- 最后登录时间
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

COMMENT ON TABLE users IS '用户表，存储自定义用户账号信息';
COMMENT ON COLUMN users.password_hash IS 'bcrypt 加密的密码哈希';
COMMENT ON COLUMN users.role IS '角色：admin（管理员）、user（普通用户）';

-- ===========================================
-- 2. 用户分组表 (user_groups)
-- ===========================================
CREATE TABLE IF NOT EXISTS user_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,                 -- 分组名称
  is_default BOOLEAN DEFAULT FALSE,           -- 是否默认分组
  sort_order INTEGER DEFAULT 0,               -- 排序顺序
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_groups_user_id ON user_groups(user_id);

-- 确保每个用户只有一个默认分组
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_groups_user_default
  ON user_groups(user_id, is_default)
  WHERE is_default = TRUE;

COMMENT ON TABLE user_groups IS '用户分组表，用于组织自选基金';

-- ===========================================
-- 3. 自选基金表 (user_favorites)
-- ===========================================
CREATE TABLE IF NOT EXISTS user_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fund_code VARCHAR(10) NOT NULL,             -- 基金代码
  group_id UUID REFERENCES user_groups(id) ON DELETE SET NULL,
  holdings DECIMAL(20, 2) DEFAULT 0,          -- 持仓金额（敏感数据）
  total_profit DECIMAL(20, 2) DEFAULT 0,      -- 总收益（敏感数据）
  notes TEXT,                                 -- 备注
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, fund_code)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_fund_code ON user_favorites(fund_code);
CREATE INDEX IF NOT EXISTS idx_user_favorites_group_id ON user_favorites(group_id);

COMMENT ON TABLE user_favorites IS '自选基金表，存储用户的自选基金和持仓信息';
COMMENT ON COLUMN user_favorites.holdings IS '持仓金额（敏感数据，管理员不可见）';
COMMENT ON COLUMN user_favorites.total_profit IS '总收益（敏感数据，管理员不可见）';

-- ===========================================
-- 4. 创建视图：用户自选基金完整信息（用于普通用户）
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
  uf.holdings,                                 -- 包含敏感数据
  uf.total_profit,                             -- 包含敏感数据
  uf.notes,
  uf.created_at,
  uf.updated_at
FROM user_favorites uf
LEFT JOIN funds_index fi ON uf.fund_code = fi.code
LEFT JOIN user_groups ug ON uf.group_id = ug.id;

COMMENT ON VIEW user_favorites_view IS '用户自选基金完整信息视图';

-- ===========================================
-- 5. 创建视图：管理员用户自选基金列表（不包含敏感数据）
-- ===========================================
CREATE OR REPLACE VIEW admin_user_favorites_view AS
SELECT
  uf.id,
  uf.user_id,
  u.email AS user_email,
  u.display_name AS user_display_name,
  uf.fund_code,
  fi.name AS fund_name,
  fi.type AS fund_type,
  uf.group_id,
  ug.name AS group_name,
  -- 不包含 holdings 和 total_profit（敏感数据）
  uf.notes,
  uf.created_at,
  uf.updated_at
FROM user_favorites uf
LEFT JOIN users u ON uf.user_id = u.id
LEFT JOIN funds_index fi ON uf.fund_code = fi.code
LEFT JOIN user_groups ug ON uf.group_id = ug.id;

COMMENT ON VIEW admin_user_favorites_view IS '管理员视图：不包含持仓金额和总收益等敏感数据';

-- ===========================================
-- 6. 创建函数：获取用户统计信息（包含敏感数据）
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

-- ===========================================
-- 7. 创建函数：管理员获取用户统计信息（不包含敏感数据）
-- ===========================================
CREATE OR REPLACE FUNCTION admin_get_user_stats(p_user_id UUID)
RETURNS TABLE (
  total_funds BIGINT,
  total_groups BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT uf.fund_code) AS total_funds,
    COUNT(DISTINCT ug.id) AS total_groups
  FROM user_favorites uf
  LEFT JOIN user_groups ug ON uf.group_id = ug.id
  WHERE uf.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

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

-- ===========================================
-- 9. 创建函数：验证用户密码
-- ===========================================
CREATE OR REPLACE FUNCTION verify_user_password(
  p_email VARCHAR(255),
  p_password VARCHAR(255)
)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  display_name VARCHAR(100),
  role VARCHAR(20),
  is_active BOOLEAN,
  password_verified BOOLEAN
) AS $$
DECLARE
  v_password_hash VARCHAR(255);
  v_user_id UUID;
  v_display_name VARCHAR(100);
  v_role VARCHAR(20);
  v_is_active BOOLEAN;
BEGIN
  -- 获取用户信息
  SELECT 
    id, 
    password_hash, 
    display_name, 
    role, 
    is_active
  INTO 
    v_user_id, 
    v_password_hash, 
    v_display_name, 
    v_role, 
    v_is_active
  FROM users
  WHERE email = p_email;
  
  -- 用户不存在
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR, NULL::BOOLEAN, FALSE;
  END IF;
  
  -- 账号未激活
  IF NOT v_is_active THEN
    RETURN QUERY 
      SELECT 
        v_user_id, 
        p_email, 
        v_display_name, 
        v_role, 
        v_is_active, 
        FALSE;
  END IF;
  
  -- 使用 pgcrypto 验证密码（需要在应用层使用 bcrypt）
  -- 这里只返回用户信息，密码验证在应用层进行
  RETURN QUERY 
    SELECT 
      v_user_id, 
      p_email, 
      v_display_name, 
      v_role, 
      v_is_active, 
      NULL;  -- 密码验证在应用层进行
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- 10. 完成提示
-- ===========================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '自定义用户认证系统数据库表结构创建完成！';
  RAISE NOTICE '========================================';
  RAISE NOTICE '已创建的表：';
  RAISE NOTICE '  - users (用户表)';
  RAISE NOTICE '  - user_groups (用户分组表)';
  RAISE NOTICE '  - user_favorites (自选基金表)';
  RAISE NOTICE '========================================';
  RAISE NOTICE '已创建的视图：';
  RAISE NOTICE '  - user_favorites_view (用户视图，包含敏感数据)';
  RAISE NOTICE '  - admin_user_favorites_view (管理员视图，不包含敏感数据)';
  RAISE NOTICE '========================================';
  RAISE NOTICE '已创建的函数：';
  RAISE NOTICE '  - get_user_stats() - 用户统计（包含敏感数据）';
  RAISE NOTICE '  - admin_get_user_stats() - 管理员统计（不包含敏感数据）';
  RAISE NOTICE '  - move_fund_to_group() - 移动基金到分组';
  RAISE NOTICE '  - verify_user_password() - 验证用户密码';
  RAISE NOTICE '========================================';
  RAISE NOTICE '下一步：';
  RAISE NOTICE '1. 安装 bcryptjs 用于密码加密';
  RUN npm install bcryptjs jsonwebtoken';
  RAISE NOTICE '2. 在应用层实现 JWT 认证';
  RAISE NOTICE '3. 创建登录/注册 API';
  RAISE NOTICE '4. 实现权限控制（管理员不能查看敏感数据）';
  RAISE NOTICE '========================================';
END $$;