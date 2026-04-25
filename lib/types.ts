export type Affiliation = {
  id: string
  code: string   // 'TC' | 'SAVI' | 'EV'
  name: string
  created_at: string
}

export type Employee = {
  id: string
  affiliation_id: string
  name: string
  salary: number  // 단위: 백만원
  is_active: boolean
  created_at: string
  affiliation?: Affiliation
}

export type PerformanceDeal = {
  id: string
  employee_id: string
  title: string        // 성과거래제목
  calc_logic: string   // E머니 산출 로직
  ratio: number        // 비율적용 (0.1 = 10%)
  is_active: boolean
  created_at: string
  employee?: Employee
}

export type MonthlyKpi = {
  id: string
  performance_deal_id: string
  year: number
  month: number
  kpi_value: number      // 원천 KPI 수치
  direct_cost: number    // 직접비
  purchase_cost: number  // 매입비
  note: string | null
  created_at: string
  performance_deal?: PerformanceDeal
}

// 계산된 월별 성과 (화면 표시용)
export type MonthlyResult = {
  year: number
  month: number
  kpi_value: number
  earned: number       // 번돈 = kpi_value × ratio
  direct_cost: number  // 직접비
  purchase_cost: number // 매입비
  salary: number       // 급여
  spent: number        // 쓴돈 = 직접비 + 매입비 + 급여
  remaining: number    // 남는돈 = 번돈 - 쓴돈
  multiplier: number   // 배수 = 남는돈 / (급여 × 2)
}
