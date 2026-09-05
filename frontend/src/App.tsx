import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type View = 'Dashboard' | 'Transactions' | 'Categories' | 'Budgets' | 'Reports'
type Mode = 'login' | 'register'
type TransactionType = 'income' | 'expense'
type Currency = 'USD' | 'LKR'
type ExportFormat = 'pdf' | 'csv'

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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const formatMoney = (value: number | string, currency: Currency = 'USD') => {
  const num = Number(value || 0)
  if (currency === 'LKR') {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
    return `Rs. ${formatted}`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

const getCurrencySymbol = (currency: Currency) => (currency === 'LKR' ? 'Rs.' : '$')

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`)
  )

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('access_token') || '')
  const [currency, setCurrency] = useState<Currency>(() => (localStorage.getItem('currency') as Currency) || 'USD')
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

  // Report Period and Format states
  const [reportYear, setReportYear] = useState(thisYear)
  const [reportMonth, setReportMonth] = useState(thisMonth)
  const [reportFormat, setReportFormat] = useState<ExportFormat>('pdf')

  // Edit states
  const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editingBudgetId, setEditingBudgetId] = useState<number | null>(null)

  const [transactionForm, setTransactionForm] = useState({
    type: 'expense' as TransactionType,
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().slice(0, 10),
  })
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'expense' as TransactionType })
  const [budgetForm, setBudgetForm] = useState({ category: '', amount: '', month: thisMonth, year: thisYear })

  const authHeaders = useMemo(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token]
  )

  function changeCurrency(newCurrency: Currency) {
    setCurrency(newCurrency)
    localStorage.setItem('currency', newCurrency)
    setNotice(`Currency switched to ${newCurrency === 'LKR' ? 'Rupees (Rs.)' : 'USD ($)'}.`)
  }

  async function request<T>(path: string, options: RequestInit = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...(token ? authHeaders : { 'Content-Type': 'application/json' }), ...(options.headers || {}) },
    })
    if (response.status === 401) {
      logout()
      throw new Error('Session expired. Please log in again.')
    }
    if (response.status === 204) {
      return null as T
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
    setEditingTransactionId(null)
    setEditingCategoryId(null)
    setEditingBudgetId(null)
  }

  async function loadData(targetYear = reportYear, targetMonth = reportMonth) {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [dashboardData, transactionRows, categoryRows, budgetRows, monthlyRows, categoryReportRows] =
        await Promise.all([
          request<DashboardData>('/dashboard/'),
          request<Transaction[]>('/transactions/'),
          request<Category[]>('/categories/'),
          request<Budget[]>('/budgets/'),
          request<MonthlyReport[]>(`/reports/monthly/?year=${targetYear}`),
          request<CategoryReport[]>(`/reports/categories/?year=${targetYear}&month=${targetMonth}`),
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

  async function handleReportPeriodChange(newYear: number, newMonth: number) {
    setReportYear(newYear)
    setReportMonth(newMonth)
    try {
      setLoading(true)
      const [monthlyRows, categoryReportRows] = await Promise.all([
        request<MonthlyReport[]>(`/reports/monthly/?year=${newYear}`),
        request<CategoryReport[]>(`/reports/categories/?year=${newYear}&month=${newMonth}`),
      ])
      setMonthlyReports(monthlyRows)
      setCategoryReports(categoryReportRows)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load reports for selected period.')
    } finally {
      setLoading(false)
    }
  }

  async function downloadStatement(year: number, month: number, format: ExportFormat) {
    try {
      setLoading(true)
      setError('')
      const endpoint =
        format === 'pdf'
          ? `/reports/download-pdf/?year=${year}&month=${month}&currency=${currency}`
          : `/reports/download/?year=${year}&month=${month}&currency=${currency}`

      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error(`Failed to download ${format.toUpperCase()} report.`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = format === 'pdf' ? 'pdf' : 'csv'
      a.download = `monthly_report_${year}_${String(month).padStart(2, '0')}_${currency}.${ext}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setNotice(
        `Monthly statement (${format.toUpperCase()}) for ${MONTH_NAMES[month - 1]} ${year} downloaded.`
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not download report.')
    } finally {
      setLoading(false)
    }
  }

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
          if (!response.ok)
            throw new Error(formatApiError(await response.json().catch(() => null)) || 'Registration failed.')
        })
      }
      const tokens = await fetch(`${API_BASE}/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      }).then(async (response) => {
        if (!response.ok) {
          const detail = await response.json().catch(() => null)
          if (response.status === 401) {
            throw new Error(detail?.detail || 'Invalid username or password.')
          }
          throw new Error(formatApiError(detail) || 'Login failed.')
        }
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

  async function deleteItem(path: string, successMessage: string) {
    if (!window.confirm('Are you sure you want to delete this item?')) return
    setLoading(true)
    setError('')
    setNotice('')
    try {
      await request(path, { method: 'DELETE' })
      setNotice(successMessage)
      await loadData()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Delete failed.')
    } finally {
      setLoading(false)
    }
  }

  // Transaction CRUD handlers
  function startEditTransaction(t: Transaction) {
    setEditingTransactionId(t.id)
    setTransactionForm({
      type: t.type,
      category: String(t.category),
      amount: t.amount,
      description: t.description,
      date: t.date,
    })
    setView('Transactions')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEditTransaction() {
    setEditingTransactionId(null)
    setTransactionForm({
      type: 'expense',
      category: '',
      amount: '',
      description: '',
      date: new Date().toISOString().slice(0, 10),
    })
  }

  async function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const payload = { ...transactionForm, category: Number(transactionForm.category) }
      if (editingTransactionId) {
        await request(`/transactions/${editingTransactionId}/`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        setNotice('Transaction updated successfully.')
      } else {
        await request('/transactions/', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setNotice('Transaction saved.')
      }
      cancelEditTransaction()
      await loadData()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Save failed.')
    } finally {
      setLoading(false)
    }
  }

  // Category CRUD handlers
  function startEditCategory(c: Category) {
    setEditingCategoryId(c.id)
    setCategoryForm({ name: c.name, type: c.type })
    setView('Categories')
  }

  function cancelEditCategory() {
    setEditingCategoryId(null)
    setCategoryForm({ name: '', type: 'expense' })
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    try {
      if (editingCategoryId) {
        await request(`/categories/${editingCategoryId}/`, {
          method: 'PUT',
          body: JSON.stringify(categoryForm),
        })
        setNotice('Category updated successfully.')
      } else {
        await request('/categories/', {
          method: 'POST',
          body: JSON.stringify(categoryForm),
        })
        setNotice('Category saved.')
      }
      cancelEditCategory()
      await loadData()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Save failed.')
    } finally {
      setLoading(false)
    }
  }

  // Budget CRUD handlers
  function startEditBudget(b: Budget) {
    setEditingBudgetId(b.id)
    setBudgetForm({
      category: String(b.category),
      amount: b.amount,
      month: b.month,
      year: b.year,
    })
    setView('Budgets')
  }

  function cancelEditBudget() {
    setEditingBudgetId(null)
    setBudgetForm({ category: '', amount: '', month: thisMonth, year: thisYear })
  }

  async function submitBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const payload = {
        ...budgetForm,
        category: Number(budgetForm.category),
        month: Number(budgetForm.month),
        year: Number(budgetForm.year),
      }
      if (editingBudgetId) {
        await request(`/budgets/${editingBudgetId}/`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        setNotice('Budget updated successfully.')
      } else {
        await request('/budgets/', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setNotice('Budget saved.')
      }
      cancelEditBudget()
      await loadData()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Save failed.')
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = transactions.filter((row) =>
    `${row.description} ${row.category_name}`.toLowerCase().includes(query.toLowerCase())
  )
  const expenseCategories = categories.filter((category) => category.type === 'expense')
  const typedCategories = categories.filter((category) => category.type === transactionForm.type)

  if (!token) {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="auth-header">
            <img src="/logo.png" alt="Spendwise Logo" className="auth-logo" />
            <p className="eyebrow">EXPENSE TRACKER</p>
            <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
            <p className="subtitle">Track income, expenses, categories, budgets, and reports from one workspace.</p>
          </div>
          <form onSubmit={submitAuth} className="stack">
            <label>
              Username
              <input value={username} onChange={(event) => setUsername(event.target.value)} required autoComplete="username" />
            </label>
            {mode === 'register' && (
              <label>
                Email
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  autoComplete="email"
                />
              </label>
            )}
            <label>
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>
            {error && <p className="alert">{error}</p>}
            {notice && <p className="notice">{notice}</p>}
            <button className="primary" disabled={loading}>
              {loading ? 'Working...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
            <button
              className="ghost"
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login')
                setError('')
                setNotice('')
              }}
            >
              {mode === 'login' ? 'Need an account?' : 'Already have an account?'}
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="shell">
      <aside>
        <div className="brand">
          <img src="/logo.png" alt="Spendwise Logo" className="brand-logo" />
          <div className="brand-text">
            <span>Spendwise</span>
            <small>Expense Tracker</small>
          </div>
        </div>
        <div className="currency-box">
          <label>Currency:</label>
          <div className="currency-toggle">
            <button
              type="button"
              className={currency === 'USD' ? 'active' : ''}
              onClick={() => changeCurrency('USD')}
            >
              $ USD
            </button>
            <button
              type="button"
              className={currency === 'LKR' ? 'active' : ''}
              onClick={() => changeCurrency('LKR')}
            >
              Rs. Rupees
            </button>
          </div>
        </div>
        <nav>
          {nav.map((item) => (
            <button
              key={item}
              className={view === item ? 'selected' : ''}
              onClick={() => {
                setView(item)
                setError('')
                setNotice('')
              }}
            >
              <i>{item[0]}</i>
              {item}
            </button>
          ))}
        </nav>
        <button className="logout" onClick={logout}>
          Sign out
        </button>
      </aside>
      <section className="content">
        <header>
          <div>
            <p className="eyebrow">LIVE WORKSPACE</p>
            <h1>{view}</h1>
            <p className="subtitle">
              {view === 'Dashboard'
                ? 'Your latest income, expenses, and budget position.'
                : `Manage your ${view.toLowerCase()} in one place.`}
            </p>
          </div>
          <div className="header-actions">
            <div className="header-currency-selector">
              <button
                type="button"
                className={`currency-pill ${currency === 'USD' ? 'selected' : ''}`}
                onClick={() => changeCurrency('USD')}
              >
                $ USD
              </button>
              <button
                type="button"
                className={`currency-pill ${currency === 'LKR' ? 'selected' : ''}`}
                onClick={() => changeCurrency('LKR')}
              >
                Rs. Rupees
              </button>
            </div>
            <button className="primary" onClick={() => loadData(reportYear, reportMonth)} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </header>
        {notice && <p className="notice">{notice}</p>}
        {error && <p className="alert">{error}</p>}
        {view === 'Dashboard' && (
          <Dashboard
            dashboard={dashboard}
            transactions={transactions}
            budgetStatus={dashboard?.budget_status || []}
            currency={currency}
            onEditTransaction={startEditTransaction}
            onDeleteTransaction={(id) => deleteItem(`/transactions/${id}/`, 'Transaction deleted.')}
          />
        )}
        {view === 'Transactions' && (
          <TransactionsPage
            categories={typedCategories}
            form={transactionForm}
            query={query}
            rows={filteredTransactions}
            currency={currency}
            editingId={editingTransactionId}
            setForm={setTransactionForm}
            setQuery={setQuery}
            submit={submitTransaction}
            onCancelEdit={cancelEditTransaction}
            onEdit={startEditTransaction}
            onDelete={(id) => deleteItem(`/transactions/${id}/`, 'Transaction deleted.')}
          />
        )}
        {view === 'Categories' && (
          <CategoriesPage
            categories={categories}
            form={categoryForm}
            editingId={editingCategoryId}
            setForm={setCategoryForm}
            submit={submitCategory}
            onCancelEdit={cancelEditCategory}
            onEdit={startEditCategory}
            onDelete={(id) => deleteItem(`/categories/${id}/`, 'Category deleted.')}
          />
        )}
        {view === 'Budgets' && (
          <BudgetsPage
            budgets={budgets}
            categories={expenseCategories}
            form={budgetForm}
            currency={currency}
            editingId={editingBudgetId}
            setForm={setBudgetForm}
            submit={submitBudget}
            onCancelEdit={cancelEditBudget}
            onEdit={startEditBudget}
            onDelete={(id) => deleteItem(`/budgets/${id}/`, 'Budget deleted.')}
          />
        )}
        {view === 'Reports' && (
          <ReportsPage
            monthlyReports={monthlyReports}
            categoryReports={categoryReports}
            year={reportYear}
            month={reportMonth}
            format={reportFormat}
            currency={currency}
            loading={loading}
            onPeriodChange={handleReportPeriodChange}
            onFormatChange={setReportFormat}
            onDownload={(year, month, format) => downloadStatement(year, month, format)}
          />
        )}
      </section>
    </main>
  )
}

function Dashboard({
  dashboard,
  transactions,
  budgetStatus,
  currency,
  onEditTransaction,
  onDeleteTransaction,
}: {
  dashboard: DashboardData | null
  transactions: Transaction[]
  budgetStatus: BudgetStatus[]
  currency: Currency
  onEditTransaction: (t: Transaction) => void
  onDeleteTransaction: (id: number) => void
}) {
  return (
    <>
      <section className="stats">
        <Stat name="Balance" value={formatMoney(dashboard?.balance || 0, currency)} detail="Income minus expenses" />
        <Stat name="Income" value={formatMoney(dashboard?.income || 0, currency)} detail="All recorded income" />
        <Stat name="Expenses" value={formatMoney(dashboard?.expenses || 0, currency)} detail="All recorded expenses" />
        <Stat name="This month" value={formatMoney(dashboard?.monthly_expenses || 0, currency)} detail="Monthly expense total" />
      </section>
      <section className="columns lower">
        <article className="card">
          <Title title="Recent transactions" />
          <Rows
            rows={
              dashboard?.recent_transactions.length
                ? dashboard.recent_transactions
                : transactions.slice(0, 5)
            }
            currency={currency}
            onEdit={onEditTransaction}
            onDelete={onDeleteTransaction}
          />
        </article>
        <article className="card">
          <Title title="Budget progress" />
          {budgetStatus.length ? (
            budgetStatus.map((budget) => (
              <BudgetBar
                key={budget.id}
                name={budget.category}
                used={Number(budget.spent)}
                limit={Number(budget.amount)}
                currency={currency}
              />
            ))
          ) : (
            <Empty text="Create expense categories and budgets to see progress here." />
          )}
        </article>
      </section>
    </>
  )
}

function TransactionsPage({
  rows,
  categories,
  query,
  form,
  currency,
  editingId,
  setForm,
  setQuery,
  submit,
  onCancelEdit,
  onEdit,
  onDelete,
}: {
  rows: Transaction[]
  categories: Category[]
  query: string
  form: { type: TransactionType; category: string; amount: string; description: string; date: string }
  currency: Currency
  editingId: number | null
  setForm: (value: { type: TransactionType; category: string; amount: string; description: string; date: string }) => void
  setQuery: (value: string) => void
  submit: (event: FormEvent<HTMLFormElement>) => void
  onCancelEdit: () => void
  onEdit: (t: Transaction) => void
  onDelete: (id: number) => void
}) {
  const symbol = getCurrencySymbol(currency)
  return (
    <section className="columns">
      <article className="card page">
        <div className="search-bar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search transactions by description or category..."
          />
          {query && (
            <button className="small-ghost" onClick={() => setQuery('')}>
              Clear
            </button>
          )}
        </div>
        <Rows rows={rows} currency={currency} onEdit={onEdit} onDelete={onDelete} activeEditId={editingId} />
      </article>
      <article className="card page">
        <div className="form-header">
          <Title title={editingId ? 'Edit transaction' : 'Add transaction'} />
          {editingId && (
            <button type="button" className="small-ghost" onClick={onCancelEdit}>
              Cancel Edit
            </button>
          )}
        </div>
        <form className="stack" onSubmit={submit}>
          <TypeSwitch
            value={form.type}
            onChange={(type) => setForm({ ...form, type, category: '' })}
          />
          <label>
            Category
            <select
              required
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Description
            <input
              required
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="e.g. Grocery shopping, Client payment"
            />
          </label>
          <label>
            Amount ({symbol})
            <input
              required
              min="0.01"
              step="0.01"
              type="number"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              placeholder="0.00"
            />
          </label>
          <label>
            Date
            <input
              required
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </label>
          <div className="form-actions">
            <button className="primary">
              {editingId ? 'Update transaction' : 'Save transaction'}
            </button>
            {editingId && (
              <button type="button" className="ghost" onClick={onCancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </article>
    </section>
  )
}

function CategoriesPage({
  categories,
  form,
  editingId,
  setForm,
  submit,
  onCancelEdit,
  onEdit,
  onDelete,
}: {
  categories: Category[]
  form: { name: string; type: TransactionType }
  editingId: number | null
  setForm: (value: { name: string; type: TransactionType }) => void
  submit: (event: FormEvent<HTMLFormElement>) => void
  onCancelEdit: () => void
  onEdit: (c: Category) => void
  onDelete: (id: number) => void
}) {
  return (
    <section className="columns">
      <article className="card page">
        <Title title="Categories" />
        <div className="categories">
          {categories.length ? (
            categories.map((item) => (
              <div key={item.id} className={`category-card ${editingId === item.id ? 'active-edit' : ''}`}>
                <div className="cat-top">
                  <b className={item.type}>{item.name[0]}</b>
                  <div className="actions">
                    <button
                      type="button"
                      className="btn-icon"
                      title="Edit category"
                      onClick={() => onEdit(item)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="btn-icon delete"
                      title="Delete category"
                      onClick={() => onDelete(item.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <strong>{item.name}</strong>
                <small className={item.type}>{item.type}</small>
              </div>
            ))
          ) : (
            <Empty text="No categories yet. Create one to get started." />
          )}
        </div>
      </article>
      <article className="card page">
        <div className="form-header">
          <Title title={editingId ? 'Edit category' : 'Add category'} />
          {editingId && (
            <button type="button" className="small-ghost" onClick={onCancelEdit}>
              Cancel Edit
            </button>
          )}
        </div>
        <form className="stack" onSubmit={submit}>
          <TypeSwitch value={form.type} onChange={(type) => setForm({ ...form, type })} />
          <label>
            Name
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="e.g. Groceries, Freelance, Utilities"
            />
          </label>
          <div className="form-actions">
            <button className="primary">{editingId ? 'Update category' : 'Save category'}</button>
            {editingId && (
              <button type="button" className="ghost" onClick={onCancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </article>
    </section>
  )
}

function BudgetsPage({
  budgets,
  categories,
  form,
  currency,
  editingId,
  setForm,
  submit,
  onCancelEdit,
  onEdit,
  onDelete,
}: {
  budgets: Budget[]
  categories: Category[]
  form: { category: string; amount: string; month: number; year: number }
  currency: Currency
  editingId: number | null
  setForm: (value: { category: string; amount: string; month: number; year: number }) => void
  submit: (event: FormEvent<HTMLFormElement>) => void
  onCancelEdit: () => void
  onEdit: (b: Budget) => void
  onDelete: (id: number) => void
}) {
  const symbol = getCurrencySymbol(currency)
  return (
    <section className="columns">
      <article className="card page">
        <Title title="Monthly budgets" />
        <div className="budget-list">
          {budgets.length ? (
            budgets.map((budget) => (
              <div key={budget.id} className={`budget-item-card ${editingId === budget.id ? 'active-edit' : ''}`}>
                <div className="budget-item-header">
                  <div>
                    <strong>{budget.category_name}</strong>
                    <span className="budget-period">
                      {budget.month}/{budget.year}
                    </span>
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      className="btn-icon"
                      title="Edit budget"
                      onClick={() => onEdit(budget)}
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="btn-icon delete"
                      title="Delete budget"
                      onClick={() => onDelete(budget.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <BudgetBar
                  name=""
                  used={Number(budget.spent)}
                  limit={Number(budget.amount)}
                  currency={currency}
                />
              </div>
            ))
          ) : (
            <Empty text="No budgets yet. Set a monthly spending limit for an expense category." />
          )}
        </div>
      </article>
      <article className="card page">
        <div className="form-header">
          <Title title={editingId ? 'Edit budget' : 'Add budget'} />
          {editingId && (
            <button type="button" className="small-ghost" onClick={onCancelEdit}>
              Cancel Edit
            </button>
          )}
        </div>
        <form className="stack" onSubmit={submit}>
          <label>
            Category
            <select
              required
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              <option value="">Select expense category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Amount ({symbol})
            <input
              required
              min="0.01"
              step="0.01"
              type="number"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
              placeholder="e.g. 500.00"
            />
          </label>
          <label>
            Month
            <input
              required
              min="1"
              max="12"
              type="number"
              value={form.month}
              onChange={(event) => setForm({ ...form, month: Number(event.target.value) })}
            />
          </label>
          <label>
            Year
            <input
              required
              min="2000"
              type="number"
              value={form.year}
              onChange={(event) => setForm({ ...form, year: Number(event.target.value) })}
            />
          </label>
          <div className="form-actions">
            <button className="primary">{editingId ? 'Update budget' : 'Save budget'}</button>
            {editingId && (
              <button type="button" className="ghost" onClick={onCancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </article>
    </section>
  )
}

function ReportsPage({
  monthlyReports,
  categoryReports,
  year,
  month,
  format,
  currency,
  loading,
  onPeriodChange,
  onFormatChange,
  onDownload,
}: {
  monthlyReports: MonthlyReport[]
  categoryReports: CategoryReport[]
  year: number
  month: number
  format: ExportFormat
  currency: Currency
  loading: boolean
  onPeriodChange: (year: number, month: number) => Promise<void>
  onFormatChange: (format: ExportFormat) => void
  onDownload: (year: number, month: number, format: ExportFormat) => Promise<void>
}) {
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const m = index + 1
    const income = Number(
      monthlyReports.find((row) => row.month === m && row.type === 'income')?.total || 0
    )
    const expenses = Number(
      monthlyReports.find((row) => row.month === m && row.type === 'expense')?.total || 0
    )
    return { month: m, income, expenses }
  })
  const max = Math.max(1, ...monthly.flatMap((row) => [row.income, row.expenses]))

  return (
    <>
      <div className="report-toolbar card">
        <div className="report-period-selector">
          <label>
            Month:
            <select
              value={month}
              onChange={(e) => void onPeriodChange(year, Number(e.target.value))}
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Year:
            <input
              type="number"
              min="2000"
              max="2099"
              value={year}
              onChange={(e) => void onPeriodChange(Number(e.target.value), month)}
            />
          </label>
        </div>

        <div className="report-export-controls">
          <div className="format-toggle">
            <label>Format:</label>
            <div className="format-pills">
              <button
                type="button"
                className={`format-pill ${format === 'pdf' ? 'active' : ''}`}
                onClick={() => onFormatChange('pdf')}
              >
                📄 PDF
              </button>
              <button
                type="button"
                className={`format-pill ${format === 'csv' ? 'active' : ''}`}
                onClick={() => onFormatChange('csv')}
              >
                📊 CSV
              </button>
            </div>
          </div>

          <button
            type="button"
            className={`download-btn primary ${format === 'pdf' ? 'btn-pdf' : 'btn-csv'}`}
            onClick={() => void onDownload(year, month, format)}
            disabled={loading}
          >
            <span>⬇</span> Download {format === 'pdf' ? 'PDF Statement' : 'CSV Statement'} ({currency === 'LKR' ? 'Rupees' : 'USD'})
          </button>
        </div>
      </div>

      <section className="columns">
        <article className="card page">
          <Title title={`Annual overview (${year})`} />
          <div className="report-bars">
            {monthly.map((row) => (
              <span key={row.month}>
                <i
                  style={{ height: `${Math.max(4, (row.income / max) * 100)}%` }}
                  title={`Income: ${formatMoney(row.income, currency)}`}
                />
                <em
                  style={{ height: `${Math.max(4, (row.expenses / max) * 100)}%` }}
                  title={`Expenses: ${formatMoney(row.expenses, currency)}`}
                />
                <small>{row.month}</small>
              </span>
            ))}
          </div>
        </article>
        <article className="card page">
          <Title title={`Spending by category (${MONTH_NAMES[month - 1]} ${year})`} />
          <div className="rows">
            {categoryReports.length ? (
              categoryReports.map((row) => (
                <div className="row" key={`${row.category__id}-${row.type}`}>
                  <i className={row.type}>{row.category__name[0]}</i>
                  <span>
                    <strong>{row.category__name}</strong>
                    <small>{row.type}</small>
                  </span>
                  <b className={row.type}>{formatMoney(row.total, currency)}</b>
                </div>
              ))
            ) : (
              <Empty text={`No report data for ${MONTH_NAMES[month - 1]} ${year}.`} />
            )}
          </div>
        </article>
      </section>
    </>
  )
}

function TypeSwitch({
  value,
  onChange,
}: {
  value: TransactionType
  onChange: (value: TransactionType) => void
}) {
  return (
    <div className="type-switch">
      <button
        type="button"
        className={value === 'expense' ? 'selected' : ''}
        onClick={() => onChange('expense')}
      >
        Expense
      </button>
      <button
        type="button"
        className={value === 'income' ? 'selected' : ''}
        onClick={() => onChange('income')}
      >
        Income
      </button>
    </div>
  )
}

function Stat({ name, value, detail }: { name: string; value: string; detail: string }) {
  return (
    <article className="card stat">
      <p>{name}</p>
      <h2>{value}</h2>
      <small>{detail}</small>
    </article>
  )
}

function Title({ title }: { title: string }) {
  return (
    <div className="title">
      <h2>{title}</h2>
    </div>
  )
}

function Rows({
  rows,
  currency = 'USD',
  onEdit,
  onDelete,
  activeEditId,
}: {
  rows: Transaction[]
  currency?: Currency
  onEdit?: (t: Transaction) => void
  onDelete?: (id: number) => void
  activeEditId?: number | null
}) {
  if (!rows.length) return <Empty text="No transactions found." />
  return (
    <div className="rows">
      {rows.map((item) => (
        <div className={`row ${activeEditId === item.id ? 'active-edit' : ''}`} key={item.id}>
          <i className={item.type}>{item.type === 'income' ? '+' : '-'}</i>
          <span>
            <strong>{item.description || item.category_name}</strong>
            <small>
              {item.category_name} | {dateLabel(item.date)}
            </small>
          </span>
          <b className={item.type}>
            {item.type === 'income' ? '+' : '-'}
            {formatMoney(item.amount, currency)}
          </b>
          {(onEdit || onDelete) && (
            <div className="actions row-actions">
              {onEdit && (
                <button
                  type="button"
                  className="btn-icon"
                  title="Edit transaction"
                  onClick={() => onEdit(item)}
                >
                  ✎
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="btn-icon delete"
                  title="Delete transaction"
                  onClick={() => onDelete(item.id)}
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function BudgetBar({
  name,
  used,
  limit,
  currency = 'USD',
}: {
  name?: string
  used: number
  limit: number
  currency?: Currency
}) {
  const percent = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100))
  const isOver = used > limit
  return (
    <div className="budget">
      <div>
        {name && <span>{name}</span>}
        <b className={isOver ? 'over-limit' : ''}>
          {formatMoney(used, currency)} <small>of {formatMoney(limit, currency)}</small>
        </b>
      </div>
      <i>
        <em
          style={{
            width: `${percent}%`,
            backgroundColor: isOver ? '#d85c63' : percent > 85 ? '#e6983b' : '#1f7a70',
          }}
        />
      </i>
      <small className={isOver ? 'over-limit-text' : ''}>
        {percent}% used {isOver ? '(Budget Exceeded)' : ''}
      </small>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>
}

function formatApiError(detail: unknown) {
  if (!detail) return ''
  if (typeof detail === 'string') return detail
  if (typeof detail === 'object') {
    return Object.entries(detail as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`)
      .join(' ')
  }
  return ''
}

export default App
