/**
 * Servicio para gestionar el almacenamiento local de las tareas de Flux
 * 
 * Proporciona métodos para guardar, actualizar y recuperar tareas de generación
 * de imágenes usando localStorage del navegador.
 */

import { FluxTaskResult } from './flux-service';
import { logger } from "../../logger";

// Clave donde se almacenarán las tareas en localStorage
const STORAGE_KEY = 'flux_tasks';

// Máximo número de tareas a guardar en el historial
const MAX_TASKS = 20;

/**
 * Servicio para el almacenamiento local de tareas de Flux
 */
export const fluxLocalStorageService = {
  /**
   * Guarda una nueva tarea en el almacenamiento local
   * 
   * @param task Tarea a guardar
   */
  saveTask(task: FluxTaskResult): void {
    try {
      // Obtener tareas actuales
      const tasks = this.getTasks();
      
      // Agregar la nueva tarea al principio
      tasks.unshift({
        ...task,
        timestamp: Date.now() // Agregar timestamp para ordenamiento
      });
      
      // Limitar a MAX_TASKS
      const limitedTasks = tasks.slice(0, MAX_TASKS);
      
      // Guardar en localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedTasks));
      
      logger.info('Tarea guardada en almacenamiento local:', task.taskId);
    } catch (error) {
      logger.error('Error guardando tarea en localStorage:', error);
    }
  },
  
  /**
   * Actualiza una tarea existente en el almacenamiento local
   * 
   * @param task Tarea actualizada
   */
  updateTask(task: FluxTaskResult): void {
    try {
      if (!task.taskId) {
        logger.error('No se puede actualizar tarea sin ID');
        return;
      }
      
      // Obtener tareas actuales
      const tasks = this.getTasks();
      
      // Buscar la tarea
      const index = tasks.findIndex(t => t.taskId === task.taskId);
      
      if (index !== -1) {
        // Actualizar manteniendo el timestamp original
        const originalTimestamp = tasks[index].timestamp || Date.now();
        tasks[index] = {
          ...task,
          timestamp: originalTimestamp
        };
        
        // Guardar en localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        
        logger.info('Tarea actualizada en almacenamiento local:', task.taskId);
      } else {
        // Si no existe, guardarla como nueva
        this.saveTask(task);
      }
    } catch (error) {
      logger.error('Error actualizando tarea en localStorage:', error);
    }
  },
  
  /**
   * Obtiene todas las tareas guardadas en orden de más reciente a más antigua
   * 
   * @returns Lista de tareas ordenadas por timestamp
   */
  getTasks(): FluxTaskResult[] {
    try {
      // Obtener datos de localStorage
      const tasksJSON = localStorage.getItem(STORAGE_KEY);
      
      if (!tasksJSON) {
        return [];
      }
      
      // Parsear y devolver ordenado por timestamp
      const tasks = JSON.parse(tasksJSON) as FluxTaskResult[];
      
      // Ordenar por timestamp (más reciente primero)
      return tasks.sort((a, b) => {
        const timestampA = a.timestamp || 0;
        const timestampB = b.timestamp || 0;
        return timestampB - timestampA;
      });
    } catch (error) {
      logger.error('Error recuperando tareas de localStorage:', error);
      return [];
    }
  },
  
  /**
   * Obtiene una tarea específica por su ID
   * 
   * @param taskId ID de la tarea a buscar
   * @returns La tarea si existe, undefined en caso contrario
   */
  getTask(taskId: string): FluxTaskResult | undefined {
    try {
      const tasks = this.getTasks();
      return tasks.find(task => task.taskId === taskId);
    } catch (error) {
      logger.error('Error buscando tarea en localStorage:', error);
      return undefined;
    }
  },
  
  /**
   * Elimina una tarea del almacenamiento local
   * 
   * @param taskId ID de la tarea a eliminar
   */
  deleteTask(taskId: string): void {
    try {
      // Obtener tareas actuales
      const tasks = this.getTasks();
      
      // Filtrar la tarea a eliminar
      const filteredTasks = tasks.filter(task => task.taskId !== taskId);
      
      // Guardar la lista actualizada
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredTasks));
      
      logger.info('Tarea eliminada del almacenamiento local:', taskId);
    } catch (error) {
      logger.error('Error eliminando tarea de localStorage:', error);
    }
  },
  
  /**
   * Limpia todas las tareas del almacenamiento local
   */
  clearTasks(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      logger.info('Todas las tareas eliminadas del almacenamiento local');
    } catch (error) {
      logger.error('Error limpiando tareas de localStorage:', error);
    }
  }
};

export default fluxLocalStorageService;