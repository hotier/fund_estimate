import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import Link from 'next/link';
import AuthButton from '@/components/AuthButton';
import MobileNav from '@/components/MobileNav';

export const metadata: Metadata = {
  title: '基金实时估值 - 实时查询基金净值与涨跌幅',
  description: '实时显示基金估值数据，支持基金搜索、自选基金、基金对比等功能。数据实时更新，助您把握投资机会。',
  keywords: ['基金', '实时估值', '基金净值', '基金查询', '投资理财'],
  authors: [{ name: 'Fund Estimate' }],
  openGraph: {
    title: '基金实时估值',
    description: '实时显示基金估值数据，支持基金搜索、自选基金、基金对比等功能',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0070f3',
};

function Navigation() {
  return (
    <nav className="hidden md:flex items-center space-x-1">
      <NavLink href="/">首页</NavLink>
      <NavLink href="/favorites">自选</NavLink>
      <NavLink href="/compare">对比</NavLink>
      <NavLink href="/dashboard">仪表板</NavLink>
      <div className="ml-4">
        <AuthButton />
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200 text-sm font-medium"
    >
      {children}
    </Link>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="scroll-smooth">
      <body className="min-h-screen bg-gray-50 font-sans">
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            {/* 顶部导航 */}
            <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                  {/* Logo */}
                  <div className="flex items-center">
                    <Link href="/" className="flex items-center space-x-2 group">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center transform group-hover:scale-105 transition-transform duration-200">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                        基金估值
                      </span>
                    </Link>
                  </div>

                  {/* 桌面端导航 */}
                  <Navigation />

                  {/* 移动端菜单按钮 */}
                  <div className="md:hidden">
                    <MobileNav />
                  </div>
                </div>
              </div>
            </header>

            {/* 主内容区 */}
            <main className="flex-1">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
                {children}
              </div>
            </main>

            {/* 底部 */}
            <footer className="bg-white border-t border-gray-200 mt-auto">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                  {/* 关于 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                      关于我们
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      基金实时估值工具，提供实时、准确的基金估值数据查询服务。
                    </p>
                  </div>

                  {/* 快速链接 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                      快速链接
                    </h3>
                    <ul className="space-y-2">
                      <li>
                        <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">
                          首页
                        </Link>
                      </li>
                      <li>
                        <Link href="/favorites" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">
                          自选基金
                        </Link>
                      </li>
                      <li>
                        <Link href="/compare" className="text-gray-600 hover:text-gray-900 text-sm transition-colors">
                          基金对比
                        </Link>
                      </li>
                    </ul>
                  </div>

                  {/* 免责声明 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
                      免责声明
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      本站数据仅供参考，不构成投资建议。投资有风险，入市需谨慎。
                    </p>
                  </div>
                </div>

                {/* 版权信息 */}
                <div className="border-t border-gray-200 pt-8">
                  <div className="flex flex-col md:flex-row justify-between items-center">
                    <p className="text-gray-500 text-sm text-center md:text-left">
                      © {new Date().getFullYear()} 基金实时估值. All rights reserved.
                    </p>
                    <div className="mt-4 md:mt-0 flex items-center space-x-4">
                      <Link 
                        href="/api/data/health" 
                        target="_blank"
                        className="text-gray-400 hover:text-gray-600 text-xs transition-colors"
                      >
                        系统状态
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
