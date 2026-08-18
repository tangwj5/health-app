import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

const NUTRITION_SCHEMA = `{
  "description": "料理描述（烹調方式、食材等）",
  "name": "料理名稱",
  "serving_size_g": 估算克數（數字）,
  "serving_unit": "份",
  "calories_per_serving": 估算熱量 kcal（數字）,
  "protein_per_serving": 估算蛋白質 g（數字）,
  "fat_per_serving": 估算脂肪 g（數字）,
  "carbs_per_serving": 估算碳水 g（數字）,
  "sugar_per_serving": 估算糖 g（數字）,
  "trans_fat_per_serving": 0
}`

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  const body = await req.json()

  let parts: object[]

  if (body.description) {
    // Re-estimate from text description only
    parts = [{
      text: `你是一個料理營養估算工具。根據以下料理描述，估算每份營養成分：\n\n料理描述：${body.description}\n\n請回傳 JSON：\n${NUTRITION_SCHEMA}\n\n只回傳 JSON，不要其他文字。`
    }]
  } else if (body.imageBase64) {
    // First scan: identify dish from photo
    parts = [
      {
        text: `你是一個料理營養估算工具。請觀察這張食物照片，描述料理並估算每份營養成分。\n\n請回傳 JSON：\n${NUTRITION_SCHEMA}\n\n只回傳 JSON，不要其他文字。`
      },
      {
        inlineData: {
          mimeType: body.mimeType || 'image/jpeg',
          data: body.imageBase64,
        }
      }
    ]
  } else {
    return NextResponse.json({ error: '請提供圖片或描述' }, { status: 400 })
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
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
    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch {
    return NextResponse.json({ error: '回應格式錯誤' }, { status: 500 })
  }
}
