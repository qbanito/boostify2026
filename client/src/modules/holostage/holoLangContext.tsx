// ─── HoloStage Language Context ──────────────────────────────────────────────
// EN (default) / ES bilingual support for all HoloStage modules.
// Default language is English. Toggle available in the sidebar.

import React, { createContext, useContext, useState } from 'react';

export type HoloLang = 'en' | 'es';

// ─── Full translation dictionary ─────────────────────────────────────────────
// Format: [EN, ES]
const DICT = {
  // ── Nav tabs ──────────────────────────────────────────────────────────────
  nav_character:   ['Character',   'Personaje'],
  nav_repertoire:  ['Repertoire',  'Repertorio'],
  nav_timeline:    ['Timeline',    'Timeline'],
  nav_lighting:    ['Lighting',    'Iluminación'],
  nav_mocap:       ['HoloSuit',    'HoloSuit'],
  nav_output:      ['Output',      'Output'],
  nav_live:        ['Live Show',   'En Vivo'],
  nav_export:      ['Export',      'Exportar'],
  nav_calibrate:   ['Calibrate',   'Calibrar'],
  nav_mocap_pro:   ['MoCap Pro',   'MoCap Pro'],
  nav_pipeline:    ['Pipeline',    'Pipeline'],

  // ── CharacterImporter ─────────────────────────────────────────────────────
  import_header:        ['Import Character',                        'Importar Character'],
  import_subtitle:      ['Import your character from Reallusion Character Creator (GLB/GLTF)', 'Importa tu character desde Reallusion Character Creator (GLB/GLTF)'],
  import_active:        ['Active',         'Activo'],
  import_processing:    ['Processing…',    'Procesando…'],
  import_drop_hint:     ['Drag your GLB file here or click to select', 'Arrastra tu archivo GLB aquí o haz click para seleccionar'],
  import_formats:       ['Formats: .glb · .gltf · max 200 MB',     'Formatos: .glb · .gltf · máx 200MB'],
  import_char_name:     ['Character Name',                          'Nombre del Character'],
  import_char_placeholder: ['My Holographic Artist',               'Mi Artista Holográfico'],
  import_url_label:     ['GLB File URL',                            'URL del archivo GLB'],
  import_load_url:      ['Load from URL',                           'Cargar desde URL'],
  import_demo_hint:     ['Test characters for MVP — no Reallusion required', 'Characters de prueba para MVP — no requieren Reallusion'],
  import_pipeline:      ['Recommended pipeline:',                   'Pipeline recomendado:'],
  import_step1:         ['1. Design in Reallusion Character Creator 4',       '1. Diseña en Reallusion Character Creator 4'],
  import_step2:         ['2. Export as .glb with skeleton and blendshapes',   '2. Exporta como .glb con skeleton y blendshapes'],
  import_step3:         ['3. Import here — Boostify HoloStage applies shaders automatically', '3. Importa aquí — Boostify HoloStage aplica shaders automáticamente'],
  import_err_file:      ['Error importing file',   'Error importando archivo'],
  import_err_url:       ['Error loading URL',       'Error cargando URL'],
  import_err_demo:      ['Error loading demo',      'Error cargando demo'],
  demo_astronaut_desc:  ['Rigged humanoid astronaut',  'Astronauta rigged humanoid'],
  demo_horse_desc:      ['Animated horse model',       'Modelo animado de caballo'],
  demo_neil_desc:       ['Rigged human character',     'Personaje humano rigged'],

  // ── CharacterPreview ──────────────────────────────────────────────────────
  preview_polygons:     ['Polygons',            'Polígonos'],
  preview_textures:     ['Textures',            'Texturas'],
  preview_analysis:     ['Optimization Analysis', 'Análisis de Optimización'],
  preview_lod:          ['Recommended LOD',     'LOD Recomendado'],
  preview_optimized:    ['Character optimized for holograms', 'Character optimizado para hologramas'],
  preview_rig_info:     ['Rig Information',     'Información del Rig'],
  preview_rig_type:     ['Rig Type',            'Tipo de Rig'],
  preview_idle_anim:    ['Idle Animation',      'Animación Idle'],
  preview_blendshapes:  ['Blendshapes',         'Blendshapes'],
  preview_animations:   ['Animations',          'Animaciones'],

  // ── CueEditor ─────────────────────────────────────────────────────────────
  cue_select_hint:   ['Select a cue from the timeline',              'Selecciona un cue del timeline'],
  cue_click_hint:    ['or click the timeline to create a new one',   'o haz click en la línea de tiempo para crear uno nuevo'],
  cue_active:        ['Active',    'Activo'],
  cue_inactive:      ['Inactive',  'Inactivo'],
  cue_locked:        ['Locked',    'Bloqueado'],
  cue_free:          ['Free',      'Libre'],
  cue_delete:        ['Delete',    'Eliminar'],
  cue_name_label:    ['Cue Name',  'Nombre del Cue'],
  cue_ts_label:      ['Timestamp (seconds)', 'Timestamp (segundos)'],
  cue_anim_label:    ['Animation', 'Animación'],
  cue_speed_label:   ['Speed',     'Velocidad'],
  cue_dmx_label:     ['DMX Scene', 'Escena DMX'],
  cue_no_scene:      ['No scene',  'Sin escena'],
  cue_effect_type:   ['Visual Effect Type', 'Tipo de Efecto Visual'],
  cue_intensity:     ['Intensity', 'Intensidad'],
  cue_fallback_note: ['The Fallback cue activates a predefined safety animation. Useful if HoloSuit tracking fails.', 'El cue de Fallback activa una animación de seguridad predefinida. Útil si falla el tracking de HoloSuit.'],
  dmx_blue_intro:    ['Blue Intro',    'Intro Azul'],
  dmx_orange_chorus: ['Orange Chorus', 'Chorus Naranja'],
  dmx_purple_verse:  ['Purple Verse',  'Verso Púrpura'],
  dmx_blackout:      ['Blackout',      'Blackout'],

  // ── DMXSceneBuilder ───────────────────────────────────────────────────────
  dmx_scene_label:   ['Scene',           'Escena'],
  dmx_scenes_footer: ['scenes · Mock Simulation', 'escenas · Simulación Mock'],
  dmx_add:           ['Add',             'Agregar'],
  dmx_channels:      ['DMX Channels',    'Canales DMX'],
  dmx_preview:       ['Preview scene',   'Preview escena'],

  // ── HologramOutputSettings ────────────────────────────────────────────────
  out_res_format:      ['Resolution & Format',    'Resolución y Formato'],
  out_width:           ['Width',                  'Ancho'],
  out_height:          ['Height',                 'Alto'],
  out_out_format:      ['Output Format',          'Formato de Salida'],
  out_background:      ['Background',             'Fondo'],
  out_holo_effect:     ['Holographic Effect',     'Efecto Holográfico'],
  out_effect_intensity:['Effect Intensity',       'Intensidad del Efecto'],
  out_color_grade:     ['Color Correction',       'Corrección de Color'],
  out_brightness:      ['Brightness',             'Brillo'],
  out_contrast:        ['Contrast',               'Contraste'],
  out_saturation:      ['Saturation',             'Saturación'],
  out_hue:             ['Hue Shift',              'Tono (Hue Shift)'],
  out_effects:         ['Effects',                'Efectos'],
  out_chrom_ab:        ['Chromatic Aberration',   'Aberración Cromática'],
  out_bloom_intensity: ['Bloom Intensity',        'Intensidad Bloom'],
  out_fullscreen_play: ['Fullscreen on Play',     'Fullscreen al Iniciar'],
  out_loop_show:       ['Loop Show',              'Repetir Show'],
  out_reset:           ['Reset to defaults',      'Restablecer configuración por defecto'],

  // ── LiveShowController ────────────────────────────────────────────────────
  live_status_live:     ['LIVE',       'EN VIVO'],
  live_status_paused:   ['PAUSED',     'PAUSADO'],
  live_status_stopped:  ['STOPPED',    'DETENIDO'],
  live_restore:         ['Restore',    'Restaurar'],
  live_blackout:        ['Blackout',   'Blackout'],
  live_turn_off_proj:   ['Turn off projector', 'Apagar proyector'],
  live_safety_anim:     ['Safety animation',   'Animación de seguridad'],
  live_next_cue:        ['Next:',      'Próximo:'],
  live_setlist:         ['Setlist',    'Repertorio'],
  live_active:          ['ACTIVE',     'ACTIVO'],

  // ── RepertoireBuilder ─────────────────────────────────────────────────────
  rep_title:           ['Title',          'Título'],
  rep_duration_s:      ['Duration (s)',   'Duración (s)'],
  rep_untitled:        ['Untitled',       'Sin título'],
  rep_new_song:        ['New Song',       'Nueva Canción'],
  rep_title_req:       ['Title *',        'Título *'],
  rep_artist:          ['Artist',         'Artista'],
  rep_key:             ['Key (e.g. Am)',  'Tonalidad (ej: Am)'],
  rep_duration_sec:    ['Duration (sec)', 'Duración (seg)'],
  rep_add:             ['Add to Setlist', 'Agregar al Repertorio'],
  rep_cancel:          ['Cancel',         'Cancelar'],
  rep_empty:           ['No songs in the setlist', 'Sin canciones en el repertorio'],
  rep_add_first:       ['+ Add first song', '+ Agregar primera canción'],

  // ── HoloSuitBridgePanel ─────────────────────────────────────────────────────
  rok_sim_subtitle:    ['Simulating body, hand, and face data', 'Simulando datos de cuerpo, manos y cara'],
  rok_stopped:         ['Stopped',           'Detenido'],
  rok_stop_sim:        ['Stop Simulation',   'Detener Simulación'],
  rok_start_sim:       ['Start Simulation',  'Iniciar Simulación'],
  rok_bone_rot:        ['Bone Rotations',    'Rotaciones de Huesos'],
  rok_velocity:        ['Velocity',          'Velocidad'],
  rok_confidence:      ['Confidence',        'Confianza'],
  rok_left:            ['← Left',            '← Izquierda'],
  rok_right:           ['Right →',           'Derecha →'],
  rok_start_hint:      ['Start simulation to view data', 'Inicia la simulación para ver datos'],
  rok_mvp2_title:      ['MVP2 — Real Connection', 'MVP2 — Conexión Real'],
  rok_mvp2_desc:       ['In MVP2 connect HoloSuit Studio in Custom Streaming mode to:', 'En MVP2 conectarás HoloSuit Studio en Custom Streaming mode a:'],
  rok_port:            ['Port',              'Puerto'],
  rok_sim_intensity:   ['Simulation Intensity', 'Intensidad de Simulación'],
  rok_sim_fps:         ['Simulation FPS',    'FPS de Simulación'],

  // ── ShowPackageExporter ───────────────────────────────────────────────────
  exp_header:          ['Export Show',          'Exportar Show'],
  exp_songs:           ['Songs',                'Canciones'],
  exp_duration:        ['Duration',             'Duración'],
  exp_metadata:        ['Show Metadata',        'Metadatos del Show'],
  exp_name:            ['Name',                 'Nombre'],
  exp_artist:          ['Artist',               'Artista'],
  exp_date:            ['Show Date',            'Fecha del Show'],
  exp_notes:           ['Notes',                'Notas'],
  exp_notes_ph:        ['Technical show notes…', 'Notas técnicas del show…'],
  exp_city:            ['City',                 'Ciudad'],
  exp_city_ph:         ['Show city',            'Ciudad del show'],
  exp_venue_ph:        ['Venue name',           'Nombre del venue'],
  exp_options:         ['Export Options',       'Opciones de Exportación'],
  exp_waveform:        ['Include waveform data', 'Incluir datos de forma de onda'],
  exp_waveform_desc:   ['(larger but faster to load)', '(más grande pero más rápido al cargar)'],
  exp_thumbnails:      ['Include embedded thumbnails', 'Incluir thumbnails embebidos'],
  exp_thumbnails_desc: ['(base64 — can be very large)', '(base64 — puede ser muy grande)'],
  exp_pretty_desc:     ['(more readable, slightly larger)', '(más legible, un poco más grande)'],
  exp_size:            ['Estimated size: ~{size}', 'Tamaño estimado: ~{size}'],
  exp_btn:             ['Export Show Package',  'Exportar Show Package'],
  exp_exported:        ['Exported:',            'Exportado:'],
  exp_import:          ['Import Show Package',  'Importar Show Package'],
  exp_importing:       ['Importing…',           'Importando…'],
  exp_select_file:     ['Select .holostage.json file', 'Seleccionar archivo .holostage.json'],
  exp_imported_ok:     ['Show imported successfully', 'Show importado correctamente'],
  exp_unknown_err:     ['Unknown error',        'Error desconocido'],
  exp_import_err:      ['Error importing file', 'Error al importar el archivo'],

  // ── AvatarSpacePositioner ─────────────────────────────────────────────────
  nav_vrspace:         ['VR Space',          'Espacio VR'],
  nav_animation:       ['Animation Studio',  'Estudio Animación'],
  nav_capture:         ['Capture',           'Captura'],
  nav_actors:          ['Actors',            'Actores'],
  nav_venue:           ['VenueOS',           'VenueOS'],

  // ── HoloStageGuide ────────────────────────────────────────────────────────
  guide_title:         ['Module Guide',                          'Guía de Módulos'],
  guide_subtitle:      ['{n} modules · 4 production phases · complete workflow for holographic shows',
                        '{n} módulos · 4 fases de producción · workflow completo para shows holográficos'],
  guide_filter_all:    ['All modules',                           'Todos los módulos'],
  guide_phase1:        ['Phase 1 — Venue & Artist',             'Fase 1 — Venue & Artista'],
  guide_phase2:        ['Phase 2 — Capture & Motion',           'Fase 2 — Captura & Movimiento'],
  guide_phase3:        ['Phase 3 — Show Content',               'Fase 3 — Contenido del Show'],
  guide_phase4:        ['Phase 4 — Output & Performance',       'Fase 4 — Output & Performance'],
  guide_key_actions:   ['Key actions',                          'Acciones principales'],
  guide_tips:          ['Tips',                                 'Tips'],
  guide_close:         ['Close guide',                          'Cerrar guía'],
  guide_modules_label: ['modules',                              'módulos'],

  // venue
  guide_venue_tagline: ['Intelligent venue scanner & configuration', 'Escáner y configuración inteligente del venue'],
  guide_venue_desc:    ['VenueOS is the starting point for every show. Enter stage dimensions, configure the hologram setup (surface type, projector, position), DMX profile, estimated budget, crew plan and show template. When done it auto-generates a full Technical Rider as an exportable text file.',
                        'VenueOS es el punto de partida de todo show. Ingresa las dimensiones del escenario, configura el setup del holograma (superficie, proyector, posición), perfil DMX, presupuesto, plan de crew y template del show. Al finalizar genera el Rider Técnico completo exportable.'],
  guide_venue_a1:      ['Enter venue name, city and event type', 'Ingresar nombre del venue, ciudad y tipo de evento'],
  guide_venue_a2:      ['Define stage dimensions (width, depth, ceiling height, audience distance)', 'Definir dimensiones del escenario (ancho, profundidad, altura de techo, distancia al público)'],
  guide_venue_a3:      ['Select holographic surface type (Holo Gauze, Pepper\'s Ghost, Transparent LED…)', 'Seleccionar el tipo de superficie holográfica (Holo Gauze, Pepper\'s Ghost, LED Transparente…)'],
  guide_venue_a4:      ['Auto-calculate required projector lumens with "Recalculate All"', 'Calcular los lúmenes necesarios con el botón "Recalculate All"'],
  guide_venue_a5:      ['Auto-configure DMX profile by production tier (Minimal / Standard / Premium)', 'Auto-configurar el perfil DMX según el tier de producción (Minimal / Standard / Premium)'],
  guide_venue_a6:      ['Check hologram feasibility score (0-100, grade A-F)', 'Ver el score de viabilidad del holograma (0-100 con grado A-F)'],
  guide_venue_a7:      ['Review itemised budget estimate', 'Revisar el presupuesto estimado línea por línea'],
  guide_venue_a8:      ['Generate Technical Rider and download as .txt', 'Generar el Technical Rider y descargarlo como .txt'],
  guide_venue_a9:      ['Export the complete Venue Master JSON to share with the technical team', 'Exportar el Venue Master JSON completo para compartir con el equipo técnico'],
  guide_venue_t1:      ['Always start with VenueOS before importing the character — venue setup defines output.', 'Empieza siempre por VenueOS antes de importar el personaje — el setup del venue define el output.'],
  guide_venue_t2:      ['A grade A or B score is required for a visible projection. Grade F blocks the show.', 'El score A o B es necesario para garantizar una proyección visible. Score F bloquea el show.'],
  guide_venue_t3:      ['Save the venue JSON to reuse it for future shows at the same location.', 'Guarda el JSON del venue para reutilizarlo en shows futuros en el mismo recinto.'],

  // character
  guide_char_tagline:  ['3D artist / holographic avatar importer', 'Importación del artista 3D / avatar holográfico'],
  guide_char_desc:     ['Import the artist\'s 3D model in GLB/VRM/FBX format. Preview available animations, adjust position/rotation/scale, and set a base transform so the character aligns with the stage.',
                        'Importa el modelo 3D del artista en formato GLB/VRM/FBX. Previsualiza animaciones disponibles, ajusta posición/rotación/escala y configura la transformación base para alinearlo con el escenario.'],
  guide_char_a1:       ['Import 3D model from local file (GLB, VRM, FBX)', 'Importar modelo 3D desde archivo local (GLB, VRM, FBX)'],
  guide_char_a2:       ['Preview animations available in the model', 'Previsualizar animaciones disponibles en el modelo'],
  guide_char_a3:       ['Adjust XYZ position, Y rotation and scale', 'Ajustar posición XYZ, rotación Y y escala del personaje'],
  guide_char_a4:       ['Save the base character transform in the Show Package', 'Guardar la transformación base del personaje en el Show Package'],
  guide_char_t1:       ['VRM models have better direct MoCap support.', 'Los modelos VRM tienen mejor soporte para MoCap directo.'],
  guide_char_t2:       ['Make sure scale is 1:1 life-size before Calibration.', 'Asegúrate de que la escala sea 1:1 life-size antes de Calibración.'],

  // actors
  guide_actors_tagline:['Show performers manager', 'Gestión de performers físicos del show'],
  guide_actors_desc:   ['Register the human performers taking part in the show. Each actor has an ID colour, body measurements (height, weight, arm span) and can be assigned to a specific capture flow (HoloSuit or phone).',
                        'Registra los performers humanos que participan en el show. Cada actor tiene un color de identificación, medidas corporales (altura, peso, envergadura) y puede asignarse a un flujo de captura (HoloSuit o teléfono).'],
  guide_actors_a1:     ['Add actors with name and identifier colour', 'Agregar actores con nombre y color identificador'],
  guide_actors_a2:     ['Enter body measurements for MoCap calibration', 'Ingresar medidas corporales para calibración del MoCap'],
  guide_actors_a3:     ['Remove actors no longer in the show', 'Eliminar actores que ya no participen en el show'],

  // capture
  guide_capture_tagline: ['Capture devices — phone, camera & face tracking', 'Dispositivos de captura — teléfono, cámara y face tracking'],
  guide_capture_desc:  ['Configure and test all capture devices: full-body phone capture via MediaPipe Pose (uses device camera), facial landmark detection, and hardware diagnostics. Shows an SVG body silhouette with active bones in real time.',
                        'Configura y prueba todos los dispositivos de captura: captura corporal con teléfono via MediaPipe Pose, face capture con landmarks faciales, y diagnóstico de hardware. Muestra un silhouette SVG del cuerpo con los huesos activos en tiempo real.'],
  guide_capture_a1:    ['Activate body capture from phone camera (MediaPipe)', 'Activar captura corporal desde la cámara del teléfono (MediaPipe)'],
  guide_capture_a2:    ['Start face capture for facial expression tracking', 'Iniciar face capture para rastrear expresiones faciales'],
  guide_capture_a3:    ['View detected bones on the body diagram', 'Ver el estado de los huesos detectados en el diagrama corporal'],
  guide_capture_a4:    ['Run device diagnostics and review error log', 'Ejecutar diagnóstico de dispositivos y revisar el log de errores'],
  guide_capture_t1:    ['Use a phone with a good rear camera for best pose results.', 'Usa un teléfono con buena cámara trasera para mejores resultados de pose.'],
  guide_capture_t2:    ['Good frontal lighting is critical for face capture.', 'Mantén buena iluminación frontal para face capture.'],

  // holosuit
  guide_holosuit_tagline:['HoloSuit / HoloGloves MoCap bridge', 'Bridge de captura HoloSuit / HoloGloves'],
  guide_holosuit_desc:   ['Connect and manage the Boostify HoloSuit motion capture suit. Configure the HoloSuit server IP, monitor sensor status in real time, and enable local simulation for development without physical hardware.',
                        'Conecta y gestiona el traje de captura HoloSuit de Boostify. Configura la IP del servidor HoloSuit, monitorea el estado de los sensores en tiempo real y activa la simulación local para desarrollo sin hardware físico.'],
  guide_holosuit_a1:     ['Configure HoloSuit Studio server IP and port', 'Configurar IP y puerto del servidor HoloSuit Studio'],
  guide_holosuit_a2:     ['Ping local server to verify connectivity', 'Hacer ping al servidor local para verificar conectividad'],
  guide_holosuit_a3:     ['Monitor sensor status for every suit element', 'Monitorear el estado de cada sensor del traje'],
  guide_holosuit_a4:     ['Enable simulation mode for tests without hardware', 'Activar modo simulación para pruebas sin hardware'],
  guide_holosuit_t1:     ['HoloSuit Studio must be running on the same local network.', 'HoloSuit Studio debe estar corriendo en la misma red local.'],
  guide_holosuit_t2:     ['Simulation generates synthetic walk motion to test the pipeline.', 'La simulación genera movimiento sintético de caminata para probar el pipeline.'],

  // motionsource
  guide_motion_tagline:['Advanced motion source configuration', 'Configuración avanzada de fuente de movimiento'],
  guide_motion_desc:   ['Advanced panel to configure the motion data source in detail: protocol (HoloSuit, OSC, BVH file), network parameters, bone mapping and smoothing filters to remove jitter.',
                        'Panel avanzado para configurar en detalle la fuente de datos de movimiento: protocolo (HoloSuit, OSC, BVH), parámetros de red, mapeo de bones y filtros de suavizado para eliminar jitter.'],
  guide_motion_a1:     ['Select motion input protocol', 'Seleccionar protocolo de entrada de movimiento'],
  guide_motion_a2:     ['Configure network address and ports', 'Configurar dirección de red y puertos'],
  guide_motion_a3:     ['Adjust smoothing parameters', 'Ajustar parámetros de suavizado (smoothing)'],
  guide_motion_a4:     ['Test connection and view incoming data in real time', 'Probar la conexión y ver datos entrantes en tiempo real'],

  // calibration
  guide_calib_tagline: ['Rig calibration & bone mapping', 'Calibración del rig y mapeo de huesos'],
  guide_calib_desc:    ['Calibrate the 3D character rig against the live performer\'s body. Define the bone mapping between the capture system and the 3D model skeleton (humanoid rig). Includes A-pose and T-pose reference for precise calibration.',
                        'Calibra el rig del personaje 3D contra el cuerpo real del performer. Define el mapeo de huesos entre el sistema de captura y el esqueleto del modelo 3D. Incluye A-pose y T-pose de referencia para calibración precisa.'],
  guide_calib_a1:      ['Load character rig to inspect bones', 'Cargar el rig del personaje para inspeccionar huesos'],
  guide_calib_a2:      ['Map capture bones to 3D model bones', 'Mapear huesos de captura a huesos del modelo 3D'],
  guide_calib_a3:      ['Run calibration in T-pose or A-pose', 'Ejecutar calibración en T-pose o A-pose'],
  guide_calib_a4:      ['Verify each bone offset and correct deviations', 'Verificar el offset de cada bone y corregir desviaciones'],
  guide_calib_t1:      ['Have the performer stand still in T-pose for 3 seconds before calibrating.', 'Haz la calibración con el performer en T-pose quieto durante 3 segundos.'],

  // repertoire
  guide_rep_tagline:   ['Show repertoire — song setlist builder', 'Construcción del repertorio — lista de canciones del show'],
  guide_rep_desc:      ['Create and order the show setlist. Each song has a title, artist, duration, BPM, and can carry waveform data and sections (Intro, Verse, Chorus, Bridge, Outro) that are later visualised in the Timeline.',
                        'Crea y ordena el setlist del show. Cada canción tiene título, artista, duración, BPM, y puede llevar datos de waveform y secciones (Intro, Verso, Coro, Puente, Outro) que se visualizan en el Timeline.'],
  guide_rep_a1:        ['Add songs to setlist (name, artist, duration, BPM)', 'Agregar canciones al setlist (nombre, artista, duración, BPM)'],
  guide_rep_a2:        ['Reorder songs with drag or position buttons', 'Reordenar canciones arrastrando o con los botones de posición'],
  guide_rep_a3:        ['Define musical sections per song (Intro, Verse, Chorus…)', 'Definir secciones musicales por canción (Intro, Verso, Coro…)'],
  guide_rep_a4:        ['Attach waveform data for timeline visualisation', 'Adjuntar datos de waveform para visualización en el timeline'],
  guide_rep_a5:        ['Delete or edit songs in the repertoire', 'Eliminar o editar canciones del repertorio'],
  guide_rep_t1:        ['Set correct BPMs so the timeline shows an exact bar grid.', 'Define los BPMs correctos para que el timeline muestre la cuadrícula de compases exacta.'],
  guide_rep_t2:        ['Colour-coded sections on the waveform help locate cues visually.', 'Las secciones de color en el waveform ayudan a ubicar los cues visualmente.'],

  // timeline
  guide_tl_tagline:    ['Multi-track DAW cue editor per song', 'Editor DAW multi-track de cues por canción'],
  guide_tl_desc:       ['The timeline is the heart of the show. Each song appears as a block with 7 cue tracks: Animation, DMX, Camera, Effect, Transition, Blackout and Fallback. Musical sections are overlaid in colour on the waveform. Click a track to create a cue, drag it to move it, select it to edit in the CueEditor.',
                        'El timeline es el corazón del show. Cada canción tiene 7 pistas de cues: Animation, DMX, Camera, Effect, Transition, Blackout y Fallback. Las secciones musicales aparecen en color sobre el waveform. Click en una pista para crear un cue, arrástralo para moverlo y selecciónalo para editar en el CueEditor.'],
  guide_tl_a1:         ['Click a track row to create a cue at that time position', 'Hacer click en una pista (fila) para crear un cue en esa posición temporal'],
  guide_tl_a2:         ['Drag a cue to reposition it within the song', 'Arrastrar un cue para reposicionarlo dentro de la canción'],
  guide_tl_a3:         ['Select a cue to open it in the CueEditor on the right', 'Seleccionar un cue para abrirlo en el CueEditor de la derecha'],
  guide_tl_a4:         ['Collapse/expand a song by clicking its header', 'Colapsar/expandir una canción haciendo click en su encabezado'],
  guide_tl_a5:         ['Use horizontal zoom for detailed section views', 'Usar el zoom horizontal para ver secciones detalladas'],
  guide_tl_t1:         ['7 cue types: Animation, DMX, Camera, Effect, Transition, Blackout, Fallback.', '7 tipos de cues: Animation, DMX, Camera, Effect, Transition, Blackout, Fallback.'],
  guide_tl_t2:         ['The Fallback cue is the backup animation if live capture fails.', 'El cue de Fallback es la animación de respaldo si falla la captura en vivo.'],
  guide_tl_t3:         ['Colour sections on the waveform are read-only — edit them in Repertoire.', 'Las secciones de color en el waveform son de solo lectura — se editan en Repertoire.'],

  // animation
  guide_anim_tagline:  ['Per-bone animation curve editor', 'Editor de curvas de animación por bone'],
  guide_anim_desc:     ['Animation studio with f-curve view. Edit keyframes per character bone in the context of a specific song. Useful for procedural animations and micro-movement adjustments for the holographic artist.',
                        'Studio de animación con vista de curvas (f-curves). Edita keyframes por bone del personaje en el contexto de una canción específica. Útil para crear animaciones procedurales y ajustar micro-movimientos del artista holográfico.'],
  guide_anim_a1:       ['Select a show song to view its animations', 'Seleccionar una canción del show para ver sus animaciones'],
  guide_anim_a2:       ['Navigate between character bones (head, arms, hands, hip…)', 'Navegar entre bones del personaje (cabeza, brazos, manos, cadera…)'],
  guide_anim_a3:       ['Add, move and delete keyframes on the curve', 'Agregar, mover y eliminar keyframes en la curva'],
  guide_anim_a4:       ['Preview the animation on the synchronised playhead', 'Previsualizar la animación en el playhead sincronizado'],
  guide_anim_t1:       ['Key bones (hip, spine) have the most visual impact.', 'Los huesos críticos (cadera, columna) tienen más impacto visual.'],

  // dmx
  guide_dmx_tagline:   ['DMX lighting scene builder for the show', 'Constructor de escenas DMX para el show'],
  guide_dmx_desc:      ['Design show lighting scenes in DMX format. Each scene sets channel values for all fixtures registered in VenueOS. Scenes are assigned to DMX cues in the Timeline to fire at the exact moment during the show.',
                        'Diseña las escenas de iluminación en formato DMX. Cada escena define los valores de canal para todos los fixtures registrados en VenueOS. Las escenas se asignan a cues DMX en el Timeline para dispararlas en el momento exacto durante el show.'],
  guide_dmx_a1:        ['Create DMX scenes with descriptive names', 'Crear escenas DMX con nombre descriptivo'],
  guide_dmx_a2:        ['Configure channel values per fixture', 'Configurar valores de canal por fixture'],
  guide_dmx_a3:        ['Preview the scene in simulation', 'Previsualizar la escena en simulación'],
  guide_dmx_a4:        ['Assign scenes to DMX cues from the Timeline', 'Asignar escenas a cues DMX desde el Timeline'],
  guide_dmx_t1:        ['Name scenes by musical moment: "Chorus_Burst", "Verse_Warm", "Final_Blackout".', 'Nombra las escenas por momento musical: "Coro_Burst", "Verso_Cálido", "Blackout_Final".'],

  // output
  guide_output_tagline:['Hologram output configuration', 'Configuración del output del holograma'],
  guide_output_desc:   ['Adjust all visual output parameters for the hologram: resolution, brightness, contrast, chroma key, display mode (window/fullscreen/second screen) and canvas position. Connects directly with VenueOS data to suggest optimal values.',
                        'Ajusta todos los parámetros de salida visual del holograma: resolución, brillo, contraste, chroma key, modo de display (window/fullscreen/second screen) y posición del canvas. Se conecta con VenueOS para sugerir los valores óptimos.'],
  guide_output_a1:     ['Select output monitor (main, secondary or projector)', 'Seleccionar monitor de output (pantalla principal, secundaria o proyector)'],
  guide_output_a2:     ['Adjust resolution and frame rate', 'Ajustar resolución y frame rate'],
  guide_output_a3:     ['Configure chroma key and transparency', 'Configurar chroma key y transparencia'],
  guide_output_a4:     ['Enable fullscreen mode for the live show', 'Activar modo fullscreen para el show en vivo'],

  // vrspace
  guide_vr_tagline:    ['Spatial positioning of the avatar on stage', 'Posicionamiento espacial del avatar en el escenario'],
  guide_vr_desc:       ['Define the exact position of the holographic avatar within the virtual stage space. Control XYZ, Y rotation and scale. Essential to align the hologram with the physical projection surface and venue reference points.',
                        'Define la posición exacta del avatar holográfico dentro del espacio virtual del escenario. Controla XYZ, rotación en Y y escala. Esencial para alinear el holograma con la superficie de proyección física y los puntos de referencia del venue.'],
  guide_vr_a1:         ['Adjust X (lateral), Y (height) and Z (depth) position', 'Ajustar posición X (lateral), Y (altura) y Z (profundidad)'],
  guide_vr_a2:         ['Rotate avatar on Y axis to face the audience', 'Rotar el avatar en el eje Y para orientarlo al público'],
  guide_vr_a3:         ['Adjust scale to match the real performer\'s size', 'Ajustar la escala para coincidir con el tamaño real del performer'],

  // workflow
  guide_wf_tagline:    ['Full show pipeline health check', 'Chequeo del pipeline completo del show'],
  guide_wf_desc:       ['Status view of the entire production pipeline: character loaded, songs in repertoire, active MoCap config, HoloSuit connection state. Shows warnings if any critical component is not ready for the show.',
                        'Vista de estado del pipeline de producción: personaje cargado, songs en el repertorio, configuración de MoCap activa, estado de la conexión HoloSuit. Muestra warnings si algún componente crítico no está listo para el show.'],
  guide_wf_a1:         ['Review the status of each pipeline component', 'Revisar el estado de cada componente del pipeline'],
  guide_wf_a2:         ['Identify warnings before rehearsal or live show', 'Identificar warnings antes del ensayo o show en vivo'],
  guide_wf_a3:         ['Navigate quickly to modules with issues', 'Navegar rápidamente a los módulos con problemas'],
  guide_wf_t1:         ['Check the Pipeline right before Live Show to confirm everything is green.', 'Revisa el Pipeline justo antes del Live Show para confirmar que todo está verde.'],

  // live
  guide_live_tagline:  ['Real-time show controller', 'Controlador del show en tiempo real'],
  guide_live_desc:     ['The master control panel during the live show. Displays the playback timeline with the active song, playhead position, and all transport controls (Play, Pause, Stop, Skip). Manually trigger cues, activate emergency Blackout, and monitor live capture status.',
                        'El panel de control maestro durante el show en vivo. Muestra el timeline en reproducción con la canción activa, posición del playhead, y todos los controles de transporte (Play, Pause, Stop, Skip). Dispara cues manualmente, activa Blackout de emergencia y monitorea la captura en vivo.'],
  guide_live_a1:       ['Play / Pause / Stop the full show', 'Play / Pause / Stop del show completo'],
  guide_live_a2:       ['Skip to next song or go back', 'Saltar a la siguiente canción o a la anterior'],
  guide_live_a3:       ['Trigger emergency Blackout with a single click', 'Activar Blackout de emergencia con un solo click'],
  guide_live_a4:       ['Manually override-trigger cues during the show', 'Disparar cues manualmente override durante el show'],
  guide_live_a5:       ['Monitor time position within the active song', 'Monitorear la posición en segundos dentro de la canción activa'],
  guide_live_t1:       ['Blackout cuts all output and DMX instantly.', 'El botón Blackout corta todo output y DMX instantáneamente.'],
  guide_live_t2:       ['Use the Fallback cue to keep a reserve animation if MoCap loses signal.', 'Usa el Fallback cue para mantener una animación de reserva si el MoCap pierde señal.'],

  // export
  guide_export_tagline:['Complete show package export', 'Exportación del paquete completo del show'],
  guide_export_desc:   ['Export the complete Show Package as JSON. The file contains the character, repertoire, all timeline cues, DMX scenes, output configuration, VenueOS data and show metadata. Ready to import on another device or share with the technical team.',
                        'Exporta el Show Package completo en formato JSON. El archivo contiene el personaje, repertorio, todos los cues del timeline, escenas DMX, configuración de output, datos de VenueOS y metadatos del show. Listo para importar en otro dispositivo o compartir con el equipo técnico.'],
  guide_export_a1:     ['Review show summary before exporting', 'Revisar el resumen del show antes de exportar'],
  guide_export_a2:     ['Export Show Package as .json file', 'Exportar el Show Package como archivo .json'],
  guide_export_a3:     ['Copy JSON to clipboard', 'Copiar el JSON al portapapeles'],
  guide_export_a4:     ['Import a previously saved Show Package', 'Importar un Show Package guardado anteriormente'],
  guide_export_t1:     ['Save a backup of the Show Package before every rehearsal and before the show.', 'Guarda un backup del Show Package antes de cada ensayo y antes del show.'],
  vr_header:           ['VR Space',          'Espacio VR'],
  vr_pos:              ['Position',          'Posición'],
  vr_rot:              ['Rotation',          'Rotación'],
  vr_scale:            ['Scale',             'Escala'],
  vr_floor_snap:       ['Snap to Floor',     'Anclar al Suelo'],
  vr_reset:            ['Reset',             'Reiniciar'],
  vr_grid:             ['Grid',              'Grilla'],
  vr_tpose:            ['T-Pose Ref',        'Ref T-Pose'],
  vr_orbit_hint:       ['Drag to orbit · Scroll to zoom · Right-drag to pan', 'Arrastra para orbitar · Scroll para zoom · Clic derecho para desplazar'],
  vr_floor_anchored:   ['Floor Anchored',    'Anclado al Suelo'],
  vr_ref_heights:      ['Reference Heights', 'Alturas de Referencia'],
  vr_ref_adult:        ['Adult height',      'Altura adulto'],
  vr_ref_stage:        ['Stage prop avg',    'Prop. escenario'],
  vr_ref_floor:        ['Floor level',       'Nivel del suelo'],
  vr_dblclick_tip:     ['Double-click viewport to reset camera', 'Doble-clic para reiniciar cámara'],

  // ── SongTimelineEditor ────────────────────────────────────────────────────
  tl_header:           ['Cue Timeline',   'Timeline de Cues'],
  tl_hint:             ['{n} cues · Click the timeline to add', '{n} cues · Click en la línea de tiempo para agregar'],
  tl_add_songs_first:  ['Add songs to the setlist first', 'Agrega canciones al repertorio primero'],
  tl_untitled:         ['Untitled',        'Sin título'],
  tl_active:           ['ACTIVE',          'ACTIVO'],
  tl_add_cue:          ['Add Cue',         'Agregar Cue'],
  tl_cancel:           ['Cancel',          'Cancelar'],

  // ── CharacterCalibration ──────────────────────────────────────────────────
  calib_header:        ['Character Calibration', 'Calibración del Personaje'],
  calib_reset:         ['Reset',                 'Restablecer'],
  calib_apply:         ['Apply',                 'Aplicar'],
  calib_applied:       ['Applied!',              '¡Aplicado!'],
  calib_tab_scale:     ['Scale & Size',          'Escala y Tamaño'],
  calib_tab_offsets:   ['Bone Offsets',          'Offsets de Huesos'],
  calib_tab_motion:    ['Motion',                'Movimiento'],
  calib_tab_tpose:     ['T-Pose',                'T-Pose'],
  calib_perf_hint:     ['Calibrate these values to match the performer wearing the HoloSuit HoloSuit. Have the performer stand in T-Pose before applying calibration.',
                        'Calibra estos valores para el performer con el HoloSuit HoloSuit. El performer debe estar en T-Pose antes de aplicar.'],
  calib_scale_multi:   ['Scale Multiplier',      'Multiplicador de Escala'],
  calib_height_off:    ['Height Offset',         'Offset de Altura'],
  calib_arm_len:       ['Arm Length',            'Longitud de Brazo'],
  calib_leg_len:       ['Leg Length',            'Longitud de Piernas'],
  calib_hip_off:       ['Hip Offset',            'Offset de Cadera'],
  calib_neck_off:      ['Neck Offset',           'Offset de Cuello'],
  calib_foot_off:      ['Foot Offset',           'Offset de Pie'],
  calib_spine_off:     ['Spine Offset',          'Offset de Columna'],
  calib_smoothing:     ['Smoothing',             'Suavizado'],
  calib_latency:       ['Latency Compensation',  'Compensación de Latencia'],
  calib_root_motion:   ['Root Motion',           'Root Motion'],
  calib_root_desc:     ['Allow character to move across stage', 'Permite al personaje moverse por el escenario'],
  calib_foot_lock:     ['Foot Locking',          'Bloqueo de Pies'],
  calib_foot_desc:     ['Lock feet to ground to prevent sliding', 'Bloquea los pies al suelo para evitar deslizamiento'],
  calib_tpose_guide:   ['T-Pose Reference Guide','Guía de Referencia T-Pose'],
  calib_tpose_btn:     ['Capture T-Pose Reference', 'Capturar Referencia T-Pose'],
  calib_tpose_warn:    ['T-Pose capture requires HoloSuit Studio connected and streaming. Enable the HoloSuit Bridge first.',
                        'La captura T-Pose requiere HoloSuit Studio conectado y en streaming. Activa el Bridge de HoloSuit primero.'],
  calib_bones_mapped:  ['{n} BONES MAPPED', '{n} HUESOS MAPEADOS'],

  // ── WorkflowPipelinePanel ─────────────────────────────────────────────────
  pipe_header:         ['WORKFLOW PIPELINE',  'PIPELINE DE TRABAJO'],
  pipe_no_char:        ['No character loaded','Sin personaje cargado'],
  pipe_no_songs:       ['No songs',           'Sin canciones'],
  pipe_run:            ['RUN PIPELINE',       'EJECUTAR PIPELINE'],
  pipe_stop:           ['STOP',               'DETENER'],
  pipe_tab_pipeline:   ['Pipeline',           'Pipeline'],
  pipe_tab_mapping:    ['Mapping',            'Mapeo'],
  pipe_tab_recordings: ['Recordings',         'Grabaciones'],

  // ── AnimationStudio ───────────────────────────────────────────────────────
  anim_tab_import:     ['FBX Import',     'Importar FBX'],
  anim_tab_record:     ['Record',         'Grabar'],
  anim_tab_cleanup:    ['Curve Cleanup',  'Limpieza de Curvas'],
  anim_tab_timeline:   ['Timeline',       'Timeline'],
  anim_takes:          ['{n} take',       '{n} toma'],
  anim_takes_plural:   ['{n} takes',      '{n} tomas'],
  anim_active_song:    ['Active song:',   'Canción activa:'],
  anim_no_song:        ['No song selected','Sin canción seleccionada'],

  // ── CharacterImporter v2 — tabs ───────────────────────────────────────────
  import_tab_upload:   ['Upload',          'Subir Archivo'],
  import_tab_url:      ['URL / Platform',  'URL / Plataforma'],
  import_tab_cc4:      ['CC4 Guide',       'Guía CC4'],
  import_tab_demo:     ['Demo Library',    'Librería Demo'],
  import_tab_recent:   ['Recent',          'Recientes'],

  // ── CharacterImporter v2 — upload ─────────────────────────────────────────
  import_v2_subtitle:  ['Import a 3D character in any supported format', 'Importa un personaje 3D en cualquier formato soportado'],
  import_native_badge: ['Native',          'Nativo'],
  import_convert_badge:['Needs conversion','Necesita conversión'],
  import_drop_hint2:   ['Drag your character file here, or click to browse', 'Arrastra tu archivo de personaje aquí, o haz click para explorar'],
  import_formats2:     ['Native: GLB · GLTF · VRM   ·   Guided: FBX · OBJ · DAE · USDZ · ZIP (max 200 MB)', 'Nativo: GLB · GLTF · VRM   ·   Guiado: FBX · OBJ · DAE · USDZ · ZIP (máx 200 MB)'],
  import_vrm_hint:     ['VRM detected — VTuber humanoid avatar. Spring bones and blendshapes active.', 'VRM detectado — avatar humanoide VTuber. Spring bones y blendshapes activos.'],
  import_convert_title:['Conversion required',    'Conversión requerida'],
  import_convert_body: ['This format cannot be loaded directly in the browser. Convert it to GLB first:', 'Este formato no puede cargarse directamente en el navegador. Conviértelo a GLB primero:'],
  import_converter_btn:['Open online converter',  'Abrir conversor online'],
  import_warnings_title:['Warnings',              'Advertencias'],

  // ── CharacterImporter v2 — URL / Platform tab ─────────────────────────────
  import_url_hint:     ['Paste any GLB/VRM URL, ReadyPlayerMe avatar URL, or type rpm:{id}', 'Pega una URL de GLB/VRM, URL de ReadyPlayerMe, o escribe rpm:{id}'],
  import_rpm_label:    ['ReadyPlayerMe Avatar ID', 'ID de Avatar ReadyPlayerMe'],
  import_rpm_hint:     ['Type rpm:{avatarId} or paste the full RPM URL', 'Escribe rpm:{avatarId} o pega la URL completa de RPM'],
  import_rpm_load:     ['Load RPM Avatar',          'Cargar Avatar RPM'],
  import_vroid_label:  ['VRoid Hub Avatar URL',     'URL de Avatar VRoid Hub'],
  import_vroid_hint:   ['Paste the VRoid Hub share URL', 'Pega la URL de compartir de VRoid Hub'],
  import_mixamo_label: ['Mixamo Character URL',     'URL de Character Mixamo'],
  import_url_name:     ['Character Name (optional)','Nombre del Personaje (opcional)'],
  import_load_btn:     ['Load Character',            'Cargar Personaje'],

  // ── CharacterImporter v2 — CC4 guide tab ──────────────────────────────────
  import_cc4_title:    ['Reallusion Character Creator 4 — Export Guide', 'Reallusion Character Creator 4 — Guía de Exportación'],
  import_cc4_step1:    ['Design your artist in CC4 (Standard or Headshot)', 'Diseña tu artista en CC4 (Standard o Headshot)'],
  import_cc4_step2:    ['Go to File → Export → FBX / Alembic / iAvatar', 'Ve a Archivo → Exportar → FBX / Alembic / iAvatar'],
  import_cc4_step3:    ['For direct GLB: use the iClone 8 "Export to GLB" plugin', 'Para GLB directo: usa el plugin de iClone 8 "Export to GLB"'],
  import_cc4_step4:    ['Enable: Embed Textures · Export Skeleton · Export Blendshapes', 'Activa: Embed Textures · Export Skeleton · Export Blendshapes'],
  import_cc4_step5:    ['Import the .glb here — shaders are applied automatically', 'Importa el .glb aquí — los shaders se aplican automáticamente'],
  import_cc4_fbx_note: ['If you only have FBX: open in Blender → File → Export → glTF 2.0 (.glb)', 'Si solo tienes FBX: ábrelo en Blender → Archivo → Exportar → glTF 2.0 (.glb)'],
  import_cc4_tools:    ['Recommended Tools',        'Herramientas Recomendadas'],
  import_cc4_blender:  ['Blender (free) — FBX/OBJ/DAE → GLB converter', 'Blender (gratis) — conversor FBX/OBJ/DAE → GLB'],
  import_cc4_gltfreport:['gltf.report — instant online GLB converter', 'gltf.report — conversor online instantáneo de GLB'],

  // ── CharacterImporter v2 — demo library ───────────────────────────────────
  import_demo_title:   ['Demo Library',              'Librería de Demos'],
  import_demo_desc:    ['Test characters ready to use — no Reallusion required', 'Personajes de prueba listos para usar — no requieren Reallusion'],
  import_demo_load:    ['Load',                       'Cargar'],
  import_demo_loading: ['Loading…',                   'Cargando…'],
  demo_cesiumman_desc: ['Walking humanoid · rigged · 7.2K polys', 'Humanoide caminando · rigged · 7.2K polys'],
  demo_brainstem_desc: ['Mechanical robot · rigged · 12K polys',  'Robot mecánico · rigged · 12K polys'],
  demo_riggedfigure_desc: ['Minimalist humanoid rig · 4K polys',  'Rig humanoide minimalista · 4K polys'],
  demo_fox_desc:       ['Animated fox · walk + run · 5K polys',   'Zorro animado · walk + run · 5K polys'],

  // ── CharacterImporter v2 — recent tab ────────────────────────────────────
  import_recent_title: ['Recently Imported',         'Importados Recientemente'],
  import_recent_empty: ['No recent imports yet',     'Sin importaciones recientes'],
  import_recent_note:  ['Blob URLs are not persistent. Re-import the file to use a local character again.', 'Las URLs blob no son persistentes. Re-importa el archivo para usar un personaje local de nuevo.'],
  import_recent_reuse: ['Load from URL',             'Cargar desde URL'],
  import_remove:       ['Remove',                    'Eliminar'],
  import_current:      ['Currently active',          'Actualmente activo'],

  // ── CharacterImporter v2 — status ────────────────────────────────────────
  import_active_char:  ['Active Character',          'Personaje Activo'],
  import_no_char:      ['No character loaded',       'Sin personaje cargado'],
  import_change:       ['Change',                    'Cambiar'],
  import_format_label: ['Format',                    'Formato'],
  import_size_label:   ['File Size',                 'Tamaño'],
  import_source_label: ['Source',                    'Fuente'],
  import_rig_label:    ['Rig Type',                  'Tipo de Rig'],
} as const satisfies Record<string, readonly [string, string]>;

export type HoloDictKey = keyof typeof DICT;

// ─── Context ─────────────────────────────────────────────────────────────────

interface HoloLangCtx {
  lang: HoloLang;
  setLang: (lang: HoloLang) => void;
  t: (key: HoloDictKey, vars?: Record<string, string | number>) => string;
}

const HoloLangContext = createContext<HoloLangCtx>({
  lang: 'en',
  setLang: () => {},
  t: (key) => DICT[key][0],
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function HoloLangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<HoloLang>('en');

  const t = (key: HoloDictKey, vars?: Record<string, string | number>): string => {
    const idx = lang === 'en' ? 0 : 1;
    let str = DICT[key][idx] as string;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  };

  return (
    <HoloLangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </HoloLangContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useHoloLang() {
  return useContext(HoloLangContext);
}
