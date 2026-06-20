/**
 * API Proxy seguro para producción
 * Este archivo implementa un proxy para APIs externas que requieren claves de API
 * para evitar exponer credenciales en el frontend
 */

import { Router } from 'express';
import axios from 'axios';
import type { Request, Response } from 'express';

const router = Router();

// Configuración de APIs
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FAL_API_KEY = process.env.FAL_API_KEY;

// Middleware para verificar API keys disponibles
function verificarAPIKeys(req: Request, res: Response, next: Function) {
  const apis = {
    'openai': OPENAI_API_KEY,
    'fal': FAL_API_KEY
  };
  
  const apiName = req.params.api;
  
  if (!apis[apiName]) {
    return res.status(400).json({
      success: false,
      error: 'API no soportada'
    });
  }
  
  if (!apis[apiName]) {
    return res.status(500).json({
      success: false,
      error: 'Configuración de API no disponible'
    });
  }
  
  next();
}

// Proxy para OpenAI
router.post('/openai/:endpoint', verificarAPIKeys, async (req: Request, res: Response) => {
  try {
    const endpoint = req.params.endpoint;
    const { data } = await axios.post(
      `https://api.openai.com/v1/${endpoint}`,
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error en proxy OpenAI:', error.message);
    
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message
    });
  }
});

// Proxy para Fal.ai
router.post('/fal/:endpoint', verificarAPIKeys, async (req: Request, res: Response) => {
  try {
    const endpoint = req.params.endpoint;
    const { data } = await axios.post(
      `https://api.fal.ai/${endpoint}`,
      req.body,
      {
        headers: {
          'Authorization': `Bearer ${FAL_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error en proxy Fal.ai:', error.message);
    
    return res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message
    });
  }
});

export default router;
