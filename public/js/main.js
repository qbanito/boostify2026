// JavaScript principal para la aplicación

document.addEventListener('DOMContentLoaded', function() {
  console.log('Aplicación inicializada correctamente');
  
  // Inicializar animaciones de scroll
  initScrollAnimations();
  
  // Manejar navegación móvil
  setupMobileNavigation();
});

// Función para inicializar animaciones al hacer scroll
function initScrollAnimations() {
  const elements = document.querySelectorAll('.feature-card, .section-title');
  
  // Función para comprobar si un elemento está en el viewport
  function isInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
      rect.top <= (window.innerHeight || document.documentElement.clientHeight) * 0.8 &&
      rect.bottom >= 0
    );
  }
  
  // Función para comprobar la visibilidad de los elementos al hacer scroll
  function checkVisibility() {
    elements.forEach(element => {
      if (isInViewport(element) && !element.classList.contains('visible')) {
        element.classList.add('visible');
        element.style.opacity = '1';
        element.style.transform = 'translateY(0)';
      }
    });
  }
  
  // Establecer estilos iniciales
  elements.forEach(element => {
    element.style.opacity = '0';
    element.style.transform = 'translateY(30px)';
    element.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
  });
  
  // Comprobar la visibilidad inicial
  checkVisibility();
  
  // Escuchar el evento de scroll
  window.addEventListener('scroll', checkVisibility);
}

// Función para manejar la navegación en dispositivos móviles
function setupMobileNavigation() {
  const headerContent = document.querySelector('.header-content');
  const navMenu = document.querySelector('nav ul');
  
  // Crear botón de menú móvil si no existe
  if (!document.querySelector('.mobile-menu-btn') && headerContent && navMenu) {
    const mobileMenuBtn = document.createElement('button');
    mobileMenuBtn.className = 'mobile-menu-btn';
    mobileMenuBtn.innerHTML = '☰';
    mobileMenuBtn.style.display = 'none';
    
    // Agregar estilos al botón
    mobileMenuBtn.style.background = 'none';
    mobileMenuBtn.style.border = 'none';
    mobileMenuBtn.style.fontSize = '24px';
    mobileMenuBtn.style.cursor = 'pointer';
    mobileMenuBtn.style.color = '#333';
    mobileMenuBtn.style.padding = '5px';
    
    // Manejar click en el botón
    mobileMenuBtn.addEventListener('click', function() {
      navMenu.classList.toggle('show');
      
      if (navMenu.classList.contains('show')) {
        navMenu.style.display = 'flex';
      } else {
        navMenu.style.display = '';
      }
    });
    
    // Insertar el botón en el header
    headerContent.insertBefore(mobileMenuBtn, navMenu);
    
    // Función para ajustar la visualización según el tamaño de pantalla
    function adjustMenuDisplay() {
      if (window.innerWidth <= 768) {
        mobileMenuBtn.style.display = 'block';
        navMenu.style.display = navMenu.classList.contains('show') ? 'flex' : 'none';
      } else {
        mobileMenuBtn.style.display = 'none';
        navMenu.style.display = '';
        navMenu.classList.remove('show');
      }
    }
    
    // Ajustar visualización inicial
    adjustMenuDisplay();
    
    // Escuchar cambios de tamaño de ventana
    window.addEventListener('resize', adjustMenuDisplay);
  }
}