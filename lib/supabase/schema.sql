-- ===========================================
-- 基金实时估值系统 - 数据库表结构
-- ===========================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- 1. 基金基本信息表 (funds)
-- ===========================================
CREATE TABLE IF NOT EXISTS funds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,           -- 基金代码
  name VARCHAR(100) NOT NULL,                 -- 基金名称
  type VARCHAR(50),                           -- 基金类型（股票型、混合型、债券型等）
  manager VARCHAR(50),                        -- 基金经理
  company VARCHAR(100),                       -- 基金公司
  establish_date DATE,                        -- 成立日期
  risk_level VARCHAR(20),                     -- 风险等级
  scale DECIMAL(20, 2),                       -- 基金规模（亿元）
  fee_rate DECIMAL(5, 4),                     -- 管理费率
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_funds_code ON funds(code);
CREATE INDEX IF NOT EXISTS idx_funds_type ON funds(type);

-- 添加更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_funds_updated_at BEFORE UPDATE ON funds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- 2. 重仓股信息表 (stocks)
-- ===========================================
CREATE TABLE IF NOT EXISTS stocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fund_code VARCHAR(10) NOT NULL,             -- 基金代码
  stock_code VARCHAR(20) NOT NULL,            -- 股票代码
  stock_name VARCHAR(50) NOT NULL,            -- 股票名称
  proportion DECIMAL(5, 2) NOT NULL,          -- 占比（百分比）
  change_percent DECIMAL(5, 2),               -- 涨跌幅（百分比）
  shares BIGINT,                              -- 持股数量
  market_value DECIMAL(20, 2),                -- 市值（万元）
  update_date DATE NOT NULL,                  -- 更新日期
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_stocks_fund_code ON stocks(fund_code);
CREATE INDEX IF NOT EXISTS idx_stocks_stock_code ON stocks(stock_code);
CREATE INDEX IF NOT EXISTS idx_stocks_update_date ON stocks(update_date);

-- ===========================================
-- 3. 基金索引表 (funds_index)
-- ===========================================
CREATE TABLE IF NOT EXISTS funds_index (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(10) UNIQUE NOT NULL,           -- 基金代码
  name VARCHAR(100) NOT NULL,                 -- 基金名称
  type VARCHAR(50),                           -- 基金类型
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_funds_index_code ON funds_index(code);
CREATE INDEX IF NOT EXISTS idx_funds_index_name ON funds_index(name);
CREATE INDEX IF NOT EXISTS idx_funds_index_name_trgm ON funds_index USING gin(name gin_trgm_ops);

COMMENT ON TABLE funds_index IS '基金索引表，用于快速搜索建议，只存储基本信息';

-- ===========================================
-- 4. 历史净值数据表 (history)
-- ===========================================
CREATE TABLE IF NOT EXISTS history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fund_code VARCHAR(10) NOT NULL,             -- 基金代码
  nav_date DATE NOT NULL,                     -- 净值日期
  nav_value DECIMAL(10, 4) NOT NULL,          -- 单位净值
  accumulated_value DECIMAL(10, 4),           -- 累计净值
  daily_return DECIMAL(5, 4),                 -- 日涨跌幅
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_history_fund_code ON history(fund_code);
CREATE INDEX IF NOT EXISTS idx_history_nav_date ON history(nav_date);
CREATE INDEX IF NOT EXISTS idx_history_fund_date ON history(fund_code, nav_date);

-- ===========================================
-- 4. 添加注释
-- ===========================================
COMMENT ON TABLE funds IS '基金基本信息表';
COMMENT ON TABLE stocks IS '重仓股信息表';
COMMENT ON TABLE history IS '历史净值数据表';

COMMENT ON COLUMN funds.code IS '基金代码，唯一标识';
COMMENT ON COLUMN funds.type IS '基金类型：股票型、混合型、债券型等';
COMMENT ON COLUMN funds.risk_level IS '风险等级：低风险、中风险、高风险';

COMMENT ON COLUMN stocks.proportion IS '持仓占比，单位：百分比';
COMMENT ON COLUMN stocks.change_percent IS '股票涨跌幅，单位：百分比';

COMMENT ON COLUMN history.nav_value IS '单位净值';
COMMENT ON COLUMN history.accumulated_value IS '累计净值';
COMMENT ON COLUMN history.daily_return IS '日涨跌幅，单位：百分比';

-- ===========================================
-- 5. 初始化示例数据（可选）
-- ===========================================

-- 示例：插入测试基金数据（实际使用时可以删除）
-- INSERT INTO funds (code, name, type, manager) VALUES
--   ('018957', '中航机遇领航混合发起C', '混合型', '未知经理')
-- ON CONFLICT (code) DO NOTHING;

-- ===========================================
-- 6. 清理旧数据（可选）
-- ===========================================

-- 清理90天前的重仓股数据
-- DELETE FROM stocks WHERE update_date < CURRENT_DATE - INTERVAL '90 days';

-- 清理3年前的历史数据（可根据需要保留更长时间）
-- DELETE FROM history WHERE nav_date < CURRENT_DATE - INTERVAL '3 years';