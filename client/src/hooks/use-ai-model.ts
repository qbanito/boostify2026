import { useAIModelsStore } from "../store/ai-models-store";

export function useAIModel() {
  const store = useAIModelsStore();
  
  const getActiveTextModels = () => {
    return store.textModels.filter(model => model.enabled);
  };

  const getActiveImageModels = () => {
    return store.imageModels.filter(model => model.enabled);
  };

  const getDefaultTextModel = () => {
    return store.textModels.find(model => model.id === store.defaultTextModel);
  };

  const getDefaultImageModel = () => {
    return store.imageModels.find(model => model.id === store.defaultImageModel);
  };

  const getModelById = (id: string, type: 'text' | 'image') => {
    if (type === 'text') {
      return store.textModels.find(model => model.id === id);
    }
    return store.imageModels.find(model => model.id === id);
  };

  return {
    getActiveTextModels,
    getActiveImageModels,
    getDefaultTextModel,
    getDefaultImageModel,
    getModelById,
  };
}
