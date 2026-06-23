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

export function generateTransferList(balances: Balance[]): SettlementItem[] {
  const currencies = [...new Set(balances.map(b => b.currency))]
  const transfers: SettlementItem[] = []

  for (const currency of currencies) {
    const currencyBalances = balances.filter(b => b.currency === currency)

    const creditors = currencyBalances.filter(b => b.net > 0).map(b => ({ ...b }))
    const debtors = currencyBalances.filter(b => b.net < 0).map(b => ({ ...b }))

    creditors.sort((a, b) => b.net - a.net)
    debtors.sort((a, b) => a.net - b.net)

    let ci = 0
    let di = 0

    while (ci < creditors.length && di < debtors.length) {
      const creditor = creditors[ci]
      const debtor = debtors[di]

      const amount = Math.min(creditor.net, -debtor.net)
      const roundedAmount = Math.round(amount * 100) / 100

      if (roundedAmount > 0.01) {
        transfers.push({
          id: crypto.randomUUID(),
          notebook_id: '',
          from_member: debtor.member,
          to_member: creditor.member,
          amount: roundedAmount,
          currency,
          status: 'unpaid',
          proof_url: null,
          original_amounts: null,
        })
      }

      creditor.net -= amount
      debtor.net += amount

      if (Math.abs(creditor.net) < 0.01) ci++
      if (Math.abs(debtor.net) < 0.01) di++
    }
  }

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
