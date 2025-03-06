import { GoogleGenerativeAI } from '@fuyun/generative-ai'

const apiKey = (import.meta.env.GEMINI_API_KEY)
const apiBaseUrl = (import.meta.env.API_BASE_URL)?.trim().replace(/\/$/, '')

const genAI = apiBaseUrl
  ? new GoogleGenerativeAI(apiKey, apiBaseUrl)
  : new GoogleGenerativeAI(apiKey)

export const startChatAndSendMessageStream = async (history: ChatMessage[], newMessage: string) => {
  // 出现报错[GoogleGenerativeAI Error]: Error fetching from [404 Not Found] models/gemini-pro is not found for API version v1, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods时
  // 修改模型 将gemini-pro修改为gemini-2.0-flash 
  // const model = genAI.getGenerativeModel({ model: 'gemini-pro' })  // 20250304改
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const chat = model.startChat({
    history: history.map(msg => ({
      role: msg.role,
      // parts: msg.parts.map(part => part.text).join(''), // Join parts into a single string
      // 在 openAI.ts 中，历史消息的 parts 被 错误地转换成了字符串，但它应该是一个 数组，其中每个 part 是一个 text 对象
      parts: msg.parts.map(part => ({ text: part.text })),
    })),
    generationConfig: {
      maxOutputTokens: 8000,
    },
    safetySettings: [
      {category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE'},
      {category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE'},
      {category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE'},
      {category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE'}
      ],
  })

  // Use sendMessageStream for streaming responses
  // const result = await chat.sendMessageStream(newMessage)

  // 发送流式请求
  const result = await chat.sendMessageStream({ parts: [{ text: newMessage }] }) 


  const encodedStream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      for await (const chunk of result.stream) {
        const text = await chunk.text()
        const encoded = encoder.encode(text)
        controller.enqueue(encoded)
      }
      controller.close()
    },
  })

  return encodedStream
}
