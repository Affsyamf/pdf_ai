import ollama
from services.document.document_service import search_documents

def get_ai_response_stream(message: str, history: list, file_context: str = None):
    print(f"\n[DEBUG] Pesan User: '{message}'")
    print(f"[DEBUG] Fokus File: '{file_context}'")
    
    search_results = search_documents(message, n_results=5, file_context=file_context)
    
    context_text = ""
    sources = []
    
    if search_results and search_results.get('documents') and search_results['documents'][0]:
        print(f"[DEBUG] BERHASIL! Ditemukan {len(search_results['documents'][0])} potongan teks dari ChromaDB.")
        for i, doc in enumerate(search_results['documents'][0]):
            context_text += f"---\n{doc}\n"
            metadata = search_results['metadatas'][0][i]
            if metadata.get('source') not in sources:
                sources.append(metadata.get('source'))

    # 1. PERTEGAS ATURAN ANTI-MABUK RIWAYAT
    system_instruction = (
        "Kamu adalah Apollo AI, asisten cerdas ciptaan Afif Syam Fauzi.\n"
        "ATURAN MUTLAK:\n"
        "1. Jika DOKUMEN REFERENSI diberikan di bawah ini, itu adalah informasi PALING BARU DAN RELEVAN. Fokuslah 100% ke isi dokumen tersebut.\n"
        "2. ABAIKAN riwayat obrolan sebelumnya jika membahas topik atau dokumen yang berbeda. JANGAN mencampuradukkan materi lama dengan materi baru!\n"
        "3. Jawab dengan bahasa Indonesia yang natural dan rapi.\n\n"
    )
    
    if context_text.strip():
        system_instruction += f"--- MULAI DOKUMEN REFERENSI (BACA INI!) ---\n{context_text}\n--- AKHIR DOKUMEN REFERENSI ---\n"

    messages_payload = [{'role': 'system', 'content': system_instruction}]
    
    for h in history[:-1]: 
        role = 'assistant' if h.role == 'bot' else 'user'
        messages_payload.append({'role': role, 'content': h.text})
        
    # 2. TRIK AMPUH: Suntikkan jangkar nama file ke pesan terakhir!
    final_user_message = message
    if file_context:
        # Ini akan membuat AI "tersadar" bahwa pesan ini KHUSUS untuk file yang baru
        final_user_message = f"(Fokuskan jawabanmu berdasarkan dokumen: '{file_context}')\n{message}"
        
    messages_payload.append({'role': 'user', 'content': final_user_message})

    # Eksekusi AI
    response = ollama.chat(model='qwen2.5:3b', messages=messages_payload, stream=True)
    
    full_response_text = ""
    for chunk in response:
        content = chunk['message']['content']
        full_response_text += content
        yield content
            
    is_refusal = any(keyword in full_response_text.lower() for keyword in [
        "tidak bisa membantu", "maaf", "ilegal", "berbahaya", "belum memberikan dokumen"
    ])

    if sources and not is_refusal and len(context_text.strip()) > 50:
        yield f"\n\n*(Sumber: {', '.join(sources)})*"