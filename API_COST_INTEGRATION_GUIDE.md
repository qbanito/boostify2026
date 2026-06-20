# API Cost Integration Guide

## 📊 Sistema Completo de Monitoreo de Costos

He creado un sistema completo para extraer, calcular y monitorear costos de todas las APIs. Aquí está cómo funciona:

## 1️⃣ **Archivos Creados**

### `server/utils/api-pricing.ts`
- **Precios actualizados** para OpenAI, Gemini, Anthropic, FAL y más
- Soporta dos formatos de precios:
  - Por 1K tokens (OpenAI, Anthropic)
  - Por 1M tokens (Gemini)
- Función `calculateApiCost()` que calcula automáticamente el costo basado en:
  - Tokens de entrada (prompt)
  - Tokens de salida (completion)
  - Modelo y proveedor

### `server/utils/api-logger.ts`
- Función `logApiUsage()` - Registra cada llamada API en la base de datos
- Extrae automáticamente tokens según el proveedor
- Calcula costos automáticamente
- Funciones helper para cada API:
  - `extractOpenAITokens()`
  - `extractGeminiTokens()`
  - `extractAnthropicTokens()`

## 2️⃣ **Cómo Integrar en Tus Rutas**

### Ejemplo 1: OpenAI (Chat Completion)

```typescript
import { logApiUsage, extractOpenAITokens } from '../utils/api-logger';

app.post('/api/openai/chat', async (req: Request, res: Response) => {
  const userId = req.user?.id;
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: req.body.messages,
      temperature: 0.7,
    });
    
    // Registrar uso de API
    const { promptTokens, completionTokens } = extractOpenAITokens(response);
    
    await logApiUsage({
      userId,
      apiProvider: 'openai',
      endpoint: '/chat/completions',
      model: 'gpt-4o',
      promptTokens,
      completionTokens,
      responseTime: Date.now() - startTime,
      status: 'success'
    });
    
    return res.json({ success: true, data: response });
  } catch (error) {
    // Registrar error también
    await logApiUsage({
      userId,
      apiProvider: 'openai',
      endpoint: '/chat/completions',
      model: 'gpt-4o',
      promptTokens: 0,
      completionTokens: 0,
      status: 'error',
      errorMessage: error.message
    });
    
    return res.status(500).json({ error: 'OpenAI request failed' });
  }
});
```

### Ejemplo 2: Gemini (Vision)

```typescript
import { logApiUsage, extractGeminiTokens } from '../utils/api-logger';

app.post('/api/gemini/vision', async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const startTime = Date.now();
  
  try {
    const response = await genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
      .generateContent(req.body.content);
    
    // Registrar uso
    const { promptTokens, completionTokens } = extractGeminiTokens(response);
    
    await logApiUsage({
      userId,
      apiProvider: 'gemini',
      endpoint: '/generateContent',
      model: 'gemini-2.0-flash',
      promptTokens,
      completionTokens,
      responseTime: Date.now() - startTime,
      status: 'success',
      metadata: { contentType: 'vision' }
    });
    
    return res.json({ success: true, data: response });
  } catch (error) {
    await logApiUsage({
      userId,
      apiProvider: 'gemini',
      endpoint: '/generateContent',
      model: 'gemini-2.0-flash',
      status: 'error',
      errorMessage: error.message
    });
  }
});
```

### Ejemplo 3: FAL (Imágenes)

```typescript
import { logApiUsage } from '../utils/api-logger';
import { calculateApiCost } from '../utils/api-pricing';

app.post('/api/fal/image-generation', async (req: Request, res: Response) => {
  const userId = req.user?.id;
  
  try {
    const result = await fal.subscribe('fal-ai/flux-pro', {
      input: req.body.input,
    });
    
    // Para FAL, contamos "tokens" como número de imágenes
    const imageCount = result.images?.length || 1;
    const cost = calculateApiCost('fal', 'fal-ai/flux-pro', 0, imageCount * 1000);
    
    await logApiUsage({
      userId,
      apiProvider: 'fal',
      endpoint: '/subscribe',
      model: 'fal-ai/flux-pro',
      totalTokens: imageCount * 1000, // 1000 "tokens" por imagen
      status: 'success',
      metadata: { imageCount, imageUrls: result.images }
    });
    
    return res.json({ success: true, data: result });
  } catch (error) {
    await logApiUsage({
      userId,
      apiProvider: 'fal',
      endpoint: '/subscribe',
      model: 'fal-ai/flux-pro',
      status: 'error',
      errorMessage: error.message
    });
  }
});
```

