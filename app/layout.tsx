import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '基金实时估值',
  description: '实时显示基金估值数据，支持基金搜索、自选、对比等功能',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-semibold text-gray-900">基金实时估值</h1>
                </div>
                <div className="flex items-center space-x-4">
                  <a href="/" className="text-gray-600 hover:text-gray-900">首页</a>
                  <a href="/favorites" className="text-gray-600 hover:text-gray-900">自选</a>
                  <a href="/compare" className="text-gray-600 hover:text-gray-900">对比</a>
                  <a href="/dashboard" className="text-gray-600 hover:text-gray-900">仪表板</a>
                </div>
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
          <footer className="bg-white border-t mt-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <p className="text-center text-gray-500 text-sm">
                © {new Date().getFullYear()} 基金实时估值 - 数据仅供参考，不构成投资建议
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}