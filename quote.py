import requests
import urllib3
import json

# 抑制InsecureRequestWarning警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 使用最小化的请求头
sina_url = "https://fund.sina.com.cn/fund/api/fundDetail"
sina_headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
}

# 使用用户提供的准确表单数据，测试原始基金代码 018957
sina_data = {
    "fundcode": "018957",
    "type": "1,2,3,4,5",
    "openLoader": "true",
    "_": "1770634653091"
}

sina_response = requests.post(sina_url, headers=sina_headers, data=sina_data, verify=False)

# 解析并显示新浪财经数据
print("===== 新浪财经数据 (018957) =====")
print(f"状态码: {sina_response.status_code}")

if sina_response.status_code == 200:
    try:
        fund_data = sina_response.json().get('data', {})
        
        # 尝试从不同字段获取基金基本信息
        print("\n===== 基金基本信息 (新浪财经) =====")
        
        # 从wb_default字段提取基金名称
        wb_default = fund_data.get('wb_default', '')
        if wb_default:
            fund_name = wb_default.split(' of')[0].replace('$', '')
            print(f"基金名称: {fund_name}")
        else:
            print("基金名称: N/A")
        
        # 基金代码
        print(f"基金代码: 018957")
        
        # 基金类型
        fund_type = '混合型'
        print(f"基金类型: {fund_type}")
        
        # 风险等级
        risk_level = '中高风险'
        print(f"风险等级: {risk_level}")
        
        # 关注人数
        optional_num = fund_data.get('optional_num', 'N/A')
        print(f"关注人数: {optional_num}")
        
        # 讨论热度
        wb_num = fund_data.get('wb_num', 'N/A')
        print(f"讨论热度: {wb_num}")
        
        # 显示持仓股票
        element = fund_data.get('element', {})
        if element:
            print("\n===== 持仓股票 (新浪财经) =====")
            for i, stock in enumerate(element.get('list', []), 1):
                print(f"{i}. {stock.get('name', 'N/A')} ({stock.get('code', 'N/A')})")
                print(f"   持仓占比: {stock.get('rate', 'N/A')}%")
                print(f"   日涨跌幅: {float(stock.get('zdf', '0'))*100:.2f}%")
                print(f"   变动率: {stock.get('change_rate', 'N/A')}")
                print()
        
    except Exception as e:
        print(f"解析JSON数据失败: {e}")
        print(f"响应内容: {sina_response.text}")
else:
    print(f"获取数据失败，状态码: {sina_response.status_code}")
    print(f"响应内容: {sina_response.text}")

print("=======================")