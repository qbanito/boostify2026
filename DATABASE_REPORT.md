# Reporte de Bases de Datos — Boostify Music
**Fecha:** Abril 21, 2026

---

## 1. PostgreSQL (Neon Serverless) — Base de datos principal

**Conexión:** `ep-silent-silence-ad6swgqg-pooler.c-2.us-east-1.aws.neon.tech/neondb`  
**ORM:** Drizzle ORM  
**Archivo:** `db/schema.ts`

Cuenta con **~90+ tablas** organizadas en los siguientes módulos:

---

### 👤 Usuarios & Auth

| Tabla | Contenido |
|---|---|
| `users` | Perfil completo del artista: Clerk auth, Firebase, blockchain BTF-2300, layout, preset visual, `masterJson` |
| `sessions` | Sesiones activas (Replit Auth legacy) |
| `user_roles` | Sistema de roles y permisos |

---

### 🎵 Contenido Musical

| Tabla | Contenido |
|---|---|
| `songs` | Canciones con audio URL, AI provider, ISRC/UPC, lyrics, mood |
| `artist_media` | Videos del artista (Firebase Storage path) |
| `musician_clips` | Clips de músicos para demo/booking |
| `generated_videos` | Videos generados por IA |
| `music_video_projects` | Proyectos de videos musicales con escenas, guión, arco emocional |
| `music_video_concepts` | Conceptos y borradores de videos |
| `artist_profile_images` | Galería de imágenes AI del artista |
| `artist_news` | Noticias generadas por AI del artista |
| `artist_personality` | Personalidad definida para agentes IA |
| `performance_segments` | Segmentos de performance para el Economic Engine |

---

### 🛍️ Tienda & Economía

| Tabla | Contenido |
|---|---|
| `merchandise` | Productos con pre-order, limited edition, seasonal collections |
| `product_bundles` | Paquetes con descuento de productos |
| `product_views` | Analytics de vistas por producto |
| `sales_transactions` | Ventas con comisión, costo producción, fee plataforma |
| `artist_wallet` | Balance, earnings, spent por artista |
| `wallet_transactions` | Historial de movimientos del wallet |
| `transactions` | Transacciones generales de la plataforma |

---

### 💳 Suscripciones & Pagos

| Tabla | Contenido |
|---|---|
| `subscriptions` | Plan, status, límites de uso (AI, EPK, merch, artistas generados), Stripe IDs |
| `payments` | Pagos con Stripe payment intent, fee plataforma |
| `user_credits` | Créditos del sistema freemium |
| `credit_transactions` | Historial de consumo de créditos |

---

### 📣 Campañas & Outreach

| Tabla | Contenido |
|---|---|
| `pr_campaigns` | Campañas de PR con medios objetivo, pitch |
| `pr_media_database` | Base de contactos de medios |
| `outreach_campaigns` | Campañas de outreach a la industria |
| `outreach_templates` | Plantillas de email para outreach |
| `outreach_email_log` | Log de emails enviados |
| `outreach_daily_quota` | Control de cuotas diarias por API |
| `music_industry_contacts` | Contactos de la industria musical |
| `crowdfunding_campaigns` | Campañas de crowdfunding |
| `crowdfunding_contributions` | Contribuciones a campañas |
| `sponsor_campaigns` | Campañas de patrocinadores |
| `venue_booking_campaigns` | Campañas de booking de venues |
| `spotify_curators` | Curadores de Spotify para pitching |

---

### 🤖 Agentes IA (AAS Engine)

| Tabla | Contenido |
|---|---|
| `agent_sessions` | Sesiones activas de agentes |
| `agent_memory` | Memoria persistente de agentes por artista |
| `agent_saved_results` | Resultados guardados de agentes |
| `agent_usage_stats` | Estadísticas de uso por agente |
| `agent_action_queue` | Cola de acciones pendientes |
| `ai_social_posts` | Posts generados por agentes IA |
| `ai_post_comments` | Comentarios generados por IA |
| `world_events` | Eventos del mundo para el AAS Engine |
| `artist_relationships` | Relaciones entre artistas AI |
| `content_generation_queue` | Cola de generación de contenido |

---

### 📚 Educación

| Tabla | Contenido |
|---|---|
| `courses` | Cursos con precio, nivel, duración |
| `course_lessons` | Lecciones con drip content |
| `course_enrollments` | Inscripciones y progreso |
| `course_quizzes` | Quizzes por lección |
| `quiz_questions` | Preguntas con respuestas y explicaciones |
| `quiz_attempts` | Intentos y puntajes |
| `lesson_progress` | Progreso por lección por usuario |
| `achievements` | Logros desbloqueables |
| `user_achievements` | Logros obtenidos |

---

### 🌐 Social & Red

| Tabla | Contenido |
|---|---|
| `social_users` | Perfiles en la red social interna |
| `social_posts` | Posts de la red social |
| `social_comments` | Comentarios en posts |
| `social_media_posts` | Posts para RRSS externas (IG, TikTok) |
| `instagram_connections` | Conexiones OAuth de Instagram |
| `notifications` | Notificaciones en tiempo real |

---

### 🤝 Afiliados

