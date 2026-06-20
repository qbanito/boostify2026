import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/use-auth';
import { MusicLoadingSpinner } from '../ui/music-loading-spinner';

// Tipos para los contactos de la industria
interface IndustryContact {
  id: number;
  name: string;
  email: string;
  type: 'radio' | 'tv' | 'movie' | 'other';
  region: string;
}

// Tipos para el formulario de contacto
interface ContactFormData {
  name: string;
  email: string;
  recipientEmail: string;
  subject: string;
  message: string;
  profileUrl?: string;
  songUrl?: string;
  contactType: 'radio' | 'tv' | 'movie' | 'other';
}

const CreativeContactSearch: React.FC = () => {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [contactType, setContactType] = useState<'all' | 'radio' | 'tv' | 'movie'>('all');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<IndustryContact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedContact, setSelectedContact] = useState<IndustryContact | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Formulario para enviar perfil de artista
  const [formData, setFormData] = useState<ContactFormData>({
    name: user?.displayName || '',
    email: user?.email || '',
    recipientEmail: '',
    subject: 'Perfil de Artista - Boostify Music',
    message: '',
    profileUrl: '',
    songUrl: '',
    contactType: 'radio'
  });

  useEffect(() => {
    // Actualizar el email y nombre del usuario cuando se cargue
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.displayName || prev.name,
        email: user.email || prev.email
      }));
    }
  }, [user]);

  // Efecto para el foco automático en el input
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  // Efecto para reiniciar el mensaje de éxito después de unos segundos
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Búsqueda de contactos en la industria
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setIsSearching(true);
    
    try {
      const response = await fetch(
        `/api/contacts/search?q=${encodeURIComponent(searchTerm)}&type=${contactType}`,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Error al buscar contactos');
      }
      
      const data = await response.json();
      setSearchResults(data);
    } catch (err) {
      console.error('Error de búsqueda:', err);
      setError('Error al buscar contactos. Intente nuevamente.');
    } finally {
      setIsSearching(false);
    }
  };

  // Manejador para el cambio en el formulario
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Seleccionar un contacto para enviar email
  const handleContactSelect = (contact: IndustryContact) => {
    setSelectedContact(contact);
    setShowForm(true);
    setFormData(prev => ({
      ...prev,
      recipientEmail: contact.email,
      contactType: contact.type
    }));
  };

  // Enviar el perfil a un contacto
  const handleSendProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedContact) return;
    
    setIsSending(true);
    setError('');
    
    try {
      const response = await fetch('/api/email/send-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar el perfil');
      }
      
      setSuccess(true);
      setShowForm(false);
      setSelectedContact(null);
      
      // Resetear el formulario
      setFormData(prev => ({
        ...prev,
        subject: 'Perfil de Artista - Boostify Music',
        message: '',
        profileUrl: '',
        songUrl: '',
      }));
      
    } catch (err: any) {
      console.error('Error al enviar perfil:', err);
      setError(err.message || 'Error al enviar el perfil. Intente nuevamente.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4">
      <h2 className="text-2xl font-bold text-slate-800 mb-8">
        Búsqueda Creativa de Contactos
      </h2>
      
      {/* Barra de búsqueda animada */}
      <div className="relative mb-8">
        <motion.div 
          className="flex items-center gap-3 p-1 bg-gradient-to-r from-purple-600 to-blue-500 rounded-lg overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex-1 bg-white rounded-md overflow-hidden flex items-center">
            <input
              ref={searchInputRef}
              type="text"
              className="w-full px-4 py-3 outline-none text-gray-700"
              placeholder="Buscar contactos en la industria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            
            <select
              className="border-l border-gray-200 px-3 py-3 text-gray-700 bg-gray-50 outline-none"
              value={contactType}
              onChange={(e) => setContactType(e.target.value as any)}
            >
              <option value="all">Todos</option>
              <option value="radio">Radio</option>
              <option value="tv">Televisión</option>
              <option value="movie">Cine</option>
            </select>
          </div>
          
          <motion.button
            className="px-5 py-3 bg-white text-slate-800 rounded-md font-semibold flex items-center gap-2 hover:bg-gray-100 transition-colors"
            onClick={handleSearch}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {isSearching ? (
              <div className="flex items-center">
                <div className="w-4 h-4 mr-2 rounded-full bg-violet-500 animate-pulse"></div>
                <span>Buscando...</span>
              </div>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Buscar
              </>
            )}
          </motion.button>
        </motion.div>
        
        {/* Barra de progreso moderna */}
        <AnimatePresence>
          {isSearching && (
            <motion.div 
              className="w-full mt-4" 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
            >
              <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-gradient-to-r from-blue-400 via-violet-500 to-purple-600"
                  initial={{ width: "0%" }}
                  animate={{ 
                    width: "100%", 
                    transition: { 
                      duration: 2.5, 
                      repeat: Infinity,
                      repeatType: "reverse",
                      ease: "easeInOut"
                    } 
                  }}
                />
              </div>
              <div className="text-sm text-center text-violet-600 mt-2">Buscando contactos en la industria...</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Mensaje de error */}
      {error && (
        <motion.div 
          className="bg-red-50 text-red-600 p-4 rounded-md mb-6"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {error}
        </motion.div>
      )}
      
      {/* Mensaje de éxito */}
      <AnimatePresence>
        {success && (
          <motion.div 
            className="bg-green-50 text-green-600 p-4 rounded-md mb-6"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            ¡Perfil enviado exitosamente!
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Resultados de búsqueda */}
      <AnimatePresence>
        {!showForm && searchResults.length > 0 && (
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-xl font-semibold mb-4">Resultados de búsqueda</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {searchResults.map((contact) => (
                <motion.div
                  key={contact.id}
                  className="bg-white p-5 rounded-lg shadow-sm border border-gray-100 hover:shadow-lg transition-all"
                  whileHover={{ y: -3, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center">
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center mr-3 ${
                          contact.type === 'radio' ? 'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600' : 
                          contact.type === 'tv' ? 'bg-gradient-to-br from-purple-100 to-purple-200 text-purple-600' : 
                          'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-600'
                        }`}>
                          {contact.type === 'radio' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          ) : contact.type === 'tv' ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-800">{contact.name}</h4>
                          <p className="text-sm text-gray-500">{contact.email}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className={`text-xs px-2.5 py-1.5 rounded-full font-medium ${
                          contact.type === 'radio' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 
                          contact.type === 'tv' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {contact.type === 'radio' ? 'Radio' : 
                           contact.type === 'tv' ? 'Televisión' : 'Cine'}
                        </span>
                        <span className="text-xs px-2.5 py-1.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                          {contact.region}
                        </span>
                      </div>
                    </div>
                    <motion.button
                      className="px-4 py-2 bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-sm font-medium rounded-lg shadow-sm"
                      onClick={() => handleContactSelect(contact)}
                      whileHover={{ scale: 1.05, boxShadow: "0 4px 12px rgba(124, 58, 237, 0.2)" }}
                      whileTap={{ scale: 0.95 }}
                      initial={{ boxShadow: "0 2px 4px rgba(124, 58, 237, 0.1)" }}
                    >
                      Contactar
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Formulario para enviar perfil */}
      <AnimatePresence>
        {showForm && selectedContact && (
          <motion.div
            className="mt-8 bg-white p-6 rounded-2xl shadow-xl border border-gray-100"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Enviar perfil a {selectedContact.name}</h3>
              <button 
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setShowForm(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSendProfile}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    name="name"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                    value={formData.name}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                    value={formData.email}
                    onChange={handleFormChange}
                    required
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asunto
                </label>
                <input
                  type="text"
                  name="subject"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                  value={formData.subject}
                  onChange={handleFormChange}
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mensaje
                </label>
                <textarea
                  name="message"
                  rows={5}
                  className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all resize-none"
                  value={formData.message}
                  onChange={handleFormChange}
                  placeholder="Describe tu proyecto, estilo musical y por qué te gustaría colaborar..."
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL de tu perfil (opcional)
                  </label>
                  <input
                    type="url"
                    name="profileUrl"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                    value={formData.profileUrl}
                    onChange={handleFormChange}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL de tu música (opcional)
                  </label>
                  <input
                    type="url"
                    name="songUrl"
                    className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                    value={formData.songUrl}
                    onChange={handleFormChange}
                    placeholder="https://..."
                  />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <motion.button
                  type="button"
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg mr-3 transition-all hover:bg-gray-200"
                  onClick={() => setShowForm(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancelar
                </motion.button>
                <motion.button
                  type="submit"
                  className="px-5 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg flex items-center shadow-md hover:shadow-lg transition-all"
                  disabled={isSending}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isSending ? (
                    <>
                      <div className="flex items-center">
                        <div className="w-3 h-3 mr-2 rounded-full bg-white animate-pulse"></div>
                        <span>Enviando...</span>
                      </div>
                    </>
                  ) : (
                    'Enviar Perfil'
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Sección informativa */}
      {searchResults.length === 0 && !showForm && (
        <motion.div
          className="text-center mt-12 p-6 bg-gray-50 rounded-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-xl font-semibold mb-2">Contactos en la Industria</h3>
          <p className="text-gray-600 mb-4">
            Busca contactos en radio, televisión y cine para promocionar tu música.
            Construye relaciones profesionales y amplía tus oportunidades.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <div className="bg-blue-100 text-blue-600 p-2 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h4 className="font-medium mb-2">Radio</h4>
              <p className="text-sm text-gray-500">
                Conecta con programadores de radio para conseguir tiempo al aire y entrevistas.
              </p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <div className="bg-purple-100 text-purple-600 p-2 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h4 className="font-medium mb-2">Televisión</h4>
              <p className="text-sm text-gray-500">
                Encuentra productores de TV para oportunidades de presentaciones y apariciones.
              </p>
            </div>
            <div className="p-4 bg-white rounded-lg shadow-sm">
              <div className="bg-amber-100 text-amber-600 p-2 rounded-full w-12 h-12 mx-auto mb-4 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                </svg>
              </div>
              <h4 className="font-medium mb-2">Cine</h4>
              <p className="text-sm text-gray-500">
                Contacta supervisores musicales para colocación en películas y series.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default CreativeContactSearch;