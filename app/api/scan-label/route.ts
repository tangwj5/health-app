import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'API key not configured' }, { status: 500 })

  const { imageBase64, mimeType } = await req.json()
  if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  const prompt = `你是一個營養標示辨識工具。請仔細閱讀這張圖片中的營養標示（可能是中文、日文、英文或其他語言），並回傳 JSON 格式的資料。

請回傳以下欄位，所有數值以「每份」為單位（若標示只有「每100公克」，請依每份克數換算）：
{
  "name": "食品名稱（若圖片中有顯示品名，否則填空字串）",
  "serving_size_g": 每份克數（數字），
  "serving_unit": "份量單位（份/包/片/個/ml等）",
  "calories_per_serving": 每份熱量 kcal（數字），
  "protein_per_serving": 每份蛋白質 g（數字），
  "fat_per_serving": 每份脂肪 g（數字），
  "carbs_per_serving": 每份碳水化合物 g（數字），
  "sugar_per_serving": 每份糖 g（數字，若無填 0），
  "trans_fat_per_serving": 每份反式脂肪 g（數字，若無填 0）
}

只回傳 JSON，不要其他文字或 markdown 格式。`

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
