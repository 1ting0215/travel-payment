import type { Expense, ExpenseSplit, Balance, SettlementItem } from '@/types'

export function calculateBalances(expenses: (Expense & { splits: ExpenseSplit[] })[]): Balance[] {
  const balanceMap = new Map<string, Balance>()

  const getOrCreate = (member: string, currency: string): Balance => {
    const key = `${member}::${currency}`
    if (!balanceMap.has(key)) {
      balanceMap.set(key, { member, currency, paid: 0, owed: 0, net: 0 })
    }
    return balanceMap.get(key)!
  }

  for (const expense of expenses) {
    if (expense.visibility !== 'shared') continue

    const payerBalance = getOrCreate(expense.payer, expense.currency)
    payerBalance.paid += expense.amount

    for (const split of expense.splits) {
      const splitBalance = getOrCreate(split.member_name, expense.currency)
      splitBalance.owed += split.amount
    }
  }

  for (const balance of balanceMap.values()) {
    balance.net = balance.paid - balance.owed
  }

  return Array.from(balanceMap.values())
}

export function generateTransferList(
  balances: Balance[],
  expenses?: (Expense & { splits: ExpenseSplit[] })[]
): SettlementItem[] {
  if (!expenses || expenses.length === 0) {
    return []
  }

  // Pairwise: each splitter owes the payer directly, then net bidirectional debts
  // key: "from::to::currency"
  const debtMap = new Map<string, number>()

  for (const expense of expenses) {
    if (expense.visibility !== 'shared') continue
    for (const split of expense.splits) {
      if (split.member_name === expense.payer) continue
      const key = `${split.member_name}::${expense.payer}::${expense.currency}`
      debtMap.set(key, (debtMap.get(key) ?? 0) + split.amount)
    }
  }

  // Net bidirectional debts for each pair
  const transfers: SettlementItem[] = []
  const processed = new Set<string>()

  for (const [key, amount] of debtMap.entries()) {
    if (processed.has(key)) continue
    const [from, to, currency] = key.split('::')
    const reverseKey = `${to}::${from}::${currency}`
    processed.add(key)
    processed.add(reverseKey)

    const reverseAmount = debtMap.get(reverseKey) ?? 0
    const net = Math.round((amount - reverseAmount) * 100) / 100

    if (Math.abs(net) < 0.01) continue

    transfers.push({
      id: crypto.randomUUID(),
      notebook_id: '',
      from_member: net > 0 ? from : to,
      to_member: net > 0 ? to : from,
      amount: Math.abs(net),
      currency,
      status: 'unpaid',
      proof_url: null,
      original_amounts: null,
    })
  }

  // Sort: by currency, then by amount descending
  transfers.sort((a, b) => a.currency.localeCompare(b.currency) || b.amount - a.amount)

  return transfers
}

export function formatTransferText(items: SettlementItem[], decimalMap?: Record<string, number>): string {
  return items
    .map(item => {
      const dp = decimalMap?.[item.currency] ?? 2
      return `${item.from_member} -> ${item.to_member}: ${item.amount.toFixed(dp)} ${item.currency}`
    })
    .join('\n')
}
