import { verifySignature } from '@/utils/auth'
import { startChatAndSendMessageStream } from '@/utils/openAI'
import type { APIRoute } from 'astro'

const sitePassword = import.meta.env.SITE_PASSWORD || ''
const passList = sitePassword.split(',') || []

export const post: APIRoute = async(context) => {
  const body = await context.request.json()

  console.log("🔍 Received Request Body:", JSON.stringify(body, null, 2)); // 🛠️ 打印完整请求体

  const { sign, time, messages, pass } = body

  if (!messages || messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return new Response(JSON.stringify({
      error: {
        message: 'Invalid message history: The last message must be from user role.',
      },
    }), { status: 400 })
  }

  if (sitePassword && !(sitePassword === pass || passList.includes(pass))) {
    return new Response(JSON.stringify({
      error: {
        message: 'Invalid password.',
      },
    }), { status: 401 })
  }

  if (import.meta.env.PROD && !await verifySignature({ t: time, m: messages[messages.length - 1].parts.map(part => part.text).join('') }, sign)) {
    return new Response(JSON.stringify({
      error: {
        message: 'Invalid signature.',
      },
    }), { status: 401 })
  }

  try {
    const history = messages.slice(0, -1) // All messages except the last one
    // 原代码
    // const newMessage = messages[messages.length - 1].parts.map(part => part.text).join('')
    // GPT第一次修改
    // const newMessage = messages[messages.length - 1].parts.map(part => ({ text: part.text }))
    // GPT第二次修改，结合前端调用generate.ts的文件src\components\Generator.tsx
    const newMessage = {
      parts: messages[messages.length - 1].parts.map(part => ({ text: part.text })) // 🛠️ 确保格式正确
    }

    console.log("📤 Sending to Gemini API:", JSON.stringify({ history, newMessage }, null, 2)); // 🔍 打印要发送的数据

    // 发送请求到 Gemini API
    // Start chat and send message with streaming 开始聊天并发送消息
    const responseStream = await startChatAndSendMessageStream(history, newMessage)

    return new Response(responseStream, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

  } catch (error) {
    console.error("🚨 Error:", error)
    const errorMessage = error.message|| "Unknown error";
    const regex = /https?:\/\/[^\s]+/g
    const filteredMessage = errorMessage.replace(regex, '').trim()
    const messageParts = filteredMessage.split('[400 Bad Request]')
    const cleanMessage = messageParts.length > 1 ? messageParts[1].trim() : filteredMessage

    return new Response(JSON.stringify({
      error: {
        code: error.name,
        message: cleanMessage,
      },
    }, null, 2), { status: 500 })
  }
}


