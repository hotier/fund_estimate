# 📊 基金实时估值网站项目计划

## 🎯 **项目概述**
创建一个实时显示基金估值数据的工具网站，用户输入基金代码即可查看实时估算净值、涨跌幅、历史趋势等关键信息。

## 🛠️ **技术栈选择**
- **前端框架**: Next.js 14 (App Router)
- **样式方案**: Tailwind CSS + Shadcn/ui 组件库
- **数据获取**: Server Actions + React Query
- **图表展示**: Recharts 或 Chart.js
- **部署平台**: Vercel (全栈部署)
- **数据库**: PostgreSQL (Vercel Postgres) 或 MySQL (PlanetScale)
- **缓存层**: Redis (Upstash，与Vercel集成良好)

## 📁 **项目结构规划**
```
fund-estimate-tool/
├── app/
│   ├── (auth)/                    # 可选的用户认证路由
│   ├── (marketing)/               # 营销页面（首页、关于等）
│   ├── api/                       # API路由
│   │   ├── fund/                  # 基金相关API
│   │   │   ├── [code]/route.ts    # 单只基金数据
│   │   │   ├── search/route.ts    # 基金搜索
│   │   │   └── batch/route.ts     # 批量获取
│   │   ├── data/                  # 数据源API
│   │   │   ├── sync/route.ts      # 数据同步任务
│   │   │   └── sources/route.ts   # 数据源管理
│   │   └── subscribe/route.ts     # 订阅通知
│   ├── fund/                      # 基金详情页
│   │   └── [code]/page.tsx        # 动态路由
│   ├── dashboard/page.tsx         # 用户仪表板
│   ├── compare/page.tsx           # 基金对比页
│   ├── favorites/page.tsx         # 自选基金页
│   ├── api/route.ts               # API测试页
│   ├── layout.tsx                 # 根布局
│   └── page.tsx                   # 首页
├── components/
│   ├── fund/
│   │   ├── FundCard.tsx           # 基金卡片组件
│   │   ├── FundChart.tsx          # 基金图表
│   │   ├── FundTable.tsx          # 基金表格
│   │   └── RealTimeBadge.tsx      # 实时状态徽章
│   ├── ui/                        # 通用UI组件
│   ├── layout/                    # 布局组件
│   └── data/                      # 数据相关组件
├── lib/
│   ├── db/                        # 数据库操作
│   │   └── schema.ts              # 数据库模式
│   ├── services/                  # 业务服务
│   │   ├── fundService.ts         # 基金数据服务
│   │   ├── dataFetcher.ts         # 数据抓取服务
│   │   └── cacheService.ts        # 缓存服务
│   ├── utils/                     # 工具函数
│   └── config.ts                  # 配置文件
├── types/                         # TypeScript类型定义
├── styles/                        # 全局样式
├── scripts/                       # 脚本文件
│   └── update-funds.ts            # 数据更新脚本
└── public/                        # 静态资源
```

## 🔄 **核心功能模块**

### 1. **数据获取与处理系统**
```typescript
// 数据源配置
const DATA_SOURCES = {
  tiantian: { url: 'https://fundgz.1234567.com.cn/js/{code}.js' },
  eastmoney: { url: 'https://api.fund.eastmoney.com' },
  // 备用数据源
};
```

**实现方案**:
- **实时数据**: Serverless Functions 定时获取 (Vercel Cron Jobs)
- **数据解析**: 处理JSONP/JSON格式，统一数据格式
- **数据缓存**: Redis缓存热门基金数据，减少API调用
- **数据存储**: PostgreSQL存储历史数据用于分析

### 2. **前端展示功能**
- ✅ **实时估值展示**：当前估算净值、涨跌幅、更新时间
- ✅ **基金搜索**：支持代码/拼音/名称搜索
- ✅ **自选基金**：用户收藏功能 (使用Cookies或数据库)
- ✅ **对比功能**：多只基金对比分析
- ✅ **趋势图表**：当日估值走势图
- ✅ **历史表现**：近1月/3月/6月/1年表现
- ✅ **数据刷新**：手动/自动刷新数据
- ✅ **移动端适配**：响应式设计

### 3. **后端API设计**
```typescript
// API端点示例
GET  /api/fund/000001          # 获取单只基金数据
GET  /api/fund/batch?codes=000001,000002  # 批量获取
GET  /api/fund/search?q=沪深300  # 搜索基金
POST /api/fund/sync            # 手动触发数据同步 (受保护)
GET  /api/data/sources         # 数据源状态检查
```

## 🚀 **开发阶段规划**

### **阶段一：基础功能 (Week 1)**
1. **项目初始化**
   - 创建Next.js项目，配置Tailwind
   - 设置Vercel项目连接GitHub
   - 配置开发环境变量

2. **基础数据获取**
   - 实现单个基金数据抓取API
   - 创建基础前端展示组件
   - 实现简单的搜索功能

3. **基础部署**
   - 部署到Vercel测试环境
   - 配置基础域名和SSL

### **阶段二：核心功能完善 (Week 2)**
1. **数据系统优化**
   - 添加多个数据源，实现fallback机制
   - 实现数据缓存 (Redis/Upstash)
   - 添加定时数据更新 (Vercel Cron Jobs)

2. **用户体验提升**
   - 添加基金对比功能
   - 实现自选基金列表
   - 添加加载状态和错误处理
   - 优化移动端体验

3. **数据持久化**
   - 设置Vercel Postgres数据库
   - 存储用户自选列表
   - 记录基金历史数据

