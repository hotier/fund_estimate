/**
 * 基金索引数据导入脚本
 * 从 JSON 文件读取基金信息并导入到 Supabase
 * 运行命令: node scripts/import-funds-index.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 读取 .env.local 文件
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

// 解析环境变量
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    envVars[key.trim()] = value.trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 读取基金 JSON 文件
const jsonPath = path.join(__dirname, '..', 'funds-index-full.json');
const fundsData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

console.log(`📋 从 JSON 文件读取到 ${fundsData.length} 只基金`);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 缺少 Supabase 环境变量配置');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 规范化基金类型
 */
function normalizeFundType(type) {
  if (!type) return '未知';

  if (type.includes('股票')) return '股票型';
  if (type.includes('混合')) return '混合型';
  if (type.includes('债券')) return '债券型';
  if (type.includes('货币')) return '货币型';
  if (type.includes('指数')) return '指数型';
  if (type.includes('QDII')) return 'QDII';
  if (type.includes('LOF')) return 'LOF';
  if (type.includes('ETF')) return 'ETF';
  if (type.includes('FOF')) return 'FOF';
  if (type.includes('REITs')) return 'REITs';

  return type;
}

/**
 * 批量导入基金到数据库
 */
async function importFundsToDatabase(funds) {
  console.log(`💾 正在导入 ${funds.length} 只基金到数据库...`);

  // 分批导入，每批 500 只
  const batchSize = 500;
  let totalImported = 0;
  let totalErrors = 0;

  for (let i = 0; i < funds.length; i += batchSize) {
    const batch = funds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('funds_index')
      .upsert(batch, { onConflict: 'code' })
      .select();

    if (error) {
      console.error(`❌ 批次 ${Math.floor(i / batchSize) + 1} 导入失败:`, error.message);
      totalErrors += batch.length;
    } else {
      totalImported += batch.length;
      console.log(`✅ 批次 ${Math.floor(i / batchSize) + 1} 导入成功 (${batch.length} 只)`);
    }

    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n📊 导入完成: ${totalImported} 只成功, ${totalErrors} 只失败`);
  return { imported: totalImported, errors: totalErrors };
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始导入基金索引数据...\n');

  try {
    // 处理基金数据
    const funds = fundsData.map(fund => ({
      code: fund.code,
      name: fund.name,
      type: normalizeFundType(fund.type),
    }));

    if (funds.length === 0) {
      console.error('❌ 没有获取到基金数据');
      process.exit(1);
    }

    // 导入到数据库
    const result = await importFundsToDatabase(funds);

    console.log('\n✅ 基金索引导入完成！');
    console.log(`📈 总计: ${result.imported} 只基金`);
    console.log(`🎉 现在可以使用基金代码或名称进行搜索了！`);

  } catch (error) {
    console.error('\n❌ 导入失败:', error);
    process.exit(1);
  }
}

// 运行脚本
main();