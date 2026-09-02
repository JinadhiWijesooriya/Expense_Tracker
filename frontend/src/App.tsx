import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type View = 'Dashboard' | 'Transactions' | 'Categories' | 'Budgets' | 'Reports'
type Mode = 'login' | 'register'
type TransactionType = 'income' | 'expense'

type Category = { id: number; name: string; type: TransactionType }
type Transaction = {
  id: number
  category: number
  category_name: string
  amount: string
  type: TransactionType
  description: string
  date: string
}
type Budget = {
  id: number
  category: number
  category_name: string
  amount: string
  month: number
  year: number
  spent: string
  remaining: string
}
type BudgetStatus = { id: number; category: string; amount: string; spent: string; remaining: string }
type DashboardData = {
  income: string
  expenses: string
  balance: string
  monthly_expenses: string
  budget_status: BudgetStatus[]
  recent_transactions: Transaction[]
}
type MonthlyReport = { month: number; type: TransactionType; total: string }
type CategoryReport = { category__id: number; category__name: string; type: TransactionType; total: string }

const API_BASE = 'http://127.0.0.1:8000/api'
const nav: View[] = ['Dashboard', 'Transactions', 'Categories', 'Budgets', 'Reports']
const thisMonth = new Date().getMonth() + 1
const thisYear = new Date().getFullYear()
const money = (value: number | string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0))
const dateLabel = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(`${value}T00:00:00`))

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('access_token') || '')
  const [view, setView] = useState<View>('Dashboard')
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [monthlyReports, setMonthlyReports] = useState<MonthlyReport[]>([])
  const [categoryReports, setCategoryReports] = useState<CategoryReport[]>([])
  const [query, setQuery] = useState('')
  const [transactionForm, setTransactionForm] = useState({ type: 'expense' as TransactionType, category: '', amount: '', description: '', date: new Date().toISOString().slice(0, 10) })
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'expense' as TransactionType })
  const [budgetForm, setBudgetForm] = useState({ category: '', amount: '', month: thisMonth, year: thisYear })

  const authHeaders = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token])

  async function request<T>(path: string, options: RequestInit = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...(token ? authHeaders : { 'Content-Type': 'application/json' }), ...(options.headers || {}) },
    })
    if (response.status === 401) {
      logout()
      throw new Error('Session expired. Please log in again.')
    }
    if (!response.ok) {
      const detail = await response.json().catch(() => null)
      throw new Error(formatApiError(detail) || 'Something went wrong.')
    }
    return response.json() as Promise<T>
  }

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setToken('')
    setDashboard(null)
    setTransactions([])
    setCategories([])
    setBudgets([])
  }

  async function loadData() {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [dashboardData, transactionRows, categoryRows, budgetRows, monthlyRows, categoryReportRows] = await Promise.all([
        request<DashboardData>('/dashboard/'),
        request<Transaction[]>('/transactions/'),
        request<Category[]>('/categories/'),
        request<Budget[]>('/budgets/'),
        request<MonthlyReport[]>(`/reports/monthly/?year=${thisYear}`),
        request<CategoryReport[]>(`/reports/categories/?year=${thisYear}&month=${thisMonth}`),
      ])
      setDashboard(dashboardData)
      setTransactions(transactionRows)
      setCategories(categoryRows)
      setBudgets(budgetRows)
      setMonthlyReports(monthlyRows)
      setCategoryReports(categoryReportRows)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [token])

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mode === 'register') {
        await fetch(`${API_BASE}/auth/register/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, password }),
        }).then(async (response) => {
          if (!response.ok) throw new Error(formatApiError(await response.json().catch(() => null)) || 'Registration failed.')
        })
      }
      const tokens = await fetch(`${API_BASE}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      }).then(async (response) => {
        if (!response.ok) throw new Error(formatApiError(await response.json().catch(() => null)) || 'Login failed.')
        return response.json() as Promise<{ access: string; refresh: string }>
      })
      localStorage.setItem('access_token', tokens.access)
      localStorage.setItem('refresh_token', tokens.refresh)
      setToken(tokens.access)
      setPassword('')
      setNotice(mode === 'register' ? 'Account created and signed in.' : 'Signed in successfully.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in.')
    } finally {
      setLoading(false)
    }
  }

  async function save(path: string, body: object, success: string) {
    setLoading(true)
    setError('')
    try {
      await request(path, { method: 'POST', body: JSON.stringify(body) })
      setNotice(success)
      await loadData()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Save failed.')
    } finally {
      setLoading(false)
    }
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await save('/categories/', categoryForm, 'Category saved.')
    setCategoryForm({ name: '', type: categoryForm.type })
  }

  async function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await save('/transactions/', { ...transactionForm, category: Number(transactionForm.category) }, 'Transaction saved.')
    setTransactionForm((current) => ({ ...current, amount: '', description: '' }))
  }

  async function submitBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await save('/budgets/', { ...budgetForm, category: Number(budgetForm.category), month: Number(budgetForm.month), year: Number(budgetForm.year) }, 'Budget saved.')
    setBudgetForm((current) => ({ ...current, amount: '' }))
  }

  const filteredTransactions = transactions.filter((row) => `${row.description} ${row.category_name}`.toLowerCase().includes(query.toLowerCase()))
  const expenseCategories = categories.filter((category) => category.type === 'expense')
  const typedCategories = categories.filter((category) => category.type === transactionForm.type)

  if (!token) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div>
            <p className="eyebrow">EXPENSE TRACKER</p>
            <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
            <p className="subtitle">Track income, expenses, categories, budgets, and reports from one workspace.</p>
          </div>
          <form onSubmit={submitAuth} className="stack">
            <label>Username<input value={username} onChange={(event) => setUsername(event.target.value)} required autoComplete="username" /></label>
            {mode === 'register' && <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} required type="email" autoComplete="email" /></label>}
            <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} required type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
            {error && <p className="alert">{error}</p>}
            {notice && <p className="notice">{notice}</p>}
            <button className="primary" disabled={loading}>{loading ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
            <button className="ghost" type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Need an account?' : 'Already have an account?'}</button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="shell">
      <aside>
        <div className="brand"><b>$</b><span>Spendwise</span></div>
        <nav>{nav.map((item) => <button key={item} className={view === item ? 'selected' : ''} onClick={() => setView(item)}><i>{item[0]}</i>{item}</button>)}</nav>
        <button className="logout" onClick={logout}>Sign out</button>
      </aside>
      <section className="content">
        <header>
          <div><p className="eyebrow">LIVE WORKSPACE</p><h1>{view}</h1><p className="subtitle">{view === 'Dashboard' ? 'Your latest income, expenses, and budget position.' : `Manage your ${view.toLowerCase()} in one place.`}</p></div>
          <button className="primary" onClick={loadData} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
        </header>
        {notice && <p className="notice">{notice}</p>}
        {error && <p className="alert">{error}</p>}
        {view === 'Dashboard' && <Dashboard dashboard={dashboard} transactions={transactions} budgetStatus={dashboard?.budget_status || []} />}
        {view === 'Transactions' && <TransactionsPage categories={typedCategories} form={transactionForm} query={query} rows={filteredTransactions} setForm={setTransactionForm} setQuery={setQuery} submit={submitTransaction} />}
        {view === 'Categories' && <CategoriesPage categories={categories} form={categoryForm} setForm={setCategoryForm} submit={submitCategory} />}
        {view === 'Budgets' && <BudgetsPage budgets={budgets} categories={expenseCategories} form={budgetForm} setForm={setBudgetForm} submit={submitBudget} />}
        {view === 'Reports' && <ReportsPage monthlyReports={monthlyReports} categoryReports={categoryReports} />}
      </section>
    </main>
  )
}

