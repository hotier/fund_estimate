import akshare as ak
import requests
import json

# Disable SSL certificate verification warnings
requests.packages.urllib3.disable_warnings()

# Patch the requests.get method to always set verify=False
original_get = requests.get
def patched_get(url, **kwargs):
    kwargs['verify'] = False
    return original_get(url, **kwargs)

requests.get = patched_get

# 获取基金列表
fund_name_em_df = ak.fund_name_em()
print(f"获取到 {len(fund_name_em_df)} 只基金")

# 转换为 JSON 格式
funds = []
for _, row in fund_name_em_df.iterrows():
    fund = {
        'code': str(row['基金代码']).zfill(6),
        'name': row['基金简称'],
        'type': row['基金类型']
    }
    funds.append(fund)

# 保存为 JSON 文件
output_file = 'funds-index-full.json'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(funds, f, ensure_ascii=False, indent=2)

print(f"✅ 数据已保存到 {output_file}")
print(f"📊 总计: {len(funds)} 只基金")
