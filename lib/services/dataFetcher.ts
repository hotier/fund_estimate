// 数据抓取服务
// 从腾讯证券获取基金数据

import axios from 'axios';
import * as cheerio from 'cheerio';

// 基金基本信息接口
interface FundInfo {
  code: string;
  name: string;
  type: string;
  manager: string;
}

// 基金重仓股接口
interface FundStock {
  code: string;
  name: string;
  proportion: number; // 占比
  price: number; // 当前价格
  change: number; // 涨跌幅
}

// 基金估值接口
interface FundEstimate {
  code: string;
  name: string;
  estimate_value: number; // 估算净值
  actual_value: number; // 实际净值（前一日）
  change_percent: number; // 估算涨跌幅
  update_time: string;
  data_source: string;
  stocks?: FundStock[]; // 重仓股数据
}

class DataFetcher {
  // 从新浪财经API获取基金基本信息
  async getFundInfo(code: string): Promise<FundInfo | null> {
    try {
      console.log(`开始获取基金 ${code} 的基本信息...`);
      
      // 从新浪财经API获取基金基本信息
      const url = "https://fund.sina.com.cn/fund/api/fundDetail";
      const response = await axios.post(url, {
        fundcode: code,
        type: "1,2,3,4,5",
        openLoader: "true",
        _: "1770634653091" // 使用固定的时间戳，与 Python 脚本中一致
      }, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000,
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
      });
      
      console.log(`获取到基金 ${code} 的基本信息，状态码: ${response.status}`);
      console.log(`API返回数据:`, JSON.stringify(response.data, null, 2));
      
      // 解析API返回的数据
      const fundData = response.data.data;
      if (!fundData) {
        console.error(`未找到基金 ${code} 的数据`);
        return null;
      }
      
      // 从wb_default字段提取基金名称
      const wb_default = fundData.wb_default || '';
      let name = '';
      if (wb_default) {
        name = wb_default.split(' of')[0].replace('$', '').trim();
      }
      if (!name) {
        console.error(`未找到基金 ${code} 的名称`);
        return null;
      }
      
      // 提取基金类型和经理信息
      const type = '混合型'; // 新浪财经数据中没有明确的基金类型字段
      const manager = '未知经理'; // 新浪财经数据中没有明确的基金经理字段
      
      console.log(`成功获取基金 ${code} 的基本信息: 名称=${name}, 类型=${type}, 经理=${manager}`);
      
      return {
        code,
        name,
        type,
        manager
      };
    } catch (error) {
      console.error('获取基金基本信息失败:', error);
      return null;
    }
  }

  // 从新浪财经API获取基金持仓数据
  async getFundStocks(code: string): Promise<FundStock[]> {
    try {
      console.log(`开始获取基金 ${code} 的重仓股数据...`);
      
      // 从新浪财经API获取基金持仓数据
      const url = "https://fund.sina.com.cn/fund/api/fundDetail";
      const response = await axios.post(url, {
        fundcode: code,
        type: "1,2,3,4,5",
        openLoader: "true",
        _: "1770634653091" // 使用固定的时间戳，与 Python 脚本中一致
      }, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000,
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
      });
      
      // 解析API返回的数据
      const fundData = response.data.data;
      if (!fundData) {
        console.error(`未找到基金 ${code} 的数据`);
        return [];
      }
      
      // 提取持仓股票
      const element = fundData.element || {};
      const stockList = element.list || [];
      if (stockList.length === 0) {
        console.error(`基金 ${code} 没有持仓股票数据`);
        return [];
      }
      
      // 转换为 FundStock 类型
      const stocks: FundStock[] = stockList.map((stock: any) => ({
        code: stock.code || '',
        name: stock.name || '',
        proportion: parseFloat(stock.rate) || 0,
        price: 0, // 新浪财经数据中没有股票当前价格字段
        change: (parseFloat(stock.zdf) || 0) * 100 // 新浪API返回的是小数，需要乘以100
      }));
      
      console.log(`成功获取基金 ${code} 的 ${stocks.length} 只重仓股`);
      
      // 打印每只重仓股的详细信息
      console.log('重仓股详细信息:');
      stocks.forEach((stock, index) => {
        console.log(`${index + 1}. ${stock.name} (${stock.code}): 占比=${stock.proportion}%, 价格=${stock.price}, 涨跌幅=${stock.change}%`);
      });
      
      return stocks;
    } catch (error) {
      console.error('获取基金重仓股数据失败:', error);
      return [];
    }
  }

  // 计算基金估值
  async calculateFundEstimate(code: string): Promise<FundEstimate | null> {
    try {
      console.log(`开始计算基金 ${code} 的估值...`);
      
      // 获取基金基本信息
      const fundInfo = await this.getFundInfo(code);
      if (!fundInfo) {
        console.error(`获取基金 ${code} 基本信息失败`);
        return null;
      }

      // 获取基金重仓股数据
      const stocks = await this.getFundStocks(code);
      if (stocks.length === 0) {
        console.error(`获取基金 ${code} 重仓股数据失败`);
        return null;
      }

      // 从新浪财经获取前一日净值
      let actual_value = 1.0; // 默认值
      try {
        console.log(`开始获取基金 ${code} 的前一日净值...`);
        
        // 从新浪财经API获取基金基本信息，尝试从中提取净值信息
        try {
          const apiUrl = "https://fund.sina.com.cn/fund/api/fundDetail";
          const apiResponse = await axios.post(apiUrl, {
            fundcode: code,
            type: "1,2,3,4,5",
            openLoader: "true",
            _: "1770634653091" // 使用固定的时间戳，与 Python 脚本中一致
          }, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000,
            httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
          });
          
          // 解析API返回的数据
          const fundData = apiResponse.data.data;
          if (fundData) {
            // 新浪财经API没有直接提供净值数据，使用默认值
            actual_value = 1.0;
            console.log(`从新浪财经API获取基金 ${code} 的净值数据，使用默认值: ${actual_value}`);
          }
        } catch (apiError) {
          console.error('从新浪财经API获取前一日净值失败:', apiError);
        }
        
        console.log(`最终获取到基金 ${code} 的前一日净值: ${actual_value}`);
      } catch (error) {
        console.error('获取前一日净值失败:', error);
        actual_value = 1.0; // 使用默认值
      }

      // 根据重仓股的涨跌幅和占比计算基金估算涨跌幅
      let weightedChange = 0;
      let totalProportion = 0;

      for (const stock of stocks) {
        weightedChange += stock.change * (stock.proportion / 100);
        totalProportion += stock.proportion;
      }

      // 考虑其他资产的影响（假设其他资产占比为100% - totalProportion）
      // 简化计算，假设其他资产涨跌幅为0
      const finalChange = weightedChange;

      // 计算估算净值
      const estimate_value = actual_value * (1 + finalChange / 100);

      // 构造最终的基金估值结果
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

      // 打印最终的估值结果
      console.log('基金估值计算结果:');
      console.log(`基金代码: ${fundEstimate.code}`);
      console.log(`基金名称: ${fundEstimate.name}`);
      console.log(`前一日净值: ${fundEstimate.actual_value}`);
      console.log(`估算净值: ${fundEstimate.estimate_value}`);
      console.log(`估算涨跌幅: ${fundEstimate.change_percent}%`);
      console.log(`更新时间: ${fundEstimate.update_time}`);
      console.log(`数据来源: ${fundEstimate.data_source}`);
      console.log('----------------------------');

      return fundEstimate;
    } catch (error) {
      console.error('计算基金估值失败:', error);
      return null;
    }
  }

  // 批量获取基金估值
  async batchGetFundEstimates(codes: string[]): Promise<FundEstimate[]> {
    console.log(`开始批量获取基金估值，共 ${codes.length} 只基金`);
    console.log(`基金代码列表: ${codes.join(', ')}`);
    
    const results: FundEstimate[] = [];

    for (const code of codes) {
      console.log(`\n处理基金: ${code}`);
      console.log('----------------------------');
      const estimate = await this.calculateFundEstimate(code);
      if (estimate) {
        results.push(estimate);
      }
    }

    console.log(`\n批量获取基金估值完成`);
    console.log(`成功获取 ${results.length} 只基金的数据`);
    
    // 打印批量获取的结果摘要
    if (results.length > 0) {
      console.log('批量获取结果摘要:');
      results.forEach((fund, index) => {
        console.log(`${index + 1}. ${fund.name} (${fund.code}): 估算净值=${fund.estimate_value}, 涨跌幅=${fund.change_percent}%`);
      });
    }
    
    return results;
  }
}

const dataFetcher = new DataFetcher();

export default dataFetcher;
export type { FundInfo, FundStock, FundEstimate };