# KIáº¾N TRÃšC Há»† THá»NG CHATBOT AI TECHSTORE

> **Äá»“ Ã¡n tá»‘t nghiá»‡p â€” NgÃ nh CÃ´ng nghá»‡ ThÃ´ng tin**  
> Äá» tÃ i: XÃ¢y dá»±ng há»‡ thá»‘ng Chatbot AI tÆ° váº¥n sáº£n pháº©m vÃ  há»— trá»£ kiáº¿n thá»©c cÃ´ng nghá»‡  
> á»¨ng dá»¥ng mÃ´ hÃ¬nh Retrieval-Augmented Generation (RAG)

---

## 1. Tá»•ng quan há»‡ thá»‘ng

### 1.1 Má»¥c tiÃªu

Há»‡ thá»‘ng Chatbot AI TechStore Ä‘Æ°á»£c xÃ¢y dá»±ng nháº±m:

- Há»— trá»£ ngÆ°á»i dÃ¹ng tÃ¬m kiáº¿m, tÆ° váº¥n, so sÃ¡nh sáº£n pháº©m cÃ´ng nghá»‡ má»™t cÃ¡ch tá»± nhiÃªn
- á»¨ng dá»¥ng mÃ´ hÃ¬nh **Retrieval-Augmented Generation (RAG)** Ä‘á»ƒ tráº£ lá»i chÃ­nh xÃ¡c tá»« dá»¯ liá»‡u thá»±c
- TÃ­ch há»£p liá»n máº¡ch vÃ o giao diá»‡n website thÆ°Æ¡ng máº¡i Ä‘iá»‡n tá»­ TechStore
- KhÃ´ng tá»± bá»‹a Ä‘áº·t thÃ´ng tin sáº£n pháº©m â€” Æ°u tiÃªn dá»¯ liá»‡u tá»« CSDL

### 1.2 CÃ¡c thÃ nh pháº§n chÃ­nh

| ThÃ nh pháº§n | CÃ´ng nghá»‡ | Vai trÃ² |
|---|---|---|
| **Frontend** | React.js | Giao diá»‡n chat tÃ­ch há»£p vÃ o website |
| **Backend API** | Node.js + Express | Xá»­ lÃ½ request, Ä‘iá»u phá»‘i AI |
| **AI Orchestrator** | AIRouter.js | Äá»‹nh tuyáº¿n flow xá»­ lÃ½ |
| **LLM** | Google Gemini 2.5 Flash | Sinh cÃ¢u tráº£ lá»i ngÃ´n ngá»¯ tá»± nhiÃªn |
| **Embedding Model** | all-MiniLM-L6-v2 | Táº¡o vector embedding (384 chiá»u) |
| **Vector Search** | MongoDB Atlas Vector Search | TÃ¬m kiáº¿m ngá»¯ nghÄ©a |
| **Vector DB** | ChromaDB (local) | LÆ°u knowledge base |
| **Database** | MongoDB | LÆ°u sáº£n pháº©m, Ä‘Æ¡n hÃ ng, há»™i thoáº¡i |

---

## 2. Kiáº¿n trÃºc tá»•ng thá»ƒ

### 2.1 SÆ¡ Ä‘á»“ kiáº¿n trÃºc há»‡ thá»‘ng