## 3️⃣ **Cómo Funciona el Cálculo de Costos**

### Paso 1: Determina el proveedor y modelo
```typescript
const provider = 'openai';
const model = 'gpt-4o';
const promptTokens = 150;
const completionTokens = 250;
```

### Paso 2: El sistema busca el precio
```typescript
// Para gpt-4o:
// inputCost: $0.005 per 1K tokens
// outputCost: $0.015 per 1K tokens
```

### Paso 3: Calcula automáticamente
```typescript
// Costo = (150 / 1000) * 0.005 + (250 / 1000) * 0.015
//       = 0.00075 + 0.00375
//       = $0.0045
```

## 4️⃣ **Precios Soportados**

### OpenAI
- gpt-4: $0.03/$0.06 per 1K tokens
- gpt-4-turbo: $0.01/$0.03
- gpt-4o: $0.005/$0.015 ⭐
- gpt-3.5-turbo: $0.0005/$0.0015

### Gemini
- gemini-2.0-flash: $0.075/$0.3 per 1M tokens
- gemini-1.5-pro: $1.25/$5 per 1M tokens
- gemini-1.5-flash: $0.075/$0.3 per 1M tokens

### Anthropic
- claude-3-opus: $0.015/$0.075 per 1K tokens
- claude-3-sonnet: $0.003/$0.015
- claude-3-haiku: $0.00025/$0.00125

### FAL
- flux-pro: ~$0.005 por imagen
- fast-sdxl: ~$0.002 por imagen
- kling-video: ~$0.1 por video

## 5️⃣ **Ver Dashboard**

Una vez integrado, ve a **Admin → API Usage** y verás:

✅ **Métricas en tiempo real:**
- Total de requests y tokens
- Costo total de la plataforma
- Costo por proveedor
- Tendencias diarias
- Top modelos usados
- Últimas llamadas con status

✅ **Filtros:**
- Últimos 7, 30 o 90 días
- Por usuario
- Por proveedor

## 6️⃣ **Próximos Pasos Recomendados**

1. **Integra logging en tus rutas existentes:**
   - `server/routes/openai.ts`
   - `server/routes/gemini-agents.ts`
   - `server/routes/fal-api.ts`
   - Y otras que uses

2. **Actualiza precios mensualmente:**
   - Edita `server/utils/api-pricing.ts`
   - Los cambios se aplican automáticamente

3. **Monitorea en el dashboard:**
   - Track costos por usuario
   - Identifica modelos caros
   - Optimiza API calls

## 📝 **Ejemplo Completo Integrado**

```typescript
// 1. Import las funciones
import { logApiUsage, extractOpenAITokens } from '../utils/api-logger';

// 2. En tu ruta de API
router.post('/chat', async (req, res) => {
  const startTime = Date.now();
  const userId = req.user?.id;
  
  try {
    // 3. Haz la llamada a la API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: req.body.messages,
    });
    
    // 4. Registra el uso automáticamente
    await logApiUsage({
      userId,
      apiProvider: 'openai',
      endpoint: '/chat/completions',
      model: 'gpt-4o',
      ...extractOpenAITokens(response),
      responseTime: Date.now() - startTime,
      status: 'success'
    });
    
    res.json({ success: true, data: response });
  } catch (error) {
    // 5. Registra errores también
    await logApiUsage({
      userId,
      apiProvider: 'openai',
      endpoint: '/chat/completions',
      status: 'error',
      errorMessage: error.message
    });
    
    res.status(500).json({ error: error.message });
  }
});
```

¡Listo! Ahora tus APIs están siendo monitoradas y los costos se calculan automáticamente. 🚀
