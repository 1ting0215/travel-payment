export type SplitMethod = 'equal' | 'custom' | 'ratio'
export type Visibility = 'private' | 'shared'
export type RemittanceStatus = 'unpaid' | 'paid' | 'confirmed'

export interface Notebook {
  id: string
  title: string
  creator_email: string
  is_closed: boolean
  created_at: string
  last_accessed_at: string
}

export interface Member {
  id: string
  notebook_id: string
  name: string
  created_at: string
  has_password?: boolean
}

export interface Currency {
  id: string
  notebook_id: string
  code: string
  exchange_rate: number | null
  base_currency: string | null
  decimal_places: number
}

export interface Expense {
  id: string
  notebook_id: string
  title: string
  date: string
  amount: number
  currency: string
  payer: string
  split_method: SplitMethod
  notes: string | null
  receipt_url: string | null
  visibility: Visibility
  category: string | null
  created_by: string
  created_at: string
  splits?: ExpenseSplit[]
}

export interface ExpenseSplit {
  id: string
  expense_id: string
  member_name: string
  amount: number
  ratio: number | null
}

export interface SettlementItem {
  id: string
  notebook_id: string
  from_member: string
  to_member: string
  amount: number
  currency: string
  status: RemittanceStatus
  proof_url: string | null
  original_amounts?: {
    from?: number
    to?: number
    status_updated_by?: string
    status_updated_at?: string
    paid_by?: string
    paid_at?: string
    confirmed_by?: string
    confirmed_at?: string
    unconfirmed_by?: string
    unconfirmed_at?: string
    settlement_saved_by?: string
    settlement_saved_at?: string
  } | null
}

export interface CollectionInfo {
  id: string
  notebook_id: string
  member_name: string
  account_info: string | null
  qr_code_url: string | null
  notes: string | null
}

export interface Balance {
  member: string
  currency: string
  paid: number
  owed: number
  net: number
}
