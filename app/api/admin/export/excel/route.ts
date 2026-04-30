import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import * as XLSX from 'xlsx'

const FULL_EARNED = new Set(['임홍진', '김재훈'])

// 컬럼 인덱스 (0-based): A=0, B=1 ... L=11, M=12, N=13, O=14, P=15, Q=16, R=17
const COL = {
  B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10,
  L: 11, M: 12, N: 13, O: 14, P: 15, Q: 16, R: 17,
}

function cell(ws: XLSX.WorkSheet, col: number, row: number, value: any) {
  const ref = XLSX.utils.encode_cell({ c: col, r: row })
  ws[ref] = {
    v: value,
    t: typeof value === 'number' ? 'n' : 's',
  }
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: me } = await supabase
    .from('employees')
    .select('name, role')
    .eq('email', user.email)
    .single()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(req.url)
  const month = parseInt(url.searchParams.get('month') || '1')
  const year = parseInt(url.searchParams.get('year') || '2026')

  // 데이터 조회
  const [
    { data: allDeals },
    { data: allEmps },
    { data: affiliations },
    { data: kpiRows },
  ] = await Promise.all([
    supabase.from('performance_deals')
      .select('id, ratio, calc_type, kpi_1_percent, employee_id, partner_id, start_month, end_month')
      .eq('is_active', true),
    supabase.from('employees').select('id, name, salary, affiliation_id, email, employee_no, grade, position_title'),
    supabase.from('affiliations').select('id, code'),
    supabase.from('monthly_kpi').select('*').eq('year', year).eq('month', month),
  ])

  const affMap = Object.fromEntries((affiliations || []).map((a: any) => [a.id, a.code]))
  const empMap = Object.fromEntries((allEmps || []).map((e: any) => [
    e.id,
    { ...e, affCode: affMap[e.affiliation_id] ?? '' },
  ]))
  const kpiByDeal: Record<string, any> = {}
  for (const row of (kpiRows || [])) {
    kpiByDeal[row.performance_deal_id] = row
  }

  // 직원별 집계: earned, direct(직접비+외부매입), purchase(매입자로서 받는 금액)
  const empData: Record<string, {
    name: string; affCode: string; email: string
    employee_no: string; grade: string; position_title: string
    earned: number; direct: number; purchase: number
    order: number
  }> = {}

  let orderCounter = 0
  function getOrCreate(empId: string) {
    if (!empData[empId]) {
      const e = empMap[empId]
      if (!e) return null
      empData[empId] = {
        name: e.name, affCode: e.affCode, email: e.email ?? '',
        employee_no: e.employee_no ?? '', grade: e.grade ?? '', position_title: e.position_title ?? '',
        earned: 0, direct: 0, purchase: 0,
        order: orderCounter++,
      }
    }
    return empData[empId]
  }

  for (const deal of (allDeals || [])) {
    const sm = deal.start_month ?? 1
    const em = deal.end_month ?? 12
    if (month < sm || month > em) continue

    const kpi = kpiByDeal[deal.id]
    if (!kpi) continue

    const sellerEntry = getOrCreate(deal.employee_id)
    if (!sellerEntry) continue

    // 번돈 계산
    const kpi1 = deal.calc_type === 'product' && deal.kpi_1_percent
      ? kpi.kpi_value / 100
      : kpi.kpi_value
    const earned = deal.calc_type === 'product'
      ? kpi1 * (kpi.kpi_value_2 ?? 0) * deal.ratio
      : kpi.kpi_value * deal.ratio

    // 직접비 (직접 + 외부매입)
    const direct = (kpi.direct_cost ?? 0) + (kpi.external_purchase_cost ?? 0)

    sellerEntry.earned += earned
    sellerEntry.direct += direct

    // 매입자 집계
    if (deal.partner_id) {
      const buyerEntry = getOrCreate(deal.partner_id)
      if (buyerEntry) {
        const sellerName = empMap[deal.employee_id]?.name ?? ''
        const isFullEarned = FULL_EARNED.has(sellerName)
        const storedSpent = (kpi.direct_cost ?? 0) + (kpi.purchase_cost ?? 0) + (kpi.external_purchase_cost ?? 0)
        const contribution = isFullEarned ? earned : earned - storedSpent
        buyerEntry.purchase += contribution
      }
    }
  }

  // 소속별 → 이름 순으로 정렬
  const AFF_ORDER: Record<string, number> = { TC: 0, EV: 1, SAVI: 2 }
  const sorted = Object.values(empData).sort((a, b) => {
    const ao = AFF_ORDER[a.affCode] ?? 9
    const bo = AFF_ORDER[b.affCode] ?? 9
    if (ao !== bo) return ao - bo
    return a.order - b.order
  })

  // ─── Excel 생성 ───────────────────────────────────────────
  const wb = XLSX.utils.book_new()
  const ws: XLSX.WorkSheet = {}

  // 행 0~2: 상단 여백 / 단위 표시
  cell(ws, COL.P, 2, '단위:백만')  // Row 3 = index 2

  // 행 3 (Excel 4행): 1단계 헤더
  const h1: [number, string][] = [
    [COL.B, '법인'], [COL.C, '스탭/라인'], [COL.D, '부서'],
    [COL.E, '손익센터'], [COL.F, '이름'], [COL.G, 'email ID'],
    [COL.H, '사번'], [COL.I, '직급'], [COL.J, '직책'],
    [COL.K, '관리직/판전직'], [COL.L, '번돈'], [COL.M, '쓴돈'],
    [COL.P, '남는돈'], [COL.Q, '세금(24.2%)'], [COL.R, '찐이익'],
  ]
  for (const [c, v] of h1) cell(ws, c, 3, v)

  // 행 4 (Excel 5행): 2단계 헤더
  cell(ws, COL.G, 4, 'email ID')
  cell(ws, COL.L, 4, '매총익')
  cell(ws, COL.M, 4, '합계')

  // 행 5 (Excel 6행): 3단계 헤더
  cell(ws, COL.N, 5, '직접비')
  cell(ws, COL.O, 5, '매입비')

  // 행 6~: 데이터
  let ri = 6
  for (const emp of sorted) {
    const spent = emp.direct + emp.purchase
    const remaining = emp.earned - spent
    const tax = remaining > 0 ? round1(remaining * 0.242) : 0
    const netProfit = remaining > 0 ? round1(remaining - tax) : 0

    cell(ws, COL.B, ri, emp.affCode)
    cell(ws, COL.F, ri, emp.name)
    cell(ws, COL.G, ri, emp.email)
    if (emp.employee_no) cell(ws, COL.H, ri, emp.employee_no)
    if (emp.grade) cell(ws, COL.I, ri, emp.grade)
    if (emp.position_title) cell(ws, COL.J, ri, emp.position_title)
    cell(ws, COL.L, ri, round1(emp.earned))
    cell(ws, COL.M, ri, round1(spent))
    if (emp.direct > 0) cell(ws, COL.N, ri, round1(emp.direct))
    if (emp.purchase > 0) cell(ws, COL.O, ri, round1(emp.purchase))
    cell(ws, COL.P, ri, round1(remaining))
    if (tax > 0) cell(ws, COL.Q, ri, tax)
    if (netProfit > 0) cell(ws, COL.R, ri, netProfit)
    ri++
  }

  ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 21, r: ri - 1 } })

  // 열 너비 설정
  ws['!cols'] = [
    { wch: 4 },  // A
    { wch: 6 },  // B 법인
    { wch: 8 },  // C
    { wch: 10 }, // D
    { wch: 10 }, // E
    { wch: 10 }, // F 이름
    { wch: 22 }, // G email
    { wch: 8 },  // H 사번
    { wch: 6 },  // I 직급
    { wch: 10 }, // J 직책
    { wch: 12 }, // K
    { wch: 10 }, // L 번돈
    { wch: 10 }, // M 쓴돈
    { wch: 10 }, // N 직접비
    { wch: 10 }, // O 매입비
    { wch: 10 }, // P 남는돈
    { wch: 12 }, // Q 세금
    { wch: 10 }, // R 찐이익
  ]

  XLSX.utils.book_append_sheet(wb, ws, '이셀수지표(라인)')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  const filename = encodeURIComponent(`동남아_개인수지업로드_${year}년${month}월.xlsx`)

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
    },
  })
}
