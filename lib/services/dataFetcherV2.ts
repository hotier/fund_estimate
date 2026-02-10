// 数据抓取服务 V2 - 集成 Supabase 缓存
// 从新浪财经获取基金数据并缓存到 Supabase

import axios from 'axios';
import * as cheerio from 'cheerio';
import cacheService from './cacheServiceV2';
import * as database from '../supabase/database';

// 基金基本信息接口
export interface FundInfo {
  code: string;
  name: string;
  type: string;
  manager: string;
}

// 基金重仓股接口
export interface FundStock {
  code: string;
  name: string;
  proportion: number; // 占比
  price: number; // 当前价格
  change: number; // 涨跌幅
}

// 基金估值接口
export interface FundEstimate {
  code: string;
  name: string;
  estimate_value: number; // 估算净值
  actual_value: number; // 实际净值（前一日）
  change_percent: number; // 估算涨跌幅
  update_time: string;
  data_source: string;
  stocks?: FundStock[]; // 重仓股数据
}

class DataFetcherV2 {
  // 从新浪财经API获取基金基本信息
  async getFundInfoFromSina(code: string): Promise<FundInfo | null> {
    try {
      console.log(`[Sina] 获取基金 ${code} 的基本信息...`);

      const url = "https://fund.sina.com.cn/fund/api/fundDetail";
      const response = await axios.post(url, {
        fundcode: code,
        type: "1,2,3,4,5",
        openLoader: "true",
        _: "1770634653091"
      }, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000,
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
      });

      const fundData = response.data.data;
      if (!fundData) {
        console.error(`[Sina] 未找到基金 ${code} 的数据`);
        return null;
      }

      const wb_default = fundData.wb_default || '';
      let name = '';
      if (wb_default) {
        name = wb_default.split(' of')[0].replace('$', '').trim();
      }
      if (!name) {
        console.error(`[Sina] 未找到基金 ${code} 的名称`);
        return null;
      }

      const type = '混合型';
      const manager = '未知经理';

      console.log(`[Sina] 成功获取基金 ${code} 的基本信息: 名称=${name}, 类型=${type}`);

      // 保存到缓存
      await cacheService.setFundInfo({
        code,
        name,
        type,
        manager,
      });

      // 自动写入索引表
      try {
        await database.addFundToIndex({
          code,
          name,
          type,
        });
        console.log(`[索引] 自动将基金 ${code} 写入索引表`);
      } catch (error) {
        console.error(`[索引] 写入索引表失败:`, error);
      }

      return {
        code,
        name,
        type,
        manager
      };
    } catch (error) {
      console.error('[Sina] 获取基金基本信息失败:', error);
      return null;
    }
  }

  // 从新浪财经API获取基金持仓数据
  async getFundStocksFromSina(code: string): Promise<FundStock[]> {
    try {
      console.log(`[Sina] 获取基金 ${code} 的重仓股数据...`);

      const url = "https://fund.sina.com.cn/fund/api/fundDetail";
      const response = await axios.post(url, {
        fundcode: code,
        type: "1,2,3,4,5",
        openLoader: "true",
        _: "1770634653091"
      }, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000,
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
      });

      const fundData = response.data.data;
      if (!fundData) {
        console.error(`[Sina] 未找到基金 ${code} 的数据`);
        return [];
      }

      const element = fundData.element || {};
      const stockList = element.list || [];
      if (stockList.length === 0) {
        console.error(`[Sina] 基金 ${code} 没有持仓股票数据`);
        return [];
      }

      const stocks: FundStock[] = stockList.map((stock: any) => ({
        code: stock.code || '',
        name: stock.name || '',
        proportion: parseFloat(stock.rate) || 0,
        price: 0,
        change: (parseFloat(stock.zdf) || 0) * 100
      }));

      console.log(`[Sina] 成功获取基金 ${code} 的 ${stocks.length} 只重仓股`);

      // 保存到缓存
      const updateDate = new Date().toISOString().split('T')[0];
      await cacheService.setStocks(
        stocks.map(s => ({
          fund_code: code,
          stock_code: s.code,
          stock_name: s.name,
          proportion: s.proportion,
          change_percent: s.change,
          update_date: updateDate,
        }))
      );

      return stocks;
    } catch (error) {
      console.error('[Sina] 获取基金重仓股数据失败:', error);
      return [];
    }
  }

  // 获取基金基本信息（先查缓存，再查API）
  async getFundInfo(code: string): Promise<FundInfo | null> {
    // 先查缓存
    const cached = await cacheService.getFundInfo(code);
    if (cached) {
      console.log(`[缓存] 命中基金 ${code} 的基本信息`);
      return {
        code: cached.code,
        name: cached.name,
        type: cached.type || '未知',
        manager: cached.manager || '未知',
      };
    }

    // 缓存未命中，从API获取
    return await this.getFundInfoFromSina(code);
  }

  // 获取基金重仓股（先查缓存，再查API）
  async getFundStocks(code: string): Promise<FundStock[]> {
    // 先查缓存
    const cached = await cacheService.getStocks(code);
    if (cached && cached.length > 0) {
      console.log(`[缓存] 命中基金 ${code} 的重仓股数据`);
      return cached.map(s => ({
        code: s.stock_code,
        name: s.stock_name,
        proportion: s.proportion,
        price: 0,
        change: s.change_percent || 0,
      }));
    }

    // 缓存未命中，从API获取
    return await this.getFundStocksFromSina(code);
  }

  // 计算基金估值
  async calculateFundEstimate(code: string): Promise<FundEstimate | null> {
    try {
      console.log(`[估值] 开始计算基金 ${code} 的估值...`);

      // 获取基金基本信息
      const fundInfo = await this.getFundInfo(code);
      if (!fundInfo) {
        console.error(`[估值] 获取基金 ${code} 基本信息失败`);
        return null;
      }

      // 从新浪财经获取前一日净值
      let actual_value = 1.0;
      try {
        console.log(`[估值] 获取基金 ${code} 的前一日净值...`);
        // TODO: 实际应该从数据库或API获取真实净值
        actual_value = 1.0;
        console.log(`[估值] 使用默认净值: ${actual_value}`);
      } catch (error) {
        console.error('[估值] 获取前一日净值失败:', error);
        actual_value = 1.0;
      }

      let finalChange = 0;
      let stocks: FundStock[] = [];

      // 根据基金类型选择估值方法
      const fundType = fundInfo.type || '';

      if (fundType.includes('股票型') || fundType.includes('混合型')) {
        // 股票型/混合型：使用重仓股涨跌幅计算
        console.log(`[估值] ${fundType}基金，使用重仓股计算估值`);

        const fundStocks = await this.getFundStocks(code);
        if (fundStocks.length === 0) {
          console.error(`[估值] 获取基金 ${code} 重仓股数据失败`);
          return null;
        }

        stocks = fundStocks;

        // 根据重仓股的涨跌幅和占比计算基金估算涨跌幅
        let weightedChange = 0;
        for (const stock of stocks) {
          weightedChange += stock.change * (stock.proportion / 100);
        }
        finalChange = weightedChange;

      } else if (fundType.includes('指数型') || fundType.includes('ETF')) {
        // 指数型/ETF：显示提示，需要指数涨跌幅数据
        console.log(`[估值] ${fundType}基金，使用指数估算`);
        finalChange = 0; // 需要获取对应指数的涨跌幅
        stocks = [];

      } else if (fundType.includes('债券型')) {
        // 债券型：涨跌幅较小
        console.log(`[估值] ${fundType}基金，使用债券估算`);
        finalChange = 0.01; // 债券基金涨跌幅通常很小
        stocks = [];

      } else if (fundType.includes('货币型')) {
        // 货币型：几乎无涨跌
        console.log(`[估值] ${fundType}基金，使用货币估算`);
        finalChange = 0.001; // 货币基金涨跌幅极小
        stocks = [];

      } else if (fundType.includes('QDII')) {
        // QDII：需要海外市场数据
        console.log(`[估值] ${fundType}基金，需要海外数据`);
        finalChange = 0; // 需要获取海外市场数据
        stocks = [];

      } else {
        // 未知类型：尝试使用重仓股计算
        console.log(`[估值] 未知类型基金 (${fundType})，尝试使用重仓股计算`);
        const fundStocks = await this.getFundStocks(code);
        if (fundStocks.length > 0) {
          stocks = fundStocks;
          let weightedChange = 0;
          for (const stock of stocks) {
            weightedChange += stock.change * (stock.proportion / 100);
          }
          finalChange = weightedChange;
        } else {
          finalChange = 0;
        }
      }

      const estimate_value = actual_value * (1 + finalChange / 100);

      const fundEstimate: FundEstimate = {
        code: fundInfo.code,
        name: fundInfo.name,
        estimate_value: Number(estimate_value.toFixed(4)),
        actual_value,
        change_percent: Number(finalChange.toFixed(2)),
        update_time: new Date().toLocaleTimeString('zh-CN'),
        data_source: '新浪财经',
        stocks
      };

      // 缓存实时估值（短时缓存）
      cacheService.set(`fund:estimate:${code}`, fundEstimate, 30);

      console.log(`[估值] 基金 ${code} 估值计算完成`);
      console.log(`  类型: ${fundType}`);
      console.log(`  估算净值: ${fundEstimate.estimate_value}, 涨跌幅: ${fundEstimate.change_percent}%`);

      return fundEstimate;
    } catch (error) {
      console.error('[估值] 计算基金估值失败:', error);
      return null;
    }
  }

  // 批量获取基金估值
  async batchGetFundEstimates(codes: string[]): Promise<FundEstimate[]> {
    console.log(`[批量] 开始获取 ${codes.length} 只基金的数据`);
    console.log(`[批量] 基金代码: ${codes.join(', ')}`);

    const results: FundEstimate[] = [];

    for (const code of codes) {
      const estimate = await this.calculateFundEstimate(code);
      if (estimate) {
        results.push(estimate);
      }
    }

    console.log(`[批量] 完成，成功获取 ${results.length} 只基金的数据`);
    return results;
  }
}

const dataFetcherV2 = new DataFetcherV2();

export default dataFetcherV2;
export type { FundInfo, FundStock, FundEstimate };