```mermaid
graph TB
    subgraph CLIENT["ðŸŒ Client Layer (Frontend)"]
        UI[Website TechStore]
        CHAT[ChatbotBox Component]
        UI --> CHAT
    end

    subgraph GATEWAY["ðŸ”€ API Gateway (Express.js - Port 5000)"]
        ROUTE["/api/chatbot/message"]
        AUTH[JWT Middleware]
        RATE[Rate Limiter]
        ROUTE --> AUTH --> RATE
    end

    subgraph ORCHESTRATOR["ðŸ§  AI Orchestrator Layer"]
        INTENT[Intent Detector]
        ROUTER[AIRouter - Unified Flow]
        INTENT --> ROUTER
    end

    subgraph RAG["ðŸ“š RAG Pipeline"]
        EMBED[EmbeddingService\nall-MiniLM-L6-v2 384d]
        VSEARCH[VectorSearchService\nAtlas Vector Search]
        RAGP[RAGPipeline\nContext Assembly]
        EMBED --> VSEARCH --> RAGP
    end

    subgraph AGENTS["ðŸ¤– Specialized Agents"]
        PSA[ProductSearchAgent]
        RCA[RecommendationAgent]
        CPA[ComparisonAgent]
        PCBA[PCBuilderAgent]
        KNA[KnowledgeAgent]
    end

    subgraph LLM["âš¡ LLM Layer"]
        GEMINI[Google Gemini 2.5 Flash\nTool Calling + Multimodal]
    end

    subgraph DATA["ðŸ’¾ Data Layer"]
        MONGO[(MongoDB\nProducts, Orders\nConversations)]
        CHROMA[(ChromaDB\nKnowledge Base)]
        MEMCACHE[In-memory Cache\nResponse Cache 30s]
    end

    CHAT -->|POST| ROUTE
    RATE --> INTENT
    ROUTER -->|RAG-first| EMBED
    ROUTER -->|Tool-calling| GEMINI
    ROUTER --> AGENTS
    RAGP --> GEMINI
    AGENTS --> MONGO
    AGENTS --> CHROMA
    AGENTS --> GEMINI
    VSEARCH --> MONGO
    VSEARCH --> CHROMA
    GEMINI -->|Tool call| MONGO
    ROUTER --> MEMCACHE
    GEMINI -->|Response| ROUTE
    ROUTE -->|JSON| CHAT
```

### 2.2 SÆ¡ Ä‘á»“ luá»“ng xá»­ lÃ½ RAG Pipeline

```mermaid
sequenceDiagram
    participant U as ðŸ‘¤ User
    participant F as ðŸ’» Frontend
    participant API as ðŸ”€ API Server
    participant ID as ðŸŽ¯ IntentDetector
    participant AR as ðŸ§  AIRouter
    participant ES as ðŸ“ EmbeddingService
    participant VS as ðŸ” VectorSearch
    participant RP as ðŸ“š RAGPipeline
    participant G as âš¡ Gemini 2.5 Flash
    participant DB as ðŸ’¾ MongoDB

    U->>F: Nháº­p cÃ¢u há»i
    F->>API: POST /api/chatbot/message\n{sessionId, message, history}
    
    API->>ID: detectIntent(message)
    
    alt Intent: greeting/thanks/goodbye
        ID-->>API: Short-circuit response
        API-->>F: Tráº£ lá»i tá»©c thÃ¬ (0ms DB call)
    else Intent: product/compare/knowledge
        ID-->>AR: intent detected
        
        AR->>AR: shouldUseToolFlow?
        
        alt RAG-first flow (EmbeddingService available)
            AR->>ES: embedText(query)
            ES-->>AR: queryVector[384]
            
            par Parallel retrieval
                AR->>VS: searchSimilarProducts(vector, k=5)
                VS->>DB: Atlas $vectorSearch\n(product_embedding_index)
                DB-->>VS: Top-K products
                VS-->>AR: productContext[]
            and
                AR->>VS: searchKnowledgeDocs(vector, k=5)
                VS->>DB: Atlas $vectorSearch\n(knowledge_embedding_index)
                DB-->>VS: Top-K knowledge chunks
                VS-->>AR: knowledgeContext[]
            end
            
            AR->>RP: buildContextBlocks(products, knowledge)
            RP->>G: generateRagAnswer(systemPrompt, context, question)
            G-->>RP: Generated answer
            RP-->>AR: {answer, sources, products}
            
        else Tool-calling flow (Gemini native)
            AR->>G: chatWithTools(message, history, tools)
            G->>G: Analyze intent + plan tools
            G->>DB: search_products(keyword)
            DB-->>G: Product results
            G-->>AR: {answer, products, toolTrace}
        end
        
        AR->>AR: evaluateRagConfidence()
        AR-->>API: {answer, products, sources, flow}
        API-->>F: Response JSON
        F-->>U: Render message + product cards
    end
```

---

## 3. Kiáº¿n trÃºc 5 Specialized Agents

### 3.1 SÆ¡ Ä‘á»“ agents

