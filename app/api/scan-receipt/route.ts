import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  const { imageBase64, mimeType } = await req.json()
  if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  const prompt = `你是一個收據辨識工具。請仔細閱讀這張收據圖片，列出所有購買品項（包含COUPON/折扣行，金額填負數）。

請回傳 JSON 格式：
{
  "store": "通路名稱（若圖片中有顯示，否則填空字串）",
  "items": [
    {
      "name": "品項名稱",
      "price": 金額（數字，台幣；COUPON/折扣填負數）,
      "quantity": 數量（整數，預設1）,
      "category": "食物或食物且消耗品或用品或用品且消耗品"
    }
  ]
}

分類規則（四選一，必須完全一致）：
- 食物：食品、飲料、生鮮、零食、即食品等食物類
- 食物且消耗品：需定期補充的食品，如橄欖油、蛋白粉、保健飲品、寵物飼料等
- 用品：衣物、電器、袋費、服務費、COUPON折扣等非消耗性品項
- 用品且消耗品：清潔劑、洗碗精、衛生紙、洗髮精、護膚品、藥品等定期補充的日用品

只回傳 JSON，不要其他文字或 markdown 格式。`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
        ]}],
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 500 })
  }

  const data = await res.json()
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return NextResponse.json({ error: '無法解析回應' }, { status: 500 })

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch {
    return NextResponse.json({ error: '回應格式錯誤' }, { status: 500 })
  }
}
