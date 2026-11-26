export type IndicatorId =
  | "cpi"
  | "trade"
  | "industrial"
  | "retail"
  | "serviceSales"
  | "employment"
  | "unemployment"
  | "consumerSentiment"
  | "compositeIndex"
  | "coincidentIndex"
  | "leadingIndex"
  | "gdp"
  | "consumption"
  | "govConsumption"
  | "facilityInvestment"
  | "constructionInvestment"
  | "ipInvestment"
  | "naExport"
  | "naImport"
  | "currentAccount"
  | "usdkrw"
  | "kospi"
  | "kosdaq"
  | "call"
  | "ktb3y"
  | "ktb10y"
  | "ust1y"
  | "ust10y"
  | "ust30y"
  | "fedwatchHike"
  | "usdjpy"
  | "eurusd"
  | "usgdp"
  | "uscpi"
  | "uspce"
  | "usdIndex"
  | "usnasdaq"
  | "ussp500"
  | "usdjia"
  | "oilWti"
  | "oilDubai";

export type Frequency = "daily" | "weekly" | "monthly" | "quarterly";

export type Agency = "kostat" | "customs" | "bok" | "fred" | "cme" | "yahoo";

export type IndicatorGroupId =
  | "activity"
  | "financial-markets"
  | "national-accounts"
  | "overseas";

export interface IndicatorGroupMeta {
  id: IndicatorGroupId;
  nameKo: string;
  /** Optional English frequency label shown smaller and lowercase, e.g. "daily". */
  freqEn?: string;
}

export interface IndicatorMeta {
  id: IndicatorId;
  nameKo: string;
  nameEn: string;
  groupId: IndicatorGroupId;
  /** Optional nested label under a top-level group (e.g. 국고채 금리). */
  subgroupKo?: string;
  agency: Agency;
  agencyKo: string;
  frequency: Frequency;
  unit: string;
  sourceHint: string;
  /** Display / round digits for the level value. */
  valueDigits?: number;
}

export interface Observation {
  period: string;
  value: number;
  releasedAt: string;
  sourceUrl?: string;
  /** Optional FedWatch breakdown (percent). */
  hold?: number;
  hike25?: number;
  hike50Plus?: number;
  cut?: number;
  anyHike?: number;
  currentTarget?: string;
}

export interface ChangeFactor {
  indicatorId: IndicatorId;
  headline: string;
  detail: string;
  status: "draft" | "confirmed";
  updatedAt: string;
}

export interface UpcomingRelease {
  indicatorId: IndicatorId;
  expectedDate: string;
  label: string;
}

export interface TradeItemAgg {
  period: string;
  hsCode: string;
  nameKo: string;
  expEok: number;
  impEok: number;
  balEok: number;
}

export type ConsumptionComponentBundle = {
  id: "durable" | "semidurable" | "nondurable";
  nameKo: string;
  qoq: Observation[];
  yoy: Observation[];
};

export type StoredInstitutionOutlook = {
  institution: "bok" | "kdi" | "oecd" | "imf";
  nameKo: string;
  nameEn: string;
  title: string;
  publishedAt: string;
  sourceUrl: string;
  growthThisYear: number;
  growthNextYear: number;
  cpiThisYear: number | null;
  cpiNextYear: number | null;
  thisYearLabel: string;
  nextYearLabel: string;
  fetchedAt: string;
};

export interface DataStore {
  updatedAt: string;
  observations: Record<IndicatorId, Observation[]>;
  factors: ChangeFactor[];
  upcoming: UpcomingRelease[];
  lastNotifiedAt?: string;
  pendingNotifications: IndicatorId[];
  /** 주요 기관(한은·IMF·OECD) 경제전망 캐시 */
  outlooks?: StoredInstitutionOutlook[];
  outlooksCheckedAt?: string;
  outlooksUpdatedAt?: string;
  /** 관세청 품목별 수출입(주요 HS) */
  tradeItems?: TradeItemAgg[];
  tradeItemsUpdatedAt?: string;
  /** 월별 수출액(억 달러) */
  tradeExports?: Observation[];
  /** 민간소비 형태별(내구·준내구·비내구) 전기비·전년동기비 */
  consumptionComponents?: ConsumptionComponentBundle[];
  consumptionComponentsUpdatedAt?: string;
  /** 산업활동·소매판매·서비스판매 전년동월비 (관측값 observations는 전월비) */
  industrialYoy?: Observation[];
  retailYoy?: Observation[];
  serviceSalesYoy?: Observation[];
  /** 국민계정 원계열 전년동기비 (관측값 observations는 계절조정 전분기비) */
  gdpYoy?: Observation[];
  consumptionYoy?: Observation[];
  govConsumptionYoy?: Observation[];
  facilityInvestmentYoy?: Observation[];
  constructionInvestmentYoy?: Observation[];
  ipInvestmentYoy?: Observation[];
  naExportYoy?: Observation[];
  naImportYoy?: Observation[];
}
