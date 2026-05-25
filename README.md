
# ProjectGrapher AI

ProjectGrapher AI es una herramienta local de inteligencia arquitectónica para desarrolladores y agentes de programación.

Su objetivo no es solo convertir un repositorio en texto. Su objetivo es preparar contexto suficiente para que una persona o un agente de IA no tenga que gastar miles de tokens entendiendo el proyecto desde cero.

Antes de pedirle algo a un modelo, ProjectGrapher intenta responder primero:

- cuántos archivos hay,
- cómo se relacionan entre sí,
- cuáles son los nodos importantes,
- qué archivos conviene revisar primero,
- y qué artefacto corto vale la pena exportar para otra sesión o para otro agente.

Con eso ayuda a una persona o a un agente de IA a entender:

- qué hace el proyecto,
- cómo se conectan los archivos entre sí,
- qué módulos son críticos,
- qué archivos tienen más probabilidad de cambiar para una tarea concreta,
- y cómo pasar ese contexto a otro agente con menos tokens y menos adivinanzas.

## Qué Hace

ProjectGrapher analiza una base de código local, construye un grafo de dependencias y lo convierte en contexto arquitectónico utilizable antes de llamar a una IA.

No intenta reemplazar al agente.
Intenta prepararle el terreno para que no desperdicie tokens explorando el repo a ciegas.

Capacidades principales:

- Grafo interactivo de archivos y dependencias
- Detección de hotspots basada en importancia arquitectónica
- Snapshots del proyecto optimizados para contexto de LLM
- Vistas sistémicas y resúmenes ejecutivos
- Task packs para prompts como `ajusta el perfil del usuario y dime qué archivos modificar`
- Error-to-Context Packs a partir de errores pegados desde tu proyecto local cargado
- Semantic Search para buscar por intención y no solo por nombre de archivo
- Predictive Impact Analysis para anticipar qué módulos podrían verse afectados al tocar un archivo
- Smart Diff Context entre corridas locales del mismo proyecto
- Project Memory para guardar notas persistentes por proyecto y por archivo
- Auditorías IA opcionales con proveedores como Groq, OpenAI, Gemini, DeepSeek, OpenRouter, Mistral u Ollama
- Documentos de handoff generados por IA y guardados en `contexto/<nombre-del-proyecto>/`

## Por Qué Existe

Los proyectos grandes suelen romper los flujos con IA por una razón muy simple: el agente no tiene suficiente contexto, o recibe demasiado contexto crudo en un formato poco útil.

ProjectGrapher nace para reducir ese problema.

En lugar de mandar todo el repositorio ciegamente a un LLM, intenta construir contexto por capas:

1. Contexto estructural
2. Contexto arquitectónico
3. Contexto orientado a tarea
4. Interpretación enriquecida con IA

Eso facilita que otro agente pueda responder preguntas como:

- ¿Dónde vive la funcionalidad de perfil?
- ¿De qué estado o contexto depende?
- ¿Qué capa de API está conectada?
- ¿Qué partes son riesgosas de modificar?

La idea de fondo es simple:

- menos lectura cruda del repo,
- más estructura útil antes del prompt,
- menos exploración innecesaria,
- y mejor targeting de archivos antes de editar.

## Cómo Compite

Sí existen herramientas reales en este espacio, y ProjectGrapher comparte terreno con varias de ellas.

### Frente a Repomix

Repomix es fuerte empaquetando un repositorio completo en formatos amigables para IA.

ProjectGrapher se diferencia porque pone más foco en:

- relaciones del grafo,
- arquitectura visual,
- ranking de hotspots,
- selección de archivos por tarea,
- y documentos de handoff para agentes.

Si Repomix es muy bueno `empaquetando contexto`, ProjectGrapher busca ser mejor `explicando qué importa dentro de ese contexto`.

### Frente a Gitingest

Gitingest es fuerte generando digests rápidos y amigables para prompts.

ProjectGrapher va más allá en:

- mapeo de dependencias,
- hotspots arquitectónicos,
- exploración visual del grafo,
- resúmenes a nivel sistema,
- y task packs guiados.

Si Gitingest es un `digest limpio del repo`, ProjectGrapher apunta a ser una `capa de razonamiento sobre el repo`.

### Frente a Aider Repo Map

El repo map de Aider es muy fuerte mostrando símbolos y archivos relevantes para un agente que ya está editando código.

ProjectGrapher no intenta reemplazar ese loop de edición.
Su ángulo más fuerte está en:

- entendimiento visual del grafo,
- lectura arquitectónica entre múltiples archivos,
- artefactos exportables de contexto,
- y handoffs legibles tanto para humanos como para IA.