function Dashboard({ dashboard, transactions, budgetStatus }: { dashboard: DashboardData | null; transactions: Transaction[]; budgetStatus: BudgetStatus[] }) {
  return (
    <>
      <section className="stats">
        <Stat name="Balance" value={money(dashboard?.balance || 0)} detail="Income minus expenses" />
        <Stat name="Income" value={money(dashboard?.income || 0)} detail="All recorded income" />
        <Stat name="Expenses" value={money(dashboard?.expenses || 0)} detail="All recorded expenses" />
        <Stat name="This month" value={money(dashboard?.monthly_expenses || 0)} detail="Monthly expense total" />
      </section>
      <section className="columns lower">
        <article className="card"><Title title="Recent transactions" /><Rows rows={dashboard?.recent_transactions.length ? dashboard.recent_transactions : transactions.slice(0, 5)} /></article>
        <article className="card"><Title title="Budget progress" />{budgetStatus.length ? budgetStatus.map((budget) => <BudgetBar key={budget.id} name={budget.category} used={Number(budget.spent)} limit={Number(budget.amount)} />) : <Empty text="Create expense categories and budgets to see progress here." />}</article>
      </section>
    </>
  )
}

function TransactionsPage({ rows, categories, query, form, setForm, setQuery, submit }: {
  rows: Transaction[]
  categories: Category[]
  query: string
  form: { type: TransactionType; category: string; amount: string; description: string; date: string }
  setForm: (value: { type: TransactionType; category: string; amount: string; description: string; date: string }) => void
  setQuery: (value: string) => void
  submit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return <section className="columns"><article className="card page"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search transactions" /><Rows rows={rows} /></article><article className="card page"><Title title="Add transaction" /><form className="stack" onSubmit={submit}><TypeSwitch value={form.type} onChange={(type) => setForm({ ...form, type, category: '' })} /><label>Category<select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Description<input required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label>Amount<input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label>Date<input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><button className="primary">Save transaction</button></form></article></section>
}

function CategoriesPage({ categories, form, setForm, submit }: { categories: Category[]; form: { name: string; type: TransactionType }; setForm: (value: { name: string; type: TransactionType }) => void; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <section className="columns"><article className="card page"><Title title="Categories" /><div className="categories">{categories.length ? categories.map((item) => <div key={item.id}><b>{item.name[0]}</b><strong>{item.name}</strong><small>{item.type}</small></div>) : <Empty text="No categories yet." />}</div></article><article className="card page"><Title title="Add category" /><form className="stack" onSubmit={submit}><TypeSwitch value={form.type} onChange={(type) => setForm({ ...form, type })} /><label>Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><button className="primary">Save category</button></form></article></section>
}

function BudgetsPage({ budgets, categories, form, setForm, submit }: { budgets: Budget[]; categories: Category[]; form: { category: string; amount: string; month: number; year: number }; setForm: (value: { category: string; amount: string; month: number; year: number }) => void; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <section className="columns"><article className="card page"><Title title="Monthly budgets" />{budgets.length ? budgets.map((budget) => <BudgetBar key={budget.id} name={budget.category_name} used={Number(budget.spent)} limit={Number(budget.amount)} />) : <Empty text="No budgets yet." />}</article><article className="card page"><Title title="Add budget" /><form className="stack" onSubmit={submit}><label>Category<select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option value="">Select expense category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Amount<input required min="0.01" step="0.01" type="number" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label>Month<input required min="1" max="12" type="number" value={form.month} onChange={(event) => setForm({ ...form, month: Number(event.target.value) })} /></label><label>Year<input required min="2000" type="number" value={form.year} onChange={(event) => setForm({ ...form, year: Number(event.target.value) })} /></label><button className="primary">Save budget</button></form></article></section>
}

function ReportsPage({ monthlyReports, categoryReports }: { monthlyReports: MonthlyReport[]; categoryReports: CategoryReport[] }) {
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1
    const income = Number(monthlyReports.find((row) => row.month === month && row.type === 'income')?.total || 0)
    const expenses = Number(monthlyReports.find((row) => row.month === month && row.type === 'expense')?.total || 0)
    return { month, income, expenses }
  })
  const max = Math.max(1, ...monthly.flatMap((row) => [row.income, row.expenses]))
  return <section className="columns"><article className="card page"><Title title="Income vs expenses" /><div className="report-bars">{monthly.map((row) => <span key={row.month}><i style={{ height: `${Math.max(4, (row.income / max) * 100)}%` }} /><em style={{ height: `${Math.max(4, (row.expenses / max) * 100)}%` }} /><small>{row.month}</small></span>)}</div></article><article className="card page"><Title title="Spending by category" /><div className="rows">{categoryReports.length ? categoryReports.map((row) => <div className="row" key={`${row.category__id}-${row.type}`}><i className={row.type}>{row.category__name[0]}</i><span><strong>{row.category__name}</strong><small>{row.type}</small></span><b className={row.type}>{money(row.total)}</b></div>) : <Empty text="No report data for this month." />}</div></article></section>
}

function TypeSwitch({ value, onChange }: { value: TransactionType; onChange: (value: TransactionType) => void }) {
  return <div className="type-switch"><button type="button" className={value === 'expense' ? 'selected' : ''} onClick={() => onChange('expense')}>Expense</button><button type="button" className={value === 'income' ? 'selected' : ''} onClick={() => onChange('income')}>Income</button></div>
}

function Stat({ name, value, detail }: { name: string; value: string; detail: string }) {
  return <article className="card stat"><p>{name}</p><h2>{value}</h2><small>{detail}</small></article>
}

function Title({ title }: { title: string }) {
  return <div className="title"><h2>{title}</h2></div>
}

function Rows({ rows }: { rows: Transaction[] }) {
  if (!rows.length) return <Empty text="No transactions yet." />
  return <div className="rows">{rows.map((item) => <div className="row" key={item.id}><i className={item.type}>{item.type === 'income' ? '+' : '-'}</i><span><strong>{item.description || item.category_name}</strong><small>{item.category_name} | {dateLabel(item.date)}</small></span><b className={item.type}>{item.type === 'income' ? '+' : '-'}{money(item.amount)}</b></div>)}</div>
}

function BudgetBar({ name, used, limit }: { name: string; used: number; limit: number }) {
  const percent = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100))
  return <div className="budget"><div><span>{name}</span><b>{money(used)} <small>of {money(limit)}</small></b></div><i><em style={{ width: `${percent}%` }} /></i><small>{percent}% used</small></div>
}

function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>
}

function formatApiError(detail: unknown) {
  if (!detail) return ''
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object') {
    return Object.entries(detail as Record<string, unknown>).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`).join(' ')
  }
  return ''
}

export default App
