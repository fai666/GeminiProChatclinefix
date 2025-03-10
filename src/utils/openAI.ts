import { GoogleGenerativeAI } from '@fuyun/generative-ai'

const apiKey = (import.meta.env.GEMINI_API_KEY)
const apiBaseUrl = (import.meta.env.API_BASE_URL)?.trim().replace(/\/$/, '')

const genAI = apiBaseUrl
  ? new GoogleGenerativeAI(apiKey, apiBaseUrl)
  : new GoogleGenerativeAI(apiKey)

// 旧模型代码
// 原 startChatAndSendMessageStream` 方法的 `newMessage` 形参是 string
// export const startChatAndSendMessageStream = async (history: ChatMessage[], newMessage: string) => {

// 20250306改
// 新方法下的 newMessage结构 应按照 src\pages\api\generate.ts 的 post 里的调用方式，也写成一个对象，这样 `newMessage` 传入 `sendMessageStream` 时就会变成 `[{ text: "xxx" }]`，不会报错
// 修改 `startChatAndSendMessageStream` 形参，让它接受正确格式
export const startChatAndSendMessageStream = async (history: ChatMessage[], newMessage: { parts: { text: string }[] }) => { 
  
  // 出现报错[GoogleGenerativeAI Error]: Error fetching from [404 Not Found] models/gemini-pro is not found for API version v1, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods时
  // 修改模型 将gemini-pro修改为gemini-2.0-flash 
  // const model = genAI.getGenerativeModel({ model: 'gemini-pro' })  // 20250304改
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const chat = model.startChat({
    history: history.map(msg => ({
      role: msg.role,
      // 旧模型代码，逻辑是转字符串
      // parts: msg.parts.map(part => part.text).join(''), // Join parts into a single string

      // 20250306改 
      // 在 openAI.ts 中，历史消息的 parts 被 错误地转换成了字符串，但它应该是一个 数组，其中每个 part 是一个 text 对象
      parts: msg.parts.map(part => ({ text: part.text })),
    })),
    generationConfig: {
      maxOutputTokens: 8000,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ],
  })

  // 旧模型代码 发送流式请求
  // Use sendMessageStream for streaming responses
  // const result = await chat.sendMessageStream(newMessage)

  // GPT第二次修改，结合前端调用generate.ts的文件src\components\Generator.tsx 
  // 20250306改 
  // 新模型+新@fuyun/generative-ai下，通过前端打印，确认sendMessageStream应该传入newMessage.parts，这样 `newMessage` 传入 `sendMessageStream` 时就会变成 `[{ text: "xxx" }]`，不会报错
  const result = await chat.sendMessageStream(newMessage.parts)
  
  // console.log("Chat response:", result);

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