```mermaid
graph LR
    subgraph ROUTER["AIRouter (Orchestrator)"]
        IR[Intent Router]
    end

    subgraph AGENTS["5 Specialized Agents"]
        PSA["ðŸ” ProductSearchAgent\n- TÃ¬m kiáº¿m sáº£n pháº©m\n- Lá»c theo giÃ¡, brand\n- Hybrid search"]
        RCA["ðŸ’¡ RecommendationAgent\n- Gá»£i Ã½ theo nhu cáº§u\n- Gaming/Office/Student\n- Budget-aware"]
        CPA["âš–ï¸ ComparisonAgent\n- So sÃ¡nh 2-4 sáº£n pháº©m\n- Báº£ng markdown\n- PhÃ¢n tÃ­ch Æ°u/nhÆ°á»£c"]
        PCBA["ðŸ–¥ï¸ PCBuilderAgent\n- Build PC theo ngÃ¢n sÃ¡ch\n- Kiá»ƒm tra tÆ°Æ¡ng thÃ­ch\n- Tá»‘i Æ°u hiá»‡u nÄƒng"]
        KNA["ðŸ“– KnowledgeAgent\n- CPU/RAM/SSD/GPU\n- Giáº£i thÃ­ch cÃ´ng nghá»‡\n- TÆ° váº¥n ká»¹ thuáº­t"]
    end

    subgraph ENGINES["Shared Engines"]
        HSE["ðŸ”„ HybridSearchEngine\n40% Keyword + 60% Semantic"]
        VRE["ðŸ§® VectorRAGEngine\nContext-aware RAG"]
    end

    IR -->|product_search| PSA
    IR -->|recommendation| RCA
    IR -->|compare| CPA
    IR -->|pc_build| PCBA
    IR -->|knowledge| KNA

    PSA --> HSE
    RCA --> HSE
    CPA --> HSE
    PCBA --> HSE
    KNA --> VRE

    HSE --> MongoDB[(MongoDB)]
    VRE --> ChromaDB[(ChromaDB)]
```

### 3.2 Báº£ng nÄƒng lá»±c agent

| Agent | Intent triggers | Nguá»“n dá»¯ liá»‡u | VÃ­ dá»¥ |
|---|---|---|---|
| ProductSearchAgent | product_search, price_query | MongoDB, Vector Search | "Laptop gaming dÆ°á»›i 30 triá»‡u" |
| RecommendationAgent | recommendation, advice | MongoDB, ChromaDB | "Gá»£i Ã½ laptop cho sinh viÃªn láº­p trÃ¬nh" |
| ComparisonAgent | compare, vs, so sÃ¡nh | MongoDB | "So sÃ¡nh RTX 4060 vs RTX 4070" |
| PCBuilderAgent | pc_build, build_pc | MongoDB | "Build PC gaming 40 triá»‡u" |
| KnowledgeAgent | knowledge, greeting, help | ChromaDB, Gemini | "SSD NVMe lÃ  gÃ¬?" |

---

## 4. Kiáº¿n trÃºc dá»¯ liá»‡u

### 4.1 Embedding & Vector Search

```mermaid
graph TB
    subgraph EMBED_PIPELINE["Embedding Pipeline"]
        TEXT[Product text\nname + brand + category\n+ specs + description]
        MODEL[all-MiniLM-L6-v2\nCPU inference\nXenova/transformers.js]
        VECTOR[Vector [384 float32]\nCosine similarity]
        TEXT --> MODEL --> VECTOR
    end

    subgraph STORAGE["Vector Storage"]
        MONGO_VEC[(MongoDB Atlas\nproductEmbeddings collection\n+ knowledge_embedding_index)]
        CHROMA_VEC[(ChromaDB Local\ntechstore_knowledge\ntechstore_products)]
        VECTOR --> MONGO_VEC
        VECTOR --> CHROMA_VEC
    end

    subgraph SEARCH["Search at Query Time"]
        QUERY[User query]
        Q_EMBED[Query embedding\n384-dim]
        KNNV[kNN Vector Search\nnumCandidates=40\ntop-K=5-8]
        QUERY --> Q_EMBED --> KNNV
        KNNV --> MONGO_VEC
        KNNV --> CHROMA_VEC
    end
```

