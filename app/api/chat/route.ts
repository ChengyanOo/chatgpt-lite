import { createParser, ParsedEvent, ReconnectInterval } from 'eventsource-parser'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export interface Message {
  role: string
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, messages, input } = (await req.json()) as {
      prompt: string
      messages: Message[]
      input: string
    }

    const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:3000'

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
               req.headers.get('x-real-ip') ||
               '127.0.0.1'

    let countryCode = 'HK'// Default fallback
    try {
      const geoResponse = await fetch(`${backendUrl}/geolocation/ip/${ip}`)
      if (geoResponse.ok) {
        const geoData = await geoResponse.json()
        countryCode = geoData.countryCode || 'HK'
        console.log(`IP ${ip} resolved to country: ${countryCode}`)
      }
    } catch (error) {
      console.error('Geolocation failed, using default HK:', error)
    }

    // Step 2: Fetch chatbot config for country
    let config: any = null
    try {
      const configResponse = await fetch(`${backendUrl}/chat/config/${countryCode}`)
      if (configResponse.ok) {
        config = await configResponse.json()
        console.log(`Loaded config for ${config.countryName} (${config.countryCode})`)
      }
    } catch (error) {
      console.error('Failed to load country config, using defaults:', error)
    }

    // Extract settings from config or use defaults
    const model = config?.model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
    const temperature = config?.temperature || 1
    const maxTokens = config?.maxTokens || 4000
    const systemPromptContent = config?.systemPrompt?.content || prompt
    const ragEnabled = config?.rag?.enabled !== false // Default true
    const ragTopK = config?.rag?.topK || 3
    const ragThreshold = config?.rag?.threshold || 0.7

    // Step 3: Query country-specific RAG if enabled
    let ragContext = ''
    if (ragEnabled) {
      try {
        const ragResponse = await fetch(
          `${backendUrl}/documents/public/query-by-country/${countryCode}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: input,
              topK: ragTopK,
              threshold: ragThreshold
            })
          }
        )

        if (ragResponse.ok) {
          const ragData = await ragResponse.json()
          if (ragData.results && ragData.results.length > 0) {
            console.log(
              `RAG Results for ${countryCode}:`,
              ragData.results.map((r: any) => ({
                score: r.score,
                text: r.chunkText.substring(0, 100) + '...'
              }))
            )

            ragContext = '\n\nRelevant information from knowledge base:\n'
            ragData.results.forEach((result: any, idx: number) => {
              ragContext += `${idx + 1}. ${result.chunkText}\n\n`
            })
          } else {
            console.log(`No RAG results found for ${countryCode}`)
          }
        }
      } catch (error) {
        console.error('RAG query failed, continuing without context:', error)
      }
    } else
    {
      console.log('RAG is disabled for this country.')
    }

    // Step 4: Build enhanced prompt with country system prompt + RAG context
    const enhancedPrompt = systemPromptContent + ragContext

    const messagesWithHistory = [
      { content: enhancedPrompt, role: 'system' },
      ...messages,
      { content: input, role: 'user' }
    ]

    // Step 5: Call OpenAI with country-specific settings
    const { apiUrl, apiKey } = getApiConfig()
    const stream = await getOpenAIStream(
      apiUrl,
      apiKey,
      model,
      messagesWithHistory,
      temperature,
      maxTokens
    )

    return new NextResponse(stream, {
      headers: { 'Content-Type': 'text/event-stream' }
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

const getApiConfig = () => {
  const useAzureOpenAI =
    process.env.AZURE_OPENAI_API_BASE_URL && process.env.AZURE_OPENAI_API_BASE_URL.length > 0

  let apiUrl: string
  let apiKey: string
  let model: string
  if (useAzureOpenAI) {
    let apiBaseUrl = process.env.AZURE_OPENAI_API_BASE_URL
    const apiVersion = '2024-02-01'
    const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || ''
    if (apiBaseUrl && apiBaseUrl.endsWith('/')) {
      apiBaseUrl = apiBaseUrl.slice(0, -1)
    }
    apiUrl = `${apiBaseUrl}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`
    apiKey = process.env.AZURE_OPENAI_API_KEY || ''
    model = '' // Azure Open AI always ignores the model and decides based on the deployment name passed through.
  } else {
    let apiBaseUrl = process.env.OPENAI_API_BASE_URL || 'https://api.openai.com'
    if (apiBaseUrl && apiBaseUrl.endsWith('/')) {
      apiBaseUrl = apiBaseUrl.slice(0, -1)
    }
    apiUrl = `${apiBaseUrl}/v1/chat/completions`
    apiKey = process.env.OPENAI_API_KEY || ''
    model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
  }

  return { apiUrl, apiKey, model }
}

const getOpenAIStream = async (
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: Message[],
  temperature: number = 1,
  maxTokens: number = 4000
) => {
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const res = await fetch(apiUrl, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'api-key': `${apiKey}`
    },
    method: 'POST',
    body: JSON.stringify({
      model: model,
      max_tokens: maxTokens,
      messages: messages,
      stream: true,
      temperature: temperature
    })
  })

  if (res.status !== 200) {
    const statusText = res.statusText
    const responseBody = await res.text()
    console.error(`OpenAI API response error: ${responseBody}`)
    throw new Error(
      `The OpenAI API has encountered an error with a status code of ${res.status} ${statusText}: ${responseBody}`
    )
  }

  return new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          const data = event.data

          if (data === '[DONE]') {
            controller.close()
            return
          }

          try {
            const json = JSON.parse(data)
            const text = json.choices[0]?.delta?.content
            if (text !== undefined) {
              const queue = encoder.encode(text)
              controller.enqueue(queue)
            } else {
              console.error('Received undefined content:', json)
            }
          } catch (e) {
            console.error('Error parsing event data:', e)
            controller.error(e)
          }
        }
      }

      const parser = createParser(onParse)

      if (res.body) {
        const reader = res.body.getReader()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            // An extra newline is required to make AzureOpenAI work.
            const str = decoder.decode(value).replace('[DONE]\n', '[DONE]\n\n')
            parser.feed(str)
          }
        } finally {
          reader.releaseLock()
        }
      }
    }
  })
}
