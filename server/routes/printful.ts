/**
 * Rutas API para gestionar Printful
 */
import { Router, Request, Response } from 'express';
import { getPrintfulService } from '../services/printful-service';
import type { CreatePrintfulOrder } from '../types/printful';

const router = Router();

// ==================== STORE INFO ====================

router.get('/store', async (req: Request, res: Response) => {
  try {
    const printful = getPrintfulService();
    const storeInfo = await printful.getStoreInfo();
    res.json({ success: true, data: storeInfo });
  } catch (error: any) {
    console.error('Error fetching store info:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

// ==================== CATALOG ====================

/**
 * Obtiene productos del catálogo de Printful
 */
router.get('/catalog/products', async (req: Request, res: Response) => {
  try {
    const { category_id, search } = req.query;
    const printful = getPrintfulService();
    
    let products;
    if (search) {
      products = await printful.searchCatalog(search as string);
    } else if (category_id) {
      products = await printful.getCatalogProducts(Number(category_id));
    } else {
      products = await printful.getCatalogProducts();
    }
    
    res.json({ success: true, data: products });
  } catch (error: any) {
    console.error('Error fetching catalog products:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * Obtiene productos populares del catálogo
 */
router.get('/catalog/popular', async (req: Request, res: Response) => {
  try {
    const printful = getPrintfulService();
    const products = await printful.getPopularProducts();
    res.json({ success: true, data: products });
  } catch (error: any) {
    console.error('Error fetching popular products:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * Obtiene detalles de un producto del catálogo
 */
router.get('/catalog/products/:id', async (req: Request, res: Response) => {
  try {
    const productId = Number(req.params.id);
    const printful = getPrintfulService();
    const product = await printful.getCatalogProduct(productId);
    res.json({ success: true, data: product });
  } catch (error: any) {
    console.error('Error fetching catalog product:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * Obtiene variantes de un producto del catálogo
 */
router.get('/catalog/products/:id/variants', async (req: Request, res: Response) => {
  try {
    const productId = Number(req.params.id);
    const printful = getPrintfulService();
    const variants = await printful.getCatalogVariants(productId);
    res.json({ success: true, data: variants });
  } catch (error: any) {
    console.error('Error fetching catalog variants:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * Obtiene detalles de una variante del catálogo
 */
router.get('/catalog/variants/:id', async (req: Request, res: Response) => {
  try {
    const variantId = Number(req.params.id);
    const printful = getPrintfulService();
    const variant = await printful.getCatalogVariant(variantId);
    res.json({ success: true, data: variant });
  } catch (error: any) {
    console.error('Error fetching catalog variant:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

// ==================== SYNC PRODUCTS ====================

/**
 * Obtiene todos los productos sincronizados
 */
router.get('/sync/products', async (req: Request, res: Response) => {
  try {
    const printful = getPrintfulService();
    const products = await printful.getSyncProducts();
    res.json({ success: true, data: products });
  } catch (error: any) {
    console.error('Error fetching sync products:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * Obtiene detalles de un producto sincronizado
 */
router.get('/sync/products/:id', async (req: Request, res: Response) => {
  try {
    const syncProductId = Number(req.params.id);
    const printful = getPrintfulService();
    const product = await printful.getSyncProduct(syncProductId);
    res.json({ success: true, data: product });
  } catch (error: any) {
    console.error('Error fetching sync product:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * Obtiene variantes de un producto sincronizado
 */
router.get('/sync/products/:id/variants', async (req: Request, res: Response) => {
  try {
    const syncProductId = Number(req.params.id);
    const printful = getPrintfulService();
    const variants = await printful.getSyncVariants(syncProductId);
    res.json({ success: true, data: variants });
  } catch (error: any) {
    console.error('Error fetching sync variants:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * Crea un nuevo producto sincronizado
 */
router.post('/sync/products', async (req: Request, res: Response) => {
  try {
    const productData = req.body;
    const printful = getPrintfulService();
    const product = await printful.createSyncProduct(productData);
    res.json({ success: true, data: product });
  } catch (error: any) {
    console.error('Error creating sync product:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * Actualiza un producto sincronizado
 */
router.put('/sync/products/:id', async (req: Request, res: Response) => {
  try {
    const syncProductId = Number(req.params.id);
    const productData = req.body;
    const printful = getPrintfulService();
    const product = await printful.updateSyncProduct(syncProductId, productData);
    res.json({ success: true, data: product });
  } catch (error: any) {
    console.error('Error updating sync product:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * Elimina un producto sincronizado
 */
router.delete('/sync/products/:id', async (req: Request, res: Response) => {
  try {
    const syncProductId = Number(req.params.id);
    const printful = getPrintfulService();
    await printful.deleteSyncProduct(syncProductId);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting sync product:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

// ==================== ORDERS ====================

/**
 * Obtiene lista de órdenes
 */
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const { status, limit, offset } = req.query;
    const printful = getPrintfulService();
    const orders = await printful.getOrders(
      status as string | undefined,
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0
    );
    res.json({ success: true, data: orders });
  } catch (error: any) {
    console.error('Error fetching orders:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * Obtiene detalles de una orden
 */
router.get('/orders/:id', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const printful = getPrintfulService();
    const order = await printful.getOrder(orderId);
    res.json({ success: true, data: order });
  } catch (error: any) {
    console.error('Error fetching order:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * Crea una nueva orden
 */
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const { orderData, confirm } = req.body;
    const printful = getPrintfulService();
    const order = await printful.createOrder(orderData as CreatePrintfulOrder, confirm);
    res.json({ success: true, data: order });
  } catch (error: any) {
    console.error('Error creating order:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * Estima costos de una orden
 */
router.post('/orders/estimate', async (req: Request, res: Response) => {
  try {
    const orderData = req.body;
    const printful = getPrintfulService();
    const estimate = await printful.estimateOrderCosts(orderData as CreatePrintfulOrder);
    res.json({ success: true, data: estimate });
  } catch (error: any) {
    console.error('Error estimating order costs:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * Confirma una orden
 */
router.post('/orders/:id/confirm', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const printful = getPrintfulService();
    const order = await printful.confirmOrder(orderId);
    res.json({ success: true, data: order });
  } catch (error: any) {
    console.error('Error confirming order:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * Cancela una orden
 */
router.delete('/orders/:id', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const printful = getPrintfulService();
    const order = await printful.cancelOrder(orderId);
    res.json({ success: true, data: order });
  } catch (error: any) {
    console.error('Error canceling order:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * Actualiza una orden
 */
router.put('/orders/:id', async (req: Request, res: Response) => {
  try {
    const orderId = req.params.id;
    const { orderData, confirm } = req.body;
    const printful = getPrintfulService();
    const order = await printful.updateOrder(orderId, orderData, confirm);
    res.json({ success: true, data: order });
  } catch (error: any) {
    console.error('Error updating order:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

/**
 * Calcula tarifas de envío
 */
router.post('/shipping/rates', async (req: Request, res: Response) => {
  try {
    const orderData = req.body;
    const printful = getPrintfulService();
    const rates = await printful.calculateShippingRates(orderData as CreatePrintfulOrder);
    res.json({ success: true, data: rates });
  } catch (error: any) {
    console.error('Error calculating shipping rates:', error.response?.data || error.message);
    res.status(500).json({ 
      success: false, 
      error: error.response?.data?.error?.message || error.message 
    });
  }
});

// ==================== MOCKUP GENERATOR ====================

/**
 * Obtiene printfiles de un producto (necesarios para generar mockups)
 */
router.get('/mockups/printfiles/:productId', async (req: Request, res: Response) => {
  try {
    const productId = Number(req.params.productId);
    const printful = getPrintfulService();
    const printfiles = await printful.getProductPrintfiles(productId);
    res.json({ success: true, data: printfiles });
  } catch (error: any) {
    console.error('Error fetching printfiles:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * Crea una tarea de generación de mockup
 */
router.post('/mockups/generate', async (req: Request, res: Response) => {
  try {
    const { productId, variantIds, imageUrl, placement } = req.body;
    if (!productId || !variantIds?.length || !imageUrl) {
      return res.status(400).json({ success: false, error: 'productId, variantIds and imageUrl are required' });
    }
    const printful = getPrintfulService();
    const task = await printful.createMockupTask(productId, variantIds, imageUrl, placement);
    res.json({ success: true, data: task });
  } catch (error: any) {
    console.error('Error creating mockup task:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * Consulta el resultado de una tarea de mockup
 */
router.get('/mockups/task/:taskKey', async (req: Request, res: Response) => {
  try {
    const taskKey = req.params.taskKey;
    const printful = getPrintfulService();
    const result = await printful.getMockupTaskResult(taskKey);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching mockup result:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * Genera mockup completo (crea tarea + polling hasta completar)
 */
router.post('/mockups/generate-complete', async (req: Request, res: Response) => {
  try {
    const { productId, variantIds, imageUrl, placement } = req.body;
    if (!productId || !variantIds?.length || !imageUrl) {
      return res.status(400).json({ success: false, error: 'productId, variantIds and imageUrl are required' });
    }
    const printful = getPrintfulService();
    const mockups = await printful.generateMockupAndWait(productId, variantIds, imageUrl, placement);
    res.json({ success: true, data: mockups });
  } catch (error: any) {
    console.error('Error generating complete mockup:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message
    });
  }
});

export default router;