### 4.2 Hybrid Search Engine

```
Hybrid Score = Î± Ã— KeywordScore + Î² Ã— SemanticScore
               Î± = 0.40 (TF-IDF/BM25)
               Î² = 0.60 (Cosine similarity)

Multi-factor ranking:
  finalScore = hybridScore Ã— popularityBoost Ã— stockBoost Ã— ratingBoost
```

---

## 5. Luá»“ng xá»­ lÃ½ chi tiáº¿t tá»«ng intent

### 5.1 Product Search Flow

```
User: "Laptop gaming dÆ°á»›i 25 triá»‡u thÆ°Æ¡ng hiá»‡u Asus"
  â”‚
  â”œâ”€ [IntentDetector] â†’ "product_search" (confidence: 0.92)
  â”œâ”€ [BudgetExtractor] â†’ {maxPrice: 25_000_000}
  â”œâ”€ [BrandExtractor] â†’ {brand: "Asus"}
  â”‚
  â”œâ”€ [HybridSearch] â†’ MongoDB query:
  â”‚    { category: /laptop/i, brand: /asus/i, price: {$lte: 25000000} }
  â”‚    + Vector semantic search
  â”‚
  â”œâ”€ [EmbeddingService] â†’ embed("Laptop gaming Asus 25 triá»‡u")
  â”œâ”€ [VectorSearch] â†’ Top 5 similar products
  â”‚
  â”œâ”€ [RAGPipeline] â†’ Build context + prompt
  â”œâ”€ [Gemini 2.5 Flash] â†’ Generate recommendation text
  â”‚
  â””â”€ Response: { answer, products[5], sources, type:"product_search" }
```

### 5.2 Comparison Flow

```
User: "So sÃ¡nh RTX 4060 vá»›i RTX 4070"
  â”‚
  â”œâ”€ [IntentDetector] â†’ "compare" (confidence: 0.95)
  â”œâ”€ [ComparisonParser] â†’ fragments: ["RTX 4060", "RTX 4070"]
  â”‚
  â”œâ”€ [MongoDB] â†’ findOne({ name: /RTX 4060/ }) â†’ product A
  â”œâ”€ [MongoDB] â†’ findOne({ name: /RTX 4070/ }) â†’ product B
  â”‚
  â”œâ”€ [Gemini 2.5 Flash] â†’ Generate comparison table:
  â”‚    systemPrompt: "Tráº£ lá»i dáº¡ng báº£ng markdown, khÃ´ng bá»‹a thÃ´ng sá»‘"
  â”‚    context: [productA specs, productB specs]
  â”‚
  â””â”€ Response: { answer (markdown table), products[2], type:"compare" }
```

### 5.3 PC Builder Flow

```
User: "Build PC gaming 40 triá»‡u"
  â”‚
  â”œâ”€ [IntentDetector] â†’ "pc_build" (confidence: 0.93)
  â”œâ”€ [BudgetParser] â†’ {budget: 40_000_000}
  â”œâ”€ [UseCaseParser] â†’ {useCase: "gaming"}
  â”‚
  â”œâ”€ [PCBuilderAgent] â†’ Component selection:
  â”‚    CPU: ~25% budget â†’ 10,000,000
  â”‚    GPU: ~35% budget â†’ 14,000,000
  â”‚    RAM: ~8% budget  â†’  3,200,000
  â”‚    SSD: ~5% budget  â†’  2,000,000
  â”‚    ...etc
  â”‚
  â”œâ”€ [MongoDB] Ã— N â†’ Find best product per component
  â”œâ”€ [CompatibilityChecker] â†’ Validate CPU-MB socket, PSU wattage
  â”‚
  â”œâ”€ [Gemini 2.5 Flash] â†’ Generate build summary + explanation
  â”‚
  â””â”€ Response: { answer, products[6-8 components], buildConfig, type:"pc_build" }
```

---

## 6. Báº£o máº­t & Xá»­ lÃ½ lá»—i

### 6.1 Input Safety