Si Aider Repo Map está optimizado para `editar con contexto`, ProjectGrapher está optimizado para `entender la arquitectura antes de editar`.

## Dónde Puede Ser Mejor

ProjectGrapher es más valioso cuando el problema no es solo “leer este repo”, sino:

- entender rápido la estructura,
- identificar módulos centrales,
- reducir desperdicio de tokens,
- preparar contexto para otro agente,
- y decidir qué se debe tocar antes de cambiar código.

Su mayor diferenciador es la combinación de:

- visualización del grafo,
- exports arquitectónicos deterministas,
- task packs orientados a tarea,
- y documentos de handoff generados por IA.

## Salidas Principales

ProjectGrapher puede generar archivos como:

- `*_snapshot.md`
- `*_executive_view.md`
- `*_system_view.md`
- `*_hotspots.md`
- `*_task_pack.md`
- `*_brief.md`
- `*_project_summary.json`
- `*_graph_guide.md`
- `*_architecture_map.json`
- `*_vision_ai.md`
- `*_architecture_narrative_ai.md`
- `*_refactor_priorities_ai.md`
- `*_agent_handoff_ai.md`

Los archivos enriquecidos con IA se guardan automáticamente en la carpeta local `contexto/<nombre-del-proyecto>/` una vez que se genera una auditoría IA.

## Capacidades Nuevas

- `Semantic Search`: encuentra archivos por intención como `dónde vive autenticación` o `qué toca pagos`.
- `Predictive Impact Analysis`: desde un nodo seleccionado, estima dependencias, consumidores directos e impacto secundario.
- `Smart Diff Context`: compara la corrida actual contra la corrida local anterior del mismo proyecto para detectar archivos y relaciones nuevas o removidas.
- `Project Memory`: guarda notas locales persistentes del proyecto y notas por archivo para futuras sesiones.
- `Centro de Exportación` reorganizado por intención: overview, task pack, error pack, documentos IA y exportes base.

## Modo Determinístico vs Modo IA

ProjectGrapher separa dos capas de trabajo:

- `Determinístico`: análisis del árbol, dependencias, hotspots, graph guide, project summary, brief, system view, semantic search, impact analysis, smart diff, project memory, task packs y error packs. Esta parte funciona sin proveedores de IA.
- `IA opcional`: auditoría arquitectónica, visión interpretada por modelo, narrativa enriquecida, prioridades sugeridas por IA y handoff asistido.

El `Error-to-Context Pack` pertenece primero al modo determinístico: parte de un stack trace o mensaje de error pegado desde un proyecto local ya cargado, ubica el origen probable en el grafo y arma un mini contexto antes de escalar a IA.

Si no hay llave configurada ni proveedor activo, la aplicación debe seguir entregando valor en el modo determinístico y reservar el enriquecimiento con IA solo cuando realmente pueda ejecutarse bien.

## Stack Tecnológico

- React 19
- Vite
- TypeScript
- D3
- Zustand
- Dexie
- Tailwind CSS
- Backend en Python con FastAPI
- Proveedores IA opcionales a través de proxy local

## Ejecución Local

Frontend:

```bash
npm install
npm run dev
```

Backend:

```bash
npm run server
```

El frontend corre en `http://localhost:3000`.
El frontend redirige `/api` al backend de Python en `http://localhost:8080`.
Si necesitas otro puerto, puedes definir `PORT` para el backend y `VITE_API_URL` para el frontend.

## Notas Operativas

- El backend principal activo es `main.py` con FastAPI.
- `server/index.js` queda como proxy legacy y puede levantarse con `npm run server:legacy` si necesitas compararlo o mantener compatibilidad temporal.
- Desde Configuración puedes activar o desactivar el `análisis profundo`. Si lo apagas, la app se queda solo con el análisis rápido del navegador y evita depender del backend para refinar el grafo.

## Proveedores de IA

Puedes configurar proveedores desde `.env` o desde la interfaz.

Flujos soportados:

- Groq
- OpenAI
- Gemini
- DeepSeek
- OpenRouter
- Mistral
- Ollama
- Endpoint personalizado compatible con OpenAI

## Dirección del Producto

ProjectGrapher está evolucionando hacia un motor de handoff arquitectónico para desarrolladores y agentes de programación.

La visión de largo plazo es:

- menos dumps crudos del repositorio,
- más entendimiento estructural,
- mejor targeting por tarea,
- y handoffs IA más útiles y accionables.

## Estado Actual

El proyecto ya genera contexto arquitectónico valioso, pero todavía sigue evolucionando hacia:

- mejor precisión al encontrar archivos por tarea,
- mayor enriquecimiento con IA,
- y mejor escalabilidad para repositorios muy grandes.
