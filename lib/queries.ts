import { supabase } from './supabase'

// 전체 직원 + 성과거래 + 월별 KPI 조회
export async function getAllEmployeeResults(year: number, month: number) {
  const { data, error } = await supabase
    .from('monthly_kpi')
    .select(`
      *,
      performance_deal:performance_deals (
        *,
        employee:employees (
          *,
          affiliation:affiliations (*)
        )
      )
    `)
    .eq('year', year)
    .eq('month', month)

  if (error) throw error

  return data.map((row: any) => {
    const deal = row.performance_deal
    const employee = deal.employee
    const salary = employee.salary
    const earned = row.kpi_value * deal.ratio
    const spent = row.direct_cost + row.purchase_cost  // 급여는 쓴돈에 미포함
    const remaining = earned - spent
    const multiplier = salary * 2 > 0 ? remaining / (salary * 2) : 0

    return {
      employeeId: employee.id,
      affiliation: employee.affiliation.code,
      name: employee.name,
      title: deal.title,
      calcLogic: deal.calc_logic,
      ratio: deal.ratio,
      salary,
      kpiValue: row.kpi_value,
      earned,
      directCost: row.direct_cost,
      purchaseCost: row.purchase_cost,
      spent,
      remaining,
      multiplier,
      year: row.year,
      month: row.month,
    }
  })
}

// 특정 직원의 월별 누적 성과 조회
export async function getEmployeeResults(employeeId: string, year: number) {
  const { data, error } = await supabase
    .from('monthly_kpi')
    .select(`
      *,
      performance_deal:performance_deals (
        *,
        employee:employees (*)
      )
    `)
    .eq('performance_deal.employee_id', employeeId)
    .eq('year', year)
    .order('month')

  if (error) throw error
  return data
}