```javascript
// VÃ­ dá»¥: Unsafe content detection
const UNSAFE_PATTERNS = [
  /ma tuy|thuoc no|vu khi|hack|crack|ddos/i,
  /tu tu|tu sat|giet|khung bo/i,
];
// â†’ Return { type: 'out_of_scope', answer: "Tá»« chá»‘i lá»‹ch sá»±" }
```

### 6.2 Hallucination Prevention

- **KhÃ´ng tá»± bá»‹a thÃ´ng sá»‘**: System prompt báº¯t buá»™c dÃ¹ng dá»¯ liá»‡u context
- **Confidence check**: `evaluateRagConfidence()` kiá»ƒm tra Ä‘á»™ tin cáº­y RAG output
- **Fallback chain**: RAG â†’ Tool-calling â†’ Gemini general â†’ Friendly error
- **Safety override**: Náº¿u answer chá»©a "vui lÃ²ng thá»­ láº¡i" â†’ retry vá»›i RAG

### 6.3 Error Handling Flow

```
AI Error â†’ Log error vá»›i requestId
         â†’ Return fallback message (khÃ´ng expose internal error)
         â†’ Monitor error rate (náº¿u > threshold â†’ alert)
```

---

## 7. Performance & Scalability

### 7.1 Caching Strategy

| Layer | Strategy | TTL |
|---|---|---|
| Response Cache | In-memory Map (500 entries) | 30 giÃ¢y |
| Embedding Cache | File-based (.cache/transformers) | Permanent |
| MongoDB Query | Built-in cursor cache | MongoDB managed |

### 7.2 Timeout & Circuit Breaker

```
RAG timeout: 9,000ms (env: AI_RAG_TIMEOUT_MS)
Gemini timeout: 30,000ms
Circuit breaker: GROQ_CB_FAILURE_THRESHOLD=4, open=45s
```

### 7.3 Performance Targets

| Metric | Target | Current |
|---|---|---|
| Response time | < 3s | ~2.14s avg |
| Intent accuracy | > 90% | ~92% |
| Faithfulness | > 70% | ~91.2% |
| Concurrent users | 100+ | Tested 50 |

---

## 8. Tech Stack chi tiáº¿t

### 8.1 Backend Dependencies

```json
{
  "@google/generative-ai": "^0.24.0",
  "@langchain/google-genai": "latest",
  "@xenova/transformers": "^2.17.2",
  "chromadb": "^1.10.7",
  "express": "^4.21.2",
  "mongoose": "^8.13.2",
  "passport": "^0.7.0",
  "jsonwebtoken": "^9.0.2"
}
```

### 8.2 Frontend Dependencies

```json
{
  "react": "^18.3.1",
  "react-router-dom": "^6.29.0",
  "react-markdown": "^9.0.3",
  "lucide-react": "^0.511.0",
  "axios": "^1.9.0"
}
```

---

## 9. MÃ´i trÆ°á»ng triá»ƒn khai

### 9.1 Development

```
Frontend:  http://localhost:3000  (npm start)
Backend:   http://localhost:5000  (npm run dev)
MongoDB:   MongoDB Atlas (cloud) hoáº·c localhost:27017
ChromaDB:  http://localhost:8000  (python src/scripts/run_chroma_fastapi.py)
```

### 9.2 Production

```text
Backend:  Node.js (PORT=5000)
Frontend: React build served by backend or static hosting
ChromaDB: Python FastAPI server (PORT=8000)
MongoDB:  Atlas (external)
```

### 9.3 Biáº¿n mÃ´i trÆ°á»ng quan trá»ng

```env
GEMINI_API_KEY=        # Google AI Studio API key
GEMINI_MODEL=gemini-2.5-flash
MONGODB_URI=           # Atlas connection string
CHROMA_URL=http://localhost:8000
EMBEDDING_DIMENSION=384
AI_RESPONSE_CACHE_ENABLED=false
AI_RAG_TIMEOUT_MS=9000
```

---

*TÃ i liá»‡u nÃ y Ä‘Æ°á»£c táº¡o phá»¥c vá»¥ Ä‘á»“ Ã¡n tá»‘t nghiá»‡p ngÃ nh CÃ´ng nghá»‡ ThÃ´ng tin.*  
*PhiÃªn báº£n: 1.0 â€” NgÃ y cáº­p nháº­t: 15/06/2026*
