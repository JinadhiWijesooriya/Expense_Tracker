import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

type View = 'Dashboard' | 'Transactions' | 'Accounts' | 'Categories' | 'Budgets' | 'Reports'
type Mode = 'login' | 'register'
type TransactionType = 'income' | 'expense'
type AccountType = 'cash' | 'bank' | 'card' | 'wallet'
type Currency = 'USD' | 'LKR'
type ExportFormat = 'pdf' | 'csv'
type Theme = 'light' | 'dark'

type Category = { id: number; name: string; type: TransactionType }
type Account = {
  id: number
  name: string
  account_type: AccountType
  initial_balance: string
  color: string
  current_balance: string
  created_at: string
}
type Transaction = {
  id: number
  category: number
  category_name: string
  account?: number | null
  account_name?: string
  amount: string
  type: TransactionType
  description: string
  date: string
  receipt: string | null
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
const nav: View[] = ['Dashboard', 'Transactions', 'Accounts', 'Categories', 'Budgets', 'Reports']
const thisMonth = new Date().getMonth() + 1
const thisYear = new Date().getFullYear()

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const CHART_COLORS = [
  '#1f7a70', '#0ea5e9', '#f59e0b', '#ec4899', '#8b5cf6',
  '#10b981', '#f97316', '#6366f1', '#14b8a6', '#e11d48'
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
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light')
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
  const [accounts, setAccounts] = useState<Account[]>([])
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
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null)

  // Receipt Modal state
  const [activeReceipt, setActiveReceipt] = useState<{ url: string; description: string } | null>(null)

  const [transactionForm, setTransactionForm] = useState({
    type: 'expense' as TransactionType,
    category: '',
    account: '',
    amount: '',
    description: '',
    date: new Date().toISOString().slice(0, 10),
  })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'expense' as TransactionType })
  const [accountForm, setAccountForm] = useState({
    name: '',
    account_type: 'cash' as AccountType,
    initial_balance: '0.00',
    color: '#1f7a70',
  })
  const [budgetForm, setBudgetForm] = useState({ category: '', amount: '', month: thisMonth, year: thisYear })

  const authHeaders = useMemo(
    () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }),
    [token]
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  function toggleTheme() {
    const nextTheme: Theme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    setNotice(`Switched to ${nextTheme} mode.`)
  }

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
    setAccounts([])
    setEditingTransactionId(null)
    setEditingCategoryId(null)
    setEditingBudgetId(null)
    setEditingAccountId(null)
    setActiveReceipt(null)
  }

  async function loadData(targetYear = reportYear, targetMonth = reportMonth) {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [dashboardData, transactionRows, categoryRows, budgetRows, accountRows, monthlyRows, categoryReportRows] =
        await Promise.all([
          request<DashboardData>('/dashboard/'),
          request<Transaction[]>('/transactions/'),
          request<Category[]>('/categories/'),
          request<Budget[]>('/budgets/'),
          request<Account[]>('/accounts/'),
          request<MonthlyReport[]>(`/reports/monthly/?year=${targetYear}`),
          request<CategoryReport[]>(`/reports/categories/?year=${targetYear}&month=${targetMonth}`),
        ])
      setDashboard(dashboardData)
      setTransactions(transactionRows)
      setCategories(categoryRows)
      setBudgets(budgetRows)
      setAccounts(accountRows)
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
      account: t.account ? String(t.account) : '',
      amount: t.amount,
      description: t.description,
      date: t.date,
    })
    setReceiptFile(null)
    setView('Transactions')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEditTransaction() {
    setEditingTransactionId(null)
    setReceiptFile(null)
    setTransactionForm({
      type: 'expense',
      category: '',
      account: '',
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
      const formData = new FormData()
      formData.append('type', transactionForm.type)
      formData.append('category', String(transactionForm.category))
      if (transactionForm.account) {
        formData.append('account', String(transactionForm.account))
      }
      formData.append('amount', String(transactionForm.amount))
      formData.append('description', transactionForm.description)
      formData.append('date', transactionForm.date)
      if (receiptFile) {
        formData.append('receipt', receiptFile)
      }

      const url = editingTransactionId
        ? `${API_BASE}/transactions/${editingTransactionId}/`
        : `${API_BASE}/transactions/`
      const method = editingTransactionId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!response.ok) {
        const detail = await response.json().catch(() => null)
        throw new Error(formatApiError(detail) || 'Failed to save transaction.')
      }

      setNotice(
        editingTransactionId
          ? 'Transaction updated successfully.'
          : receiptFile
          ? 'Transaction saved with receipt attachment.'
          : 'Transaction saved.'
      )
      cancelEditTransaction()
      await loadData()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Save failed.')
    } finally {
      setLoading(false)
    }
  }

  // Account CRUD handlers
  function startEditAccount(acc: Account) {
    setEditingAccountId(acc.id)
    setAccountForm({
      name: acc.name,
      account_type: acc.account_type,
      initial_balance: acc.initial_balance,
      color: acc.color || '#1f7a70',
    })
    setView('Accounts')
  }

  function cancelEditAccount() {
    setEditingAccountId(null)
    setAccountForm({
      name: '',
      account_type: 'cash',
      initial_balance: '0.00',
      color: '#1f7a70',
    })
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const payload = {
        name: accountForm.name,
        account_type: accountForm.account_type,
        initial_balance: accountForm.initial_balance,
        color: accountForm.color,
      }
      if (editingAccountId) {
        await request<Account>(`/accounts/${editingAccountId}/`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
        setNotice('Account updated.')
      } else {
        await request<Account>('/accounts/', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setNotice('Account created.')
      }
      cancelEditAccount()
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
        <div className="auth-theme-toggle">
          <button type="button" className="theme-switch-btn" onClick={toggleTheme}>
            {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
        </div>
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
            <button
              type="button"
              className="theme-switch-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
            </button>
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
            monthlyReports={monthlyReports}
            categoryReports={categoryReports}
            budgetStatus={dashboard?.budget_status || []}
            currency={currency}
            theme={theme}
            onEditTransaction={startEditTransaction}
            onDeleteTransaction={(id) => deleteItem(`/transactions/${id}/`, 'Transaction deleted.')}
            onViewReceipt={(url, desc) => setActiveReceipt({ url, description: desc })}
          />
        )}
        {view === 'Transactions' && (
          <TransactionsPage
            categories={typedCategories}
            accounts={accounts}
            form={transactionForm}
            query={query}
            rows={filteredTransactions}
            currency={currency}
            editingId={editingTransactionId}
            receiptFile={receiptFile}
            setReceiptFile={setReceiptFile}
            setForm={setTransactionForm}
            setQuery={setQuery}
            submit={submitTransaction}
            onCancelEdit={cancelEditTransaction}
            onEdit={startEditTransaction}
            onDelete={(id) => deleteItem(`/transactions/${id}/`, 'Transaction deleted.')}
            onViewReceipt={(url, desc) => setActiveReceipt({ url, description: desc })}
          />
        )}
        {view === 'Accounts' && (
          <AccountsPage
            accounts={accounts}
            form={accountForm}
            currency={currency}
            editingId={editingAccountId}
            setForm={setAccountForm}
            submit={submitAccount}
            onCancelEdit={cancelEditAccount}
            onEdit={startEditAccount}
            onDelete={(id) => deleteItem(`/accounts/${id}/`, 'Account deleted.')}
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
            theme={theme}
            loading={loading}
            onPeriodChange={handleReportPeriodChange}
            onFormatChange={setReportFormat}
            onDownload={(year, month, format) => downloadStatement(year, month, format)}
          />
        )}
      </section>

      {/* Lightbox Modal for Receipt Attachment */}
      {activeReceipt && (
        <ReceiptModal
          url={activeReceipt.url}
          description={activeReceipt.description}
          onClose={() => setActiveReceipt(null)}
        />
      )}
    </main>
  )
}