| Tabla | Contenido |
|---|---|
| `affiliates` | Afiliados registrados |
| `affiliate_links` | Links de tracking |
| `affiliate_clicks` | Clics rastreados |
| `affiliate_conversions` | Conversiones |
| `affiliate_earnings` | Comisiones ganadas |
| `affiliate_payouts` | Pagos a afiliados |
| `affiliate_coupons` | Códigos de descuento |
| `affiliate_badges` | Insignias por performance |
| `affiliate_referrals` | Referidos |
| `affiliate_marketing_materials` | Materiales de marketing |
| `affiliate_promotions` | Promociones activas |

---

### ⛓️ Blockchain / Web3

| Tabla | Contenido |
|---|---|
| `tokenized_songs` | Canciones tokenizadas BTF-2300 |
| `token_purchases` | Compras de tokens |
| `artist_token_earnings` | Ganancias por tokens |
| `swap_pairs` | Pares de intercambio (BoostiSwap) |
| `liquidity_pools` | Pools de liquidez |
| `liquidity_positions` | Posiciones activas |
| `swap_history` | Historial de swaps |

---

### 📊 Módulos Adicionales

| Tabla | Contenido |
|---|---|
| `api_usage_log` | Log de consumo de APIs por costo |
| `render_queue` | Cola de renderizado de videos |
| `marketing_metrics` | Métricas de marketing |
| `analytics_history` | Historial de analytics |
| `contracts` | Contratos |
| `events` | Eventos/conciertos |
| `manager_tasks` | Tareas del manager |
| `manager_contacts` | Contactos del manager |
| `manager_schedule` | Agenda del manager |
| `manager_notes` | Notas del manager |
| `fashion_sessions` | Sesiones del Fashion AI Studio |
| `fashion_results` | Resultados de pruebas de moda |
| `fashion_analysis` | Análisis de estilos |
| `fashion_portfolio` | Portfolio de moda |
| `fashion_videos` | Videos del Fashion Studio |
| `product_tryon_history` | Historial de pruebas de producto virtual |
| `musicians` | Músicos disponibles en el marketplace |
| `bookings` | Reservas de músicos |
| `audio_demos` | Demos de audio generados |
| `investors` | Inversores registrados |
| `investor_payments` | Pagos de inversores |
| `course_instructors` | Instructores de cursos |
| `course_reviews` | Reseñas de cursos |

---

## 2. Firebase Firestore — Datos en tiempo real y media

**Proyecto:** `artist-boost`  
**Admin SDK:** inicializado con service account `firebase-adminsdk-fbsvc@artist-boost.iam.gserviceaccount.com`

### Colecciones activas

| Colección | Contenido |
|---|---|
| `users` | Docs de usuario (sincronizados con PG) |
| `songs` | Canciones en subcolección por artista |
| `videos` | Videos en subcolección por artista |
| `generated_artists` | Artistas generados por IA (Virtual Label) |
| `artist_music` | Música de artistas generados |
| `artist_videos` | Videos de artistas generados |
| `social_posts` | Posts sociales generados |
| `news_calendar` | Calendario de noticias AI |
| `videoProjects` | Proyectos de video musical |
| `video_editor_projects` | Proyectos del editor profesional |
| `editor_clips` | Clips del editor |
| `editor_exports` | Exportaciones del editor |
| `editor_activities` | Actividad del editor |
| `spotify_data` | Tokens y datos de Spotify por usuario |
| `subscriptions` | Estado de suscripción (sincronizado con Stripe) |
| `subscription_events` | Eventos de cambio de plan |
| `investor_leads` | Leads de inversores |
| `outreach_logs` | Logs de outreach a inversores |
| `affiliateProducts` | Productos del programa afiliados |
| `courses` | Cursos (legacy) |
| `merchConfig` | Configuración global de merch |

---

## 3. Firebase Storage — Archivos multimedia

**Bucket:** `artist-boost.appspot.com`

| Tipo de archivo | Descripción |
|---|---|
| 🎵 Audio | Canciones generadas por IA (FAL, Minimax Music v2) |
| 🎬 Video | Videos generados y procesados (Remotion, Shotstack) |
| 🖼️ Imágenes de perfil | Fotos y portadas de artistas |
| 👗 Imágenes de moda | Resultados del Fashion AI Studio |
| 🖼️ Diseños de merch | Designs generados por IA para merchandise |

---

## Resumen Ejecutivo

| Sistema | Rol Principal | Tecnología |
|---|---|---|
| **Neon PostgreSQL** | Datos estructurales: usuarios, pagos, suscripciones, campañas, agentes | Drizzle ORM + `@neondatabase/serverless` |
| **Firebase Firestore** | Datos en tiempo real: artistas IA, editor de video, sincronización live | Firebase Admin SDK |
| **Firebase Storage** | Archivos multimedia: audio, video, imágenes | Firebase Admin SDK |

---

## Conexiones de Producción

```
PostgreSQL:  postgresql://neondb_owner:***@ep-silent-silence-ad6swgqg-pooler.c-2.us-east-1.aws.neon.tech/neondb
Firestore:   project_id = artist-boost
Storage:     artist-boost.appspot.com
```