### **阶段三：高级功能 (Week 3)**
1. **数据可视化**
   - 添加实时走势图表
   - 实现历史业绩对比
   - 添加K线图展示

2. **性能优化**
   - 实现增量静态再生 (ISR)
   - 添加图片/资源优化
   - 实现按需加载

3. **监控与维护**
   - 添加数据源健康检查
   - 实现错误监控 (Sentry)
   - 添加使用统计

## 🗄️ **数据库设计**
```sql
-- 基金基本信息表
CREATE TABLE funds (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(100),
  pinyin VARCHAR(50),
  type VARCHAR(20),
  manager VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 基金实时数据表
CREATE TABLE fund_prices (
  id SERIAL PRIMARY KEY,
  fund_code VARCHAR(10) REFERENCES funds(code),
  estimate_value DECIMAL(10,4),  -- 估算净值
  actual_value DECIMAL(10,4),    -- 实际净值 (收盘后)
  change_percent DECIMAL(5,2),   -- 涨跌幅
  update_time TIMESTAMP,
  data_source VARCHAR(20)
);

-- 用户自选表
CREATE TABLE favorites (
  user_id VARCHAR(100),  -- 或使用匿名ID
  fund_code VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, fund_code)
);
```

## ⚙️ **Vercel具体配置**

### **1. vercel.json 配置**
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next",
  "regions": ["hkg1"],  // 香港节点，访问国内数据更快
  "env": {
    "NEXT_PUBLIC_APP_URL": "https://fund.yourdomain.com"
  }
}
```

### **2. 环境变量配置**
```bash
# Vercel Environment Variables
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
DATA_SOURCE_API_KEY=your_api_key_here
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

### **3. Cron Jobs配置**
在 `/api/cron/update` 创建定时任务：
```typescript
export const config = {
  runtime: 'edge',
};

export default async function handler() {
  // 交易日 9:30-15:00 每30秒更新一次
  // 使用Vercel Cron: https://vercel.com/docs/cron-jobs
}
```

## 🛡️ **安全与合规考虑**
1. **数据源合规性**
   - 使用公开、合法的数据源
   - 添加数据源声明和免责条款
   - 控制请求频率，避免给数据源造成压力

2. **用户数据安全**
   - 使用安全的Cookie设置
   - 实施API速率限制
   - 添加CSP安全头

3. **版权与声明**
   - 明确数据仅供参考
   - 添加风险提示
   - 说明数据延迟情况

## 📈 **性能优化策略**
1. **静态优化**
   - 使用Next.js静态生成 + ISR
   - 热门基金页面预生成
   - CDN缓存静态资源

2. **动态优化**
   - 实现SWR策略，客户端数据刷新
   - 使用Edge Functions降低延迟
   - 数据库连接池优化

3. **监控指标**
   - 使用Vercel Analytics监控性能
   - 设置Uptime Robot监控可用性
   - 定期检查数据源稳定性

## 🎨 **UI/UX设计要点**
1. **数据可视化原则**
   - 涨用红色，跌用绿色（符合国内习惯）
   - 实时更新动画效果
   - 关键数据突出显示

2. **交互设计**
   - 一键添加自选
   - 拖拽对比功能
   - 实时数据刷新提示

3. **移动端优先**
   - 触摸友好的操作元素
   - 简化移动端信息展示
   - PWA支持（可选）

## 🚨 **风险与应对**

### **技术风险**
1. **数据源失效** → 多数据源备份 + 手动维护模式
2. **API限制** → 实施缓存 + 请求队列
3. **Vercel限制** → 监控函数执行时间，优化代码

### **法律风险**
1. **数据版权** → 使用公开接口，添加免责声明
2. **投资建议** → 明确标注"数据仅供参考"

## 📊 **后续迭代方向**
1. **社交功能**：用户评论、分享组合
2. **高级分析**：基金评级、风险评估
3. **通知系统**：涨跌提醒、净值更新通知
4. **数据导出**：导出自选列表、历史数据
5. **API开放**：提供公开API供开发者使用

## 💰 **预算估算**
- **域名**：$10-20/年
- **Vercel Pro**：$20/月 (超出免费额度后)
- **Upstash Redis**：免费计划足够初期使用
- **Vercel Postgres**：$9/月 (Hobby计划)
- **总计**：初期约 $30-40/月

## 📝 **立即行动清单**
1. [x] 创建GitHub仓库
2. [x] 初始化Next.js项目
3. [x] 部署到Vercel测试环境
4. [x] 实现第一个基金数据API
5. [x] 创建基础UI展示
6. [x] 添加搜索功能
7. [x] 配置数据库（Supabase）
8. [x] 添加缓存层
9. [x] 优化移动端体验
10. [x] **导入完整基金索引（26,094只基金）**
11. [ ] 部署正式环境

---

## ✅ **已完成的重要功能**

### **基金索引系统（2026-02-10）**
- ✅ 从 akshare 获取完整基金列表（26,094只）
- ✅ 创建 `funds_index` 表，包含基金代码、名称、类型
- ✅ 实现智能搜索：支持代码和名称模糊搜索
- ✅ 自动索引：从新浪财经获取新基金后自动写入索引表
- ✅ 类型智能估值：根据基金类型使用不同的估值方法
  - 股票型/混合型：重仓股涨跌幅加权
  - 指数型：指数涨跌幅
  - 债券型：固定小涨跌幅
  - 货币型：极小涨跌幅
  - QDII：海外市场数据

### **数据管理页面优化**
- ✅ 移除手动导入功能（由开发者脚本处理）
- ✅ 显示基金索引状态（26,094只基金已就绪）
- ✅ 简化UI，只保留必要的同步功能