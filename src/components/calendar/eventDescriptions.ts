export const EVENT_DESCRIPTIONS: Record<string, string> = {
  cpi: "The Consumer Price Index measures the change in the price of goods and services from the consumer's perspective. It is the key measure of inflation. Higher than expected is generally bullish for the currency.",
  nfp: "Non-Farm Payrolls measures the change in the number of employed people in the US, excluding the farming industry. It is the most market-moving US economic release.",
  "non-farm": "Non-Farm Payrolls measures the change in the number of employed people in the US, excluding the farming industry. It is the most market-moving US economic release.",
  gdp: "Gross Domestic Product measures the annualised change in the inflation-adjusted value of all goods and services produced by the economy. It is the broadest measure of economic activity.",
  "rate decision": "Central bank interest rate decision. A rate hike is generally bullish for the currency; a rate cut is bearish. Forward guidance matters as much as the decision itself.",
  "cash rate": "Central bank interest rate decision. A rate hike is generally bullish for the currency; a rate cut is bearish.",
  pmi: "Purchasing Managers Index — a survey of business conditions. Above 50 indicates expansion, below 50 indicates contraction. One of the most timely economic indicators.",
  ppi: "Producer Price Index measures the change in the price of goods sold by manufacturers. A leading indicator of consumer inflation.",
  "retail sales": "Measures the change in the total value of sales at the retail level. The primary gauge of consumer spending, which accounts for the majority of overall economic activity.",
  "unemployment": "The unemployment rate measures the percentage of the total work force that is unemployed and actively seeking employment. A higher rate is typically bearish for the currency.",
  "trade balance": "The difference in value between imported and exported goods during the reported period. A positive number indicates more exports than imports.",
  "consumer confidence": "A survey of consumers measuring their optimism about current and future economic conditions. Higher confidence signals stronger consumer spending ahead.",
  "housing starts": "Measures the change in the annualised number of new residential buildings that began construction. A leading indicator of economic health.",
  "building permits": "The annualised number of new residential construction permits issued. Permits are a leading indicator of future construction activity.",
  "industrial production": "Measures the change in the total inflation-adjusted value of output produced by manufacturers, mines, and utilities.",
  "durable goods": "Measures the change in the total value of new purchase orders placed with manufacturers for durable goods. A leading indicator of production.",
  "ism manufacturing": "The Institute for Supply Management Manufacturing Index surveys purchasing managers. Above 50 indicates expansion in the manufacturing sector.",
  "existing home": "Measures the annualised number of existing residential buildings sold. Housing data is a key indicator of economic health.",
  "new home": "Measures the annualised number of new residential homes sold. An important gauge of housing market health and consumer sentiment.",
  "initial jobless": "Measures the number of individuals who filed for unemployment insurance for the first time. A timely indicator of labor market conditions.",
  "continuing claims": "Measures the number of unemployed individuals who continue to qualify for unemployment benefits.",
  "core cpi": "CPI excluding food and energy prices, which tend to be volatile. Core CPI is watched closely by central banks for underlying inflation trends.",
  "core pce": "Personal Consumption Expenditures Price Index excluding food and energy. The Federal Reserve's preferred inflation measure.",
  "manufacturing pmi": "Purchasing Managers Index for the manufacturing sector. Above 50 signals expansion; below 50 signals contraction.",
  "services pmi": "Purchasing Managers Index for the services sector. Above 50 signals expansion. Services typically represent 70%+ of developed economies.",
  "employment change": "Measures the change in the number of employed people. Job creation is an important indicator of consumer spending.",
};

export const OFFICIAL_SOURCES: Record<string, { label: string; url: string }> = {
  USD: { label: "Federal Reserve / BLS", url: "https://www.federalreserve.gov" },
  EUR: { label: "European Central Bank", url: "https://www.ecb.europa.eu" },
  GBP: { label: "Bank of England", url: "https://www.bankofengland.co.uk" },
  AUD: { label: "Reserve Bank of Australia", url: "https://www.rba.gov.au" },
  CAD: { label: "Bank of Canada", url: "https://www.bankofcanada.ca" },
  JPY: { label: "Bank of Japan", url: "https://www.boj.or.jp" },
  CHF: { label: "Swiss National Bank", url: "https://www.snb.ch" },
  NZD: { label: "Reserve Bank of NZ", url: "https://www.rbnz.govt.nz" },
  CNY: { label: "National Bureau of Statistics", url: "http://www.stats.gov.cn" },
};

export function getEventDescription(eventName: string): string {
  const lower = eventName.toLowerCase();
  for (const [key, desc] of Object.entries(EVENT_DESCRIPTIONS)) {
    if (lower.includes(key)) return desc;
  }
  return "A macroeconomic data release that can influence currency markets. Watch for deviations from the forecast value — larger surprises tend to produce bigger market moves.";
}
