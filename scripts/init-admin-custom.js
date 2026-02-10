/**
 * 初始化第一个管理员账号（自定义认证系统）
 * 
 * 使用方法：
 * 1. 在 .env.local 中设置 JWT_SECRET
 * 2. 运行: node scripts/init-admin-custom.js <email> <password>
 * 
 * 示例: node scripts/init-admin-custom.js admin@example.com admin123456
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import bcrypt from 'bcryptjs';

// 加载环境变量
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('错误：缺少必要的环境变量');
  console.error('请确保在 .env.local 中设置了：');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function initAdmin(email: string, password: string) {
  console.log('========================================');
  console.log('初始化管理员账号（自定义认证系统）');
  console.log('========================================');
  console.log('邮箱:', email);
  console.log('========================================\n');

  try {
    // 1. 检查是否已有管理员
    console.log('检查是否已有管理员账号...');
    const { data: existingAdmins, error: checkError } = await supabase
      .from('users')
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

    // 2. 加密密码
    console.log('正在加密密码...');
    const passwordHash = await bcrypt.hash(password, 10);
    console.log('✓ 密码加密成功');

    // 3. 创建管理员用户
    console.log('正在创建管理员用户...');
    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        display_name: email.split('@')[0],
        role: 'admin',
        is_active: true,
      })
      .select('id, email, display_name, role, is_active')
      .single();

    if (insertError) {
      throw new Error(`创建用户失败: ${insertError.message}`);
    }

    console.log('✓ 管理员用户创建成功');
    console.log('  用户ID:', user.id);

    // 4. 创建默认分组
    console.log('正在创建默认分组...');
    const { error: groupError } = await supabase
      .from('user_groups')
      .insert({
        user_id: user.id,
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
    console.log('  4. 管理员无法查看用户的持仓金额和总收益等敏感数据');
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
  console.log('用法：node scripts/init-admin-custom.js <email> <password>');
  console.log('');
  console.log('示例：node scripts/init-admin-custom.js admin@example.com admin123456');
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
