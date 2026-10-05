import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  const { imageBase64, mimeType } = await req.json()
  if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  const prompt = `你是一個收據辨識工具。請仔細閱讀這張收據圖片，列出所有購買品項（包含折扣券/COUPON行，以負數價格表示）。

請回傳 JSON 格式：
{
  "store": "通路名稱（若圖片中有顯示，否則填空字串）",
  "items": [
    {
      "name": "品項名稱",
      "price": 總金額（數字，台幣；折扣/COUPON填負數；若有折扣請填折扣後實際支出金額）,
      "quantity": 數量（整數，預設1）,
      "category": "消耗品或記帳"
    }
  ]
}

分類規則：
- 消耗品：清潔用品、個人護理、保養品、藥品、衛生用品、廚房耗材等非食物消耗性用品
- 記帳：食品、飲料、生鮮、服飾、電器、袋費、折扣券、服務費等其他所有項目

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
