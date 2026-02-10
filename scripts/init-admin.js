/**
 * 初始化第一个管理员账号
 * 
 * 使用方法：
 * 1. 在 .env.local 中设置 SUPABASE_SERVICE_ROLE_KEY
 * 2. 运行: node scripts/init-admin.js <email> <password>
 * 
 * 示例: node scripts/init-admin.js admin@example.com admin123456
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('错误：缺少必要的环境变量');
  console.error('请确保在 .env.local 中设置了：');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function initAdmin(email: string, password: string) {
  console.log('========================================');
  console.log('初始化管理员账号');
  console.log('========================================');
  console.log('邮箱:', email);
  console.log('========================================\n');

  try {
    // 1. 检查是否已有管理员
    console.log('检查是否已有管理员账号...');
    const { data: existingAdmins, error: checkError } = await supabase
      .from('user_profiles')
      .select('id, email, display_name')
      .eq('role', 'admin');

    if (checkError) {
      throw new Error(`检查管理员失败: ${checkError.message}`);
    }

    if (existingAdmins && existingAdmins.length > 0) {
      console.log('\n⚠️  警告：已存在管理员账号：');
      existingAdmins.forEach(admin => {
        console.log(`  - ${admin.display_name || admin.email} (${admin.email})`);
      });
      console.log('\n如需创建新管理员，请手动在数据库中操作。');
      process.exit(1);
    }

    console.log('✓ 未找到管理员账号，继续创建...\n');

    // 2. 创建用户
    console.log('正在创建用户...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: email.split('@')[0],
      },
    });

    if (authError) {
      throw new Error(`创建用户失败: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('创建用户失败：未返回用户信息');
    }

    console.log('✓ 用户创建成功');
    console.log('  用户ID:', authData.user.id);

    // 3. 创建用户配置
    console.log('正在创建用户配置...');
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email: authData.user.email!,
        display_name: email.split('@')[0],
        role: 'admin',
        is_active: true,
      });

    if (profileError) {
      // 如果创建配置失败，尝试删除用户
      console.log('创建配置失败，正在回滚...');
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw new Error(`创建用户配置失败: ${profileError.message}`);
    }

    console.log('✓ 用户配置创建成功');

    // 4. 创建默认分组
    console.log('正在创建默认分组...');
    const { error: groupError } = await supabase
      .from('user_groups')
      .insert({
        user_id: authData.user.id,
        name: '全部',
        is_default: true,
        sort_order: 0,
      });

    if (groupError) {
      console.warn('创建默认分组失败:', groupError.message);
    } else {
      console.log('✓ 默认分组创建成功');
    }

    // 5. 完成
    console.log('\n========================================');
    console.log('✓ 管理员账号创建成功！');
    console.log('========================================');
    console.log('登录信息：');
    console.log('  邮箱:', email);
    console.log('  密码:', password);
    console.log('  角色: 管理员');
    console.log('\n登录地址：');
    console.log('  http://localhost:3000/auth/signin');
    console.log('========================================');
    console.log('\n⚠️  重要提示：');
    console.log('  1. 请妥善保管管理员账号信息');
    console.log('  2. 建议登录后立即修改密码');
    console.log('  3. 管理员可以创建、修改、删除普通用户');
    console.log('========================================\n');

  } catch (error: any) {
    console.error('\n❌ 初始化失败：');
    console.error(error.message);
    process.exit(1);
  }
}

// 解析命令行参数
const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('用法：node scripts/init-admin.js <email> <password>');
  console.log('');
  console.log('示例：node scripts/init-admin.js admin@example.com admin123456');
  process.exit(1);
}

const email = args[0];
const password = args[1];

// 验证邮箱格式
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(email)) {
  console.error('错误：邮箱格式不正确');
  process.exit(1);
}

// 验证密码长度
if (password.length < 6) {
  console.error('错误：密码长度至少需要6位');
  process.exit(1);
}

// 执行初始化
initAdmin(email, password);
