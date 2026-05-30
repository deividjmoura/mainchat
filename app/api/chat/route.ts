import { NextRequest } from 'next/server';
import { ChatOllama } from "@langchain/ollama";

const model = new ChatOllama({
  baseUrl: "http://localhost:11434",
  model: "llama3.2:3b",        // Nome exato que apareceu no ollama list
  temperature: 0.75,
  maxTokens: 1024,
});

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== 'string') {
      return Response.json({ response: "Mensagem inválida." }, { status: 400 });
    }

    const response = await model.invoke(message);

    return Response.json({ 
      response: response.content || "Sem resposta gerada." 
    });
  } catch (error: any) {
    console.error("Erro na API:", error.message);
    return Response.json({ 
      response: `Erro: ${error.message}` 
    }, { status: 500 });
  }
}
