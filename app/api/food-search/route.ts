import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || ''
  if (!query.trim()) return NextResponse.json({ products: [] })

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?` +
      `search_terms=${encodeURIComponent(query)}&` +
      `search_simple=1&action=process&json=1&page_size=20&` +
      `fields=product_name,product_name_zh-TW,brands,nutriments,serving_size,serving_quantity,code`

    const res = await fetch(url, {
      headers: { 'User-Agent': 'FamilyHealthApp/1.0 (contact@example.com)' },
      next: { revalidate: 3600 },
    })

    if (!res.ok) throw new Error('OFF API error')
    const data = await res.json()
    return NextResponse.json({ products: data.products || [] })
  } catch {
    return NextResponse.json({ products: [], error: 'search failed' }, { status: 500 })
  }
}