function ReceiptModal({
  url,
  description,
  onClose,
}: {
  url: string
  description: string
  onClose: () => void
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Receipt Attachment</h3>
          <button type="button" className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="modal-subtitle">{description || 'Attached Receipt / Bill'}</p>
        <div className="receipt-preview-box">
          <img src={url} alt="Receipt Preview" />
        </div>
        <div className="modal-actions">
          <a href={url} target="_blank" rel="noopener noreferrer" className="primary btn-link">
            <span>↗</span> Open Full Resolution
          </a>
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function CustomTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean
  payload?: any[]
  label?: string
  currency: Currency
}) {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip-box">
        <p className="chart-tooltip-title">{label}</p>
        {payload.map((entry, idx) => (
          <p key={idx} className="chart-tooltip-row" style={{ color: entry.color || entry.fill }}>
            <span>{entry.name}:</span> <b>{formatMoney(entry.value, currency)}</b>
          </p>
        ))}
      </div>
    )
  }
  return null
}

function Dashboard({
  dashboard,
  transactions,
  monthlyReports,
  categoryReports,
  budgetStatus,
  currency,
  theme,
  onEditTransaction,
  onDeleteTransaction,
  onViewReceipt,
}: {
  dashboard: DashboardData | null
  transactions: Transaction[]
  monthlyReports: MonthlyReport[]
  categoryReports: CategoryReport[]
  budgetStatus: BudgetStatus[]
  currency: Currency
  theme: Theme
  onEditTransaction: (t: Transaction) => void
  onDeleteTransaction: (id: number) => void
  onViewReceipt: (url: string, description: string) => void
}) {

  const trendData = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const m = index + 1
      const income = Number(
        monthlyReports.find((row) => row.month === m && row.type === 'income')?.total || 0
      )
      const expenses = Number(
        monthlyReports.find((row) => row.month === m && row.type === 'expense')?.total || 0
      )
      return {
        month: MONTH_SHORT[index],
        Income: income,
        Expenses: expenses,
      }
    })
  }, [monthlyReports])

  const pieData = useMemo(() => {
    return categoryReports
      .filter((row) => row.type === 'expense')
      .map((row) => ({
        name: row.category__name,
        value: Number(row.total),
      }))
  }, [categoryReports])

  const gridColor = theme === 'dark' ? '#23304c' : '#eef1f6'
  const textColor = theme === 'dark' ? '#94a3b8' : '#64748b'

  return (
    <>
      <section className="stats">
        <Stat name="Balance" value={formatMoney(dashboard?.balance || 0, currency)} detail="Income minus expenses" />
        <Stat name="Income" value={formatMoney(dashboard?.income || 0, currency)} detail="All recorded income" />
        <Stat name="Expenses" value={formatMoney(dashboard?.expenses || 0, currency)} detail="All recorded expenses" />
        <Stat name="This month" value={formatMoney(dashboard?.monthly_expenses || 0, currency)} detail="Monthly expense total" />
      </section>

      {/* Interactive Charts Section */}
      <section className="columns charts-section">
        <article className="card chart-card">
          <Title title="Cashflow Trend (Annual)" />
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="month" stroke={textColor} fontSize={12} tickLine={false} />
                <YAxis stroke={textColor} fontSize={12} tickLine={false} tickFormatter={(v) => `${v}`} />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Area type="monotone" dataKey="Income" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#incomeGrad)" />
                <Area type="monotone" dataKey="Expenses" stroke="#f43f5e" strokeWidth={2.5} fillOpacity={1} fill="url(#expenseGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card chart-card">
          <Title title="Category Breakdown" />
          <div className="chart-wrapper">
            {pieData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip currency={currency} />} />
                  <Legend
                    formatter={(value) => <span style={{ color: textColor, fontSize: '11px', fontWeight: 600 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty text="No expense breakdown available for this period." />
            )}
          </div>
        </article>
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
            onViewReceipt={onViewReceipt}
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

function AccountsPage({
  accounts,
  form,
  currency,
  editingId,
  setForm,
  submit,
  onCancelEdit,
  onEdit,
  onDelete,
}: {
  accounts: Account[]
  form: { name: string; account_type: AccountType; initial_balance: string; color: string }
  currency: Currency
  editingId: number | null
  setForm: (value: { name: string; account_type: AccountType; initial_balance: string; color: string }) => void
  submit: (event: FormEvent<HTMLFormElement>) => void
  onCancelEdit: () => void
  onEdit: (a: Account) => void
  onDelete: (id: number) => void
}) {
  const symbol = getCurrencySymbol(currency)

  const totalNetWorth = useMemo(() => {
    return accounts.reduce((acc, a) => acc + Number(a.current_balance || 0), 0)
  }, [accounts])

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
      case 'bank': return '🏦'
      case 'card': return '💳'
      case 'wallet': return '👛'
      default: return '💵'
    }
  }

  const getAccountTypeName = (type: AccountType) => {
    switch (type) {
      case 'bank': return 'Bank Account'
      case 'card': return 'Credit Card'
      case 'wallet': return 'E-Wallet'
      default: return 'Cash Wallet'
    }
  }

  return (
    <>
      <div className="net-worth-banner card">
        <div className="net-worth-info">
          <p className="eyebrow">TOTAL NET WORTH</p>
          <h2>{formatMoney(totalNetWorth, currency)}</h2>
          <small>Calculated real-time across all {accounts.length} linked accounts & wallets</small>
        </div>
      </div>

      <section className="columns">
        <article className="card page">
          <Title title="Accounts & Wallets" />
          <div className="accounts-grid">
            {accounts.length ? (
              accounts.map((acc) => (
                <div key={acc.id} className={`account-card ${editingId === acc.id ? 'active-edit' : ''}`}>
                  <div className="account-card-header">
                    <div className="account-title">
                      <span className="account-icon">{getAccountIcon(acc.account_type)}</span>
                      <div>
                        <strong>{acc.name}</strong>
                        <span className="account-type-badge">{getAccountTypeName(acc.account_type)}</span>
                      </div>
                    </div>
                    <div className="actions">
                      <button
                        type="button"
                        className="btn-icon"
                        title="Edit account"
                        onClick={() => onEdit(acc)}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="btn-icon delete"
                        title="Delete account"
                        onClick={() => onDelete(acc.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="account-balance-box">
                    <span className="balance-label">Current Balance</span>
                    <b className={`balance-amount ${Number(acc.current_balance) < 0 ? 'negative' : ''}`}>
                      {formatMoney(acc.current_balance, currency)}
                    </b>
                  </div>
                  <div className="account-meta">
                    <small>Initial: {formatMoney(acc.initial_balance, currency)}</small>
                  </div>
                </div>
              ))
            ) : (
              <Empty text="No accounts found. Create your first wallet or bank account." />
            )}
          </div>
        </article>

        <article className="card page">
          <div className="form-header">
            <Title title={editingId ? 'Edit account' : 'Add account'} />
            {editingId && (
              <button type="button" className="small-ghost" onClick={onCancelEdit}>
                Cancel Edit
              </button>
            )}
          </div>
          <form className="stack" onSubmit={submit}>
            <label>
              Account / Wallet Name
              <input
                required
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="e.g. Main Checking, Savings, Cash, Visa Card"
              />
            </label>
            <label>
              Account Type
              <select
                value={form.account_type}
                onChange={(event) => setForm({ ...form, account_type: event.target.value as AccountType })}
              >
                <option value="cash">💵 Cash Wallet</option>
                <option value="bank">🏦 Bank Account</option>
                <option value="card">💳 Credit Card</option>
                <option value="wallet">👛 E-Wallet</option>
              </select>
            </label>
            <label>
              Initial Balance ({symbol})
              <input
                required
                type="number"
                step="0.01"
                value={form.initial_balance}
                onChange={(event) => setForm({ ...form, initial_balance: event.target.value })}
                placeholder="0.00"
              />
            </label>
            <div className="form-actions">
              <button className="primary">{editingId ? 'Update account' : 'Save account'}</button>
              {editingId && (
                <button type="button" className="ghost" onClick={onCancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </article>
      </section>
    </>
  )
}

function TransactionsPage({
  rows,
  categories,
  accounts,
  query,
  form,
  currency,
  editingId,
  receiptFile,
  setReceiptFile,
  setForm,
  setQuery,
  submit,
  onCancelEdit,
  onEdit,
  onDelete,
  onViewReceipt,
}: {
  rows: Transaction[]
  categories: Category[]
  accounts: Account[]
  query: string
  form: { type: TransactionType; category: string; account: string; amount: string; description: string; date: string }
  currency: Currency
  editingId: number | null
  receiptFile: File | null
  setReceiptFile: (file: File | null) => void
  setForm: (value: { type: TransactionType; category: string; account: string; amount: string; description: string; date: string }) => void
  setQuery: (value: string) => void
  submit: (event: FormEvent<HTMLFormElement>) => void
  onCancelEdit: () => void
  onEdit: (t: Transaction) => void
  onDelete: (id: number) => void
  onViewReceipt: (url: string, description: string) => void
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
        <Rows rows={rows} currency={currency} onEdit={onEdit} onDelete={onDelete} activeEditId={editingId} onViewReceipt={onViewReceipt} />
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
            Account / Wallet (Optional)
            <select
              value={form.account}
              onChange={(event) => setForm({ ...form, account: event.target.value })}
            >
              <option value="">Default / Select Account</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.account_type})
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
          <label>
            Receipt / Bill Image (Optional)
            <input
              type="file"
              accept="image/*"
              className="file-input"
              onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
            />
            {receiptFile && <small className="file-hint">Attached: {receiptFile.name}</small>}
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
  theme,
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
  theme: Theme
  loading: boolean
  onPeriodChange: (year: number, month: number) => Promise<void>
  onFormatChange: (format: ExportFormat) => void
  onDownload: (year: number, month: number, format: ExportFormat) => Promise<void>
}) {
  const barData = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const m = index + 1
      const income = Number(
        monthlyReports.find((row) => row.month === m && row.type === 'income')?.total || 0
      )
      const expenses = Number(
        monthlyReports.find((row) => row.month === m && row.type === 'expense')?.total || 0
      )
      return {
        month: MONTH_SHORT[index],
        Income: income,
        Expenses: expenses,
      }
    })
  }, [monthlyReports])

  const pieData = useMemo(() => {
    return categoryReports
      .filter((row) => row.type === 'expense')
      .map((row) => ({
        name: row.category__name,
        value: Number(row.total),
      }))
  }, [categoryReports])

  const gridColor = theme === 'dark' ? '#23304c' : '#eef1f6'
  const textColor = theme === 'dark' ? '#94a3b8' : '#64748b'

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
        <article className="card page chart-card">
          <Title title={`Annual Comparative Cashflow (${year})`} />
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={barData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="month" stroke={textColor} fontSize={12} tickLine={false} />
                <YAxis stroke={textColor} fontSize={12} tickLine={false} />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Legend formatter={(value) => <span style={{ color: textColor, fontSize: '12px', fontWeight: 600 }}>{value}</span>} />
                <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="card page chart-card">
          <Title title={`Category Share (${MONTH_NAMES[month - 1]} ${year})`} />
          <div className="chart-wrapper">
            {pieData.length ? (
              <ResponsiveContainer width="100%" height={290}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip currency={currency} />} />
                  <Legend formatter={(value) => <span style={{ color: textColor, fontSize: '11px', fontWeight: 600 }}>{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty text={`No expense data recorded for ${MONTH_NAMES[month - 1]} ${year}.`} />
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
  onViewReceipt,
}: {
  rows: Transaction[]
  currency?: Currency
  onEdit?: (t: Transaction) => void
  onDelete?: (id: number) => void
  activeEditId?: number | null
  onViewReceipt?: (url: string, description: string) => void
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
              {item.category_name}{item.account_name ? ` • ${item.account_name}` : ''} | {dateLabel(item.date)}
            </small>
          </span>
          <b className={item.type}>
            {item.type === 'income' ? '+' : '-'}
            {formatMoney(item.amount, currency)}
          </b>
          <div className="actions row-actions">
            {item.receipt && onViewReceipt && (
              <button
                type="button"
                className="btn-icon btn-receipt"
                title="View Receipt Attachment"
                onClick={() => onViewReceipt(item.receipt!, item.description || item.category_name)}
              >
                🧾
              </button>
            )}
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
