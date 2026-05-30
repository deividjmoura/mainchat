'use client';

import { useState, useRef, useEffect } from 'react';

export default function VautChat() {
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: 'Bom dia! Eu sou o **Vaut**, seu assistente pessoal. Estou aqui para te ajudar em tudo e, com o tempo, vou te conhecer cada vez melhor.\n\nComo posso te ajudar hoje?' 
    }
  ]);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput }),
      });

      const data = await response.json();
      
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.response 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Desculpe, não consegui me conectar com o Ollama. Verifique se ele está rodando.' 
      }]);
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="text-center py-8 border-b border-zinc-800">
          <h1 className="text-5xl font-bold tracking-tight mb-2">VAUT</h1>
          <p className="text-zinc-400 text-lg">Seu Assistente Pessoal</p>
        </div>

        {/* Chat Area */}
        <div className="h-[70vh] flex flex-col mt-6 bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800">
          <div className="flex-1 overflow-y-auto p-6 space-y-6" id="chat-container">
            {messages.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-5 py-4 rounded-2xl text-[17px] leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-zinc-800 text-zinc-100'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 px-5 py-4 rounded-2xl">
                  Pensando...
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-5 border-t border-zinc-800 bg-zinc-900">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Digite sua mensagem aqui..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-2xl px-6 py-4 focus:outline-none focus:border-blue-500 text-lg"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 px-10 rounded-2xl font-medium text-lg transition-colors"
              >
                Enviar
              </button>
            </div>
            <p className="text-center text-xs text-zinc-500 mt-3">
              Vaut está usando Ollama localmente
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
