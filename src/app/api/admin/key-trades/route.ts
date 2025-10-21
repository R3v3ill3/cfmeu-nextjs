import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { TRADE_OPTIONS } from '@/constants/trades'

export const dynamic = 'force-dynamic'

/**
 * Helper function to check if current user is admin
 */
async function checkAdminPermission(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { isAdmin: false, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  
  const { data: roleData, error: roleError } = await supabase
    .rpc('get_user_role', { user_id: user.id })
  
  if (roleError || roleData !== 'admin') {
    return { isAdmin: false, error: NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 }) }
  }
  
  return { isAdmin: true, user }
}

/**
 * GET /api/admin/key-trades
 * Returns current key trades and available trades
 * Admin only
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    
    // Check admin permission
    const { isAdmin, error } = await checkAdminPermission(supabase)
    if (!isAdmin) return error!
    
    // Get current key trades
    const { data: keyTrades, error: keyTradesError } = await supabase
      .from('key_contractor_trades')
      .select('*')
      .eq('is_active', true)
      .order('display_order')
    
    if (keyTradesError) {
      console.error('Error fetching key trades:', keyTradesError)
      return NextResponse.json({ error: keyTradesError.message }, { status: 500 })
    }
    
    // Get all available trades
    const keyTradeSet = new Set((keyTrades || []).map(kt => kt.trade_type))
    const availableTrades = TRADE_OPTIONS
      .filter(trade => !keyTradeSet.has(trade.value))
      .map(trade => ({
        value: trade.value,
        label: trade.label,
        isKey: false
      }))
    
    // Format key trades for response
    const formattedKeyTrades = (keyTrades || []).map(kt => {
      const tradeOption = TRADE_OPTIONS.find(t => t.value === kt.trade_type)
      return {
        id: kt.id,
        trade_type: kt.trade_type,
        label: tradeOption?.label || kt.trade_type,
        display_order: kt.display_order,
        is_active: kt.is_active,
        notes: kt.notes,
        added_at: kt.added_at,
        updated_at: kt.updated_at
      }
    })
    
    return NextResponse.json({
      keyTrades: formattedKeyTrades,
      availableTrades,
      stats: {
        keyTradesCount: formattedKeyTrades.length,
        availableTradesCount: availableTrades.length,
        minRequired: 5,
        maxAllowed: 20
      }
    })
  } catch (error: any) {
    console.error('Error in GET /api/admin/key-trades:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/admin/key-trades
 * Adds a trade to key trades list
 * Body: { trade_type: string, display_order?: number }
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    
    // Check admin permission
    const { isAdmin, user, error } = await checkAdminPermission(supabase)
    if (!isAdmin) return error!
    
    const body = await request.json()
    const { trade_type, display_order, notes } = body
    
    if (!trade_type) {
      return NextResponse.json({ error: 'trade_type is required' }, { status: 400 })
    }
    
    // Validate trade_type exists in TRADE_OPTIONS
    const validTrade = TRADE_OPTIONS.find(t => t.value === trade_type)
    if (!validTrade) {
      return NextResponse.json({ error: 'Invalid trade_type' }, { status: 400 })
    }
    
    // Check if already a key trade
    const { data: existing } = await supabase
      .from('key_contractor_trades')
      .select('id')
      .eq('trade_type', trade_type)
      .eq('is_active', true)
      .single()
    
    if (existing) {
      return NextResponse.json({ error: 'Trade is already a key trade' }, { status: 400 })
    }
    
    // Check current count (max 20)
    const { count } = await supabase
      .from('key_contractor_trades')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
    
    if (count && count >= 20) {
      return NextResponse.json({ 
        error: 'Maximum of 20 key trades reached. Remove a trade before adding another.' 
      }, { status: 400 })
    }
    
    // Get next display order if not provided
    let finalDisplayOrder = display_order
    if (!finalDisplayOrder) {
      const { data: maxOrder } = await supabase
        .from('key_contractor_trades')
        .select('display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: false })
        .limit(1)
        .single()
      
      finalDisplayOrder = (maxOrder?.display_order || 0) + 1
    }
    
    // Insert new key trade
    const { data: newKeyTrade, error: insertError } = await supabase
      .from('key_contractor_trades')
      .insert({
        trade_type,
        display_order: finalDisplayOrder,
        is_active: true,
        added_by: user.id,
        notes: notes || `Added by ${user.email}`
      })
      .select()
      .single()
    
    if (insertError) {
      console.error('Error adding key trade:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
    
    return NextResponse.json({
      success: true,
      keyTrade: newKeyTrade,
      message: `${validTrade.label} added to key trades`
    })
  } catch (error: any) {
    console.error('Error in POST /api/admin/key-trades:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/key-trades
 * Removes a trade from key trades list (sets is_active = false)
 * Body: { trade_type: string } or { id: string }
 * Admin only
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    
    // Check admin permission
    const { isAdmin, user, error } = await checkAdminPermission(supabase)
    if (!isAdmin) return error!
    
    const body = await request.json()
    const { trade_type, id } = body
    
    if (!trade_type && !id) {
      return NextResponse.json({ error: 'trade_type or id is required' }, { status: 400 })
    }
    
    // Check current count (min 5)
    const { count } = await supabase
      .from('key_contractor_trades')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
    
    if (count && count <= 5) {
      return NextResponse.json({ 
        error: 'Minimum of 5 key trades required. Cannot remove more trades.' 
      }, { status: 400 })
    }
    
    // Update to inactive (soft delete to preserve audit trail)
    let query = supabase
      .from('key_contractor_trades')
      .update({ 
        is_active: false,
        updated_by: user.id 
      })
    
    if (id) {
      query = query.eq('id', id)
    } else {
      query = query.eq('trade_type', trade_type)
    }
    
    const { data: removed, error: deleteError } = await query
      .select()
      .single()
    
    if (deleteError) {
      console.error('Error removing key trade:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }
    
    const tradeOption = TRADE_OPTIONS.find(t => t.value === removed.trade_type)
    
    return NextResponse.json({
      success: true,
      message: `${tradeOption?.label || removed.trade_type} removed from key trades`
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/key-trades:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PUT /api/admin/key-trades
 * Reorders key trades
 * Body: { trades: Array<{ id: string, display_order: number }> }
 * Admin only
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    
    // Check admin permission
    const { isAdmin, user, error } = await checkAdminPermission(supabase)
    if (!isAdmin) return error!
    
    const body = await request.json()
    const { trades } = body
    
    if (!Array.isArray(trades)) {
      return NextResponse.json({ error: 'trades array is required' }, { status: 400 })
    }
    
    // Update each trade's display order
    const updates = trades.map(async (trade) => {
      const { data, error } = await supabase
        .from('key_contractor_trades')
        .update({ 
          display_order: trade.display_order,
          updated_by: user.id
        })
        .eq('id', trade.id)
        .select()
        .single()
      
      if (error) throw error
      return data
    })
    
    const results = await Promise.all(updates)
    
    return NextResponse.json({
      success: true,
      updated: results.length,
      message: `Reordered ${results.length} key trades`
    })
  } catch (error: any) {
    console.error('Error in PUT /api/admin/key-trades:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

