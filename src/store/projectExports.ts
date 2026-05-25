import { ProjectData } from '../types';
import { buildFileTree, generateTreeText } from '../utils/analysis';
import { detectTechStackSignals, formatProjectPaths, getTopItems, withProjectRoot } from './projectInsights';

const ENTRY_FILE_NAMES = ['main.tsx', 'main.jsx', 'app.tsx', 'app.jsx', 'main.py', 'server.js', 'index.js', 'index.ts'];

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript/React',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript/React',
  '.py': 'Python',
  '.go': 'Go',
  '.java': 'Java',
  '.cs': 'C#',
  '.php': 'PHP',
  '.rb': 'Ruby',
  '.rs': 'Rust',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.vue': 'Vue',
  '.svelte': 'Svelte'
};

const getGeneratedAtLabel = () => new Date().toLocaleString();

const buildExportMetadataBlock = (projectName: string, fileLabel: string) => {
  const generatedAt = getGeneratedAtLabel();
  let text = `## Metadata\n`;
  text += `- Proyecto: ${projectName}\n`;
  text += `- Archivo: ${fileLabel}\n`;
  text += `- Generado en: ${generatedAt}\n`;
  text += `- Modo: deterministic local analysis\n`;
  text += `- Vigencia: úsalo como mapa de referencia y valida contra el código activo antes de tomar decisiones delicadas.\n\n`;
  return text;
};

const findProjectFile = (projectData: ProjectData, matcher: (normalizedPath: string) => boolean) =>
  projectData.files.find((file) => matcher(file.path.replace(/\\/g, '/').toLowerCase()));

const getProjectSpecificContext = (projectData: ProjectData, projectName: string) => {
  const rootPath = (path: string) => withProjectRoot(projectName, path);
  const getPath = (matcher: (normalizedPath: string) => boolean) => {
    const file = findProjectFile(projectData, matcher);
    return file ? rootPath(file.path) : null;
  };

  const appPath = getPath((path) => path.endsWith('src/app.tsx'));
  const controllerPath = getPath((path) => path.endsWith('src/hooks/useappcontroller.ts'));
  const storePath = getPath((path) => path.endsWith('src/store/projectstore.slices.ts'));
  const insightsPath = getPath((path) => path.endsWith('src/store/projectinsights.ts'));
  const exportsPath = getPath((path) => path.endsWith('src/store/projectexports.ts'));
  const workerPath = getPath((path) => path.endsWith('src/workers/analysis.worker.ts'));
  const processingPath = getPath((path) => path.endsWith('src/store/projectprocessing.ts'));
  const graphCanvasPath = getPath((path) => path.endsWith('src/components/graphcanvas.tsx'));
  const dbPath = getPath((path) => path.endsWith('src/db/projectdb.ts'));
  const backendPath = getPath((path) => path.endsWith('main.py'));

  const looksLikeProjectGrapher = [appPath, controllerPath, storePath, insightsPath, exportsPath, workerPath, processingPath, graphCanvasPath, dbPath, backendPath]
    .filter(Boolean)
    .length >= 5;

  if (!looksLikeProjectGrapher) return null;

  const specificSources = [
    {
      label: 'Orquestación principal de la app',
      files: [appPath, controllerPath].filter(Boolean) as string[],
      summary: 'Aquí vive el shell principal de la UI, el armado de paneles y la coordinación de acciones del usuario.'
    },
    {
      label: 'Ingesta y análisis del proyecto cargado',
      files: [processingPath, workerPath, storePath].filter(Boolean) as string[],
      summary: 'Aquí vive la lectura de archivos, el análisis rápido del navegador y el refinamiento del grafo.'
    },
    {
      label: 'Reglas de contexto y priorización',
      files: [insightsPath, exportsPath].filter(Boolean) as string[],
      summary: 'Aquí viven las heurísticas que deciden hotspots, task packs, semantic search, exports y handoffs.'
    },
    {
      label: 'Grafo interactivo y lectura visual',
      files: [graphCanvasPath, appPath].filter(Boolean) as string[],
      summary: 'Aquí vive la visualización del mapa, selección de nodos y navegación por densidad o foco.'
    },
    {
      label: 'Persistencia local y memoria',
      files: [dbPath, storePath].filter(Boolean) as string[],
      summary: 'Aquí viven snapshots locales, smart diff, memoria del proyecto y recuperación de la última corrida.'
    },
    {
      label: 'Backend y enriquecimiento IA',
      files: [backendPath, storePath].filter(Boolean) as string[],
      summary: 'Aquí viven el análisis profundo, el proxy hacia modelos y la exportación a contexto/.'
    }
  ].filter((item) => item.files.length > 0);

  const specificFlows = [
    {
      label: 'Carga e indexación del proyecto',
      why: 'Es el flujo base del producto: toma una carpeta, filtra archivos, arma el primer grafo y prepara la corrida local.',
      files: [processingPath, workerPath, storePath].filter(Boolean) as string[]
    },
    {
      label: 'Exploración del grafo y hotspots',
      why: 'Explica cómo el usuario navega nodos, foco, densidad y lectura estructural sin abrir todo el repo.',
      files: [graphCanvasPath, appPath, insightsPath].filter(Boolean) as string[]
    },
    {
      label: 'Exports determinísticos y handoff',
      why: 'Aquí está el valor central de ProjectGrapher: convertir el análisis en snapshot, brief, graph guide, critical flows y otros artefactos reutilizables.',
      files: [exportsPath, controllerPath, appPath].filter(Boolean) as string[]
    },
    {
      label: 'Context packs por tarea o error',
      why: 'Aquí vive la selección accionable: task pack, semantic search, predictive impact y error-to-context pack.',
      files: [insightsPath, appPath, controllerPath].filter(Boolean) as string[]
    },
    {
      label: 'Auditoría IA y guardado en contexto',
      why: 'Aquí se conecta el análisis local con el backend de IA y con la persistencia de documentos exportados.',
      files: [backendPath, controllerPath, storePath].filter(Boolean) as string[]
    }
  ].filter((item) => item.files.length > 0);

  return {
    sources: specificSources,
    flows: specificFlows
  };
};

const getSourceOfTruthCandidates = (projectData: ProjectData, projectName: string) => {
  const specific = getProjectSpecificContext(projectData, projectName);
  if (specific) {
    return specific.sources;
  }

  const files = projectData.files;
  const rootPath = (path: string) => withProjectRoot(projectName, path);
  const rules: Array<{ label: string; matcher: (path: string, code: string, name: string) => boolean; summary: string }> = [
    {
      label: 'Reglas de negocio',
      matcher: (path, code, name) => /\/utils\/|\/domain\/|\/rules\//.test(path) || /(payment|pricing|policy|rule|validator)/.test(path) || /(payment|business rule|eligib|valida)/.test(code) || /(payment|rule|validator)/.test(name),
      summary: 'Aquí suelen vivir decisiones funcionales, validaciones y cálculo de estados.'
    },
    {
      label: 'Estado global y contexto',
      matcher: (path, code, name) => /\/contexts?\//.test(path) || /(context|provider|zustand|store)/.test(path) || /(createcontext|zustand|redux)/.test(code) || /(context|store)/.test(name),
      summary: 'Aquí suele vivir el acceso global, la sesión y la propagación de estado.'
    },
    {
      label: 'Integraciones y API',
      matcher: (path, code, name) => /\/api\/|\/services?\//.test(path) || /(fetch|axios|graphql|endpoint|request)/.test(code) || /(api|service)/.test(name),
      summary: 'Aquí suelen vivir llamadas externas, endpoints y capa de integración.'
    },
    {
      label: 'UI y orquestación',
      matcher: (path, code, name) => /\/components\/|\/pages\/|\/views\/|\/screens\//.test(path) || /(router|layout|app\.)/.test(name) || /(useeffect|return \(|jsx)/.test(code),
      summary: 'Aquí suelen vivir pantallas, flujos visibles y orquestadores de interfaz.'
    },
    {
      label: 'Autenticación y acceso',
      matcher: (path, code, name) => /(auth|session|login|signin|token)/.test(path) || /(auth|session|signin|token)/.test(code) || /(auth|session)/.test(name),
      summary: 'Aquí suele vivir el control de acceso, sesión y reglas de identidad.'
    }
  ];

  return rules.map((rule) => {
    const matches = files
      .filter((file) => rule.matcher(file.path.toLowerCase(), file.content.toLowerCase(), file.name.toLowerCase()))
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, 3)
      .map((file) => rootPath(file.path));

    return {
      label: rule.label,
      summary: rule.summary,
      files: Array.from(new Set(matches))
    };
  }).filter((item) => item.files.length > 0);
};

const buildSourcesOfTruthBlock = (projectData: ProjectData, projectName: string) => {
  const groups = getSourceOfTruthCandidates(projectData, projectName);
  if (!groups.length) return '';

  let text = '## Fuentes de Verdad\n';
  text += 'Esta sección intenta separar el mapa técnico de los archivos donde probablemente viven decisiones reales del sistema.\n';
  groups.forEach((group) => {
    text += `- ${group.label}: ${group.files.join(', ')}\n`;
    text += `  Nota: ${group.summary}\n`;
  });
  text += '\n';
  return text;
};

const getCriticalFlowCandidates = (projectData: ProjectData, projectName: string) => {
  const specific = getProjectSpecificContext(projectData, projectName);
  if (specific) {
    return specific.flows;
  }

  const rootPath = (path: string) => withProjectRoot(projectName, path);
  const files = projectData.files;
  const flows = [
    {
      label: 'Autenticación y acceso',
      terms: ['auth', 'login', 'signin', 'session', 'token', 'guard'],
      why: 'Conviene empezar aquí si el flujo depende de sesión, permisos o acceso global.'
    },
    {
      label: 'Pagos y bloqueo funcional',
      terms: ['payment', 'payments', 'billing', 'checkout', 'invoice', 'warning'],
      why: 'Conviene revisar estas piezas si el negocio depende de validación, tolerancia, bloqueo o desbloqueo.'
    },
    {
      label: 'Onboarding o navegación principal',
      terms: ['router', 'route', 'layout', 'dashboard', 'home', 'app'],
      why: 'Ayuda a reconstruir por dónde entra el usuario y cómo se mueve entre pantallas.'
    },
    {
      label: 'Estado global del usuario',
      terms: ['context', 'provider', 'store', 'zustand', 'student', 'user'],
      why: 'Útil para detectar dónde vive la información compartida que condiciona la UI.'
    }
  ];

  return flows.map((flow) => {
    const matches = files
      .filter((file) => {
        const haystack = `${file.path} ${file.name} ${file.content.slice(0, 1000)}`.toLowerCase();
        return flow.terms.some((term) => haystack.includes(term));
      })
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, 4)
      .map((file) => rootPath(file.path));

    return {
      ...flow,
      files: Array.from(new Set(matches))
    };
  }).filter((flow) => flow.files.length > 0);
};

const buildCriticalFlowsBlock = (projectData: ProjectData, projectName: string) => {
  const flows = getCriticalFlowCandidates(projectData, projectName);
  if (!flows.length) return '';

  let text = '## Flujos Críticos\n';
  text += 'No pretende documentar todo el negocio. Intenta marcar rutas de lectura que suelen cambiar decisiones antes de editar código.\n';
  flows.forEach((flow) => {
    text += `\n### ${flow.label}\n`;
    text += `- Por qué importa: ${flow.why}\n`;
    text += `- Archivos guía: ${flow.files.join(', ')}\n`;
  });
  text += '\n';
  return text;
};

export const generateAIContextExport = (projectData: ProjectData, projectName: string) => {
  const normalizedName = projectName || 'Unknown Project';
  const rootPath = (path: string) => withProjectRoot(normalizedName, path);
  const filesWithRoot = projectData.files.map((file) => ({
    ...file,
    path: rootPath(file.path)
  }));
  const stack = new Set<string>();

  projectData.files.forEach((file) => {
    const signals = detectTechStackSignals(file);
    signals.stack.forEach((item) => stack.add(item));
    if (signals.databases.length) stack.add('Database (ORM/ODM)');
  });

  const fileExtCount = new Map<string, number>();
  const directories = new Set<string>();
  const entryPoints: string[] = [];
  const backendFiles: string[] = [];
  const frontendFiles: string[] = [];

  projectData.files.forEach((file) => {
    fileExtCount.set(file.ext || 'no-ext', (fileExtCount.get(file.ext || 'no-ext') || 0) + 1);

    const parts = file.path.split('/');
    if (parts.length > 1) {
      directories.add(parts[0]);
    }

    const lowerPath = file.path.toLowerCase();
    const lowerName = file.name.toLowerCase();

    if (ENTRY_FILE_NAMES.includes(lowerName)) {
      entryPoints.push(file.path);
    }

    if (['.tsx', '.ts', '.jsx', '.js', '.html', '.css', '.scss'].includes(file.ext)) {
      frontendFiles.push(file.path);
    }

    if (['.py', '.go', '.rb', '.php', '.java', '.cs'].includes(file.ext) || lowerPath.includes('server/')) {
      backendFiles.push(file.path);
    }
  });

  const dominantExt = [...fileExtCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ext, count]) => `${ext} (${count})`);

  const detectedCapabilities = new Set<string>();
  projectData.files.forEach((file) => {
    const code = file.content.toLowerCase();
    if (code.includes('generateerrorcontextpack') || code.includes('error-to-context')) detectedCapabilities.add('Error-to-Context Pack');
    if (code.includes('generatetaskpack') || code.includes('task pack')) detectedCapabilities.add('Task Pack Builder');
    if (code.includes('generatesemanticsearchresults') || code.includes('semantic search')) detectedCapabilities.add('Semantic Search');
    if (code.includes('generateimpactanalysisdata') || code.includes('predictive impact')) detectedCapabilities.add('Predictive Impact Analysis');
    if (code.includes('buildsmartdiffdata') || code.includes('smart diff')) detectedCapabilities.add('Smart Diff Context');
    if (code.includes('projectmemory') || code.includes('setprojectglobalmemory') || code.includes('setprojectfilememory')) detectedCapabilities.add('Project Memory');
    if (code.includes('generateaivisiondocument') || code.includes('generateaiarchitecturenarrative') || code.includes('generateairefactorpriorities')) detectedCapabilities.add('AI Handoff Documents');
    if (code.includes('generateaicontext')) detectedCapabilities.add('Architectural Snapshot Export');
  });

  const capabilityList = Array.from(detectedCapabilities);
  const productCoreFiles = projectData.files.filter((file) => {
    const lowerPath = file.path.toLowerCase();
    return (
      lowerPath.endsWith('src/app.tsx') ||
      lowerPath.endsWith('src/store/useprojectstore.ts') ||
      lowerPath.endsWith('src/utils/analysis.ts') ||
      lowerPath.endsWith('main.py') ||
      lowerPath.endsWith('server/index.js')
    );
  });
  const productCoreFileList = productCoreFiles.map((file) => rootPath(file.path));
  const topNodes = [...projectData.nodes]
    .sort((a, b) => (b.data.importance || 0) - (a.data.importance || 0))
    .slice(0, 8);
  const topHotspots = topNodes.map((node) => `${node.label} [${node.data.importance}]`);
  const connectionMap = new Map<string, { outgoing: string[]; incoming: string[] }>();

  projectData.nodes.forEach((node) => {
    connectionMap.set(node.id, { outgoing: [], incoming: [] });
  });

  projectData.links.forEach((link) => {
    const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
    const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
    const sourceNode = projectData.nodes.find((node) => node.id === sourceId);
    const targetNode = projectData.nodes.find((node) => node.id === targetId);
    const sourceLabel = sourceNode?.label || sourceId;
    const targetLabel = targetNode?.label || targetId;

    if (connectionMap.has(sourceId)) {
      connectionMap.get(sourceId)!.outgoing.push(targetLabel);
    }
    if (connectionMap.has(targetId)) {
      connectionMap.get(targetId)!.incoming.push(sourceLabel);
    }
  });

  const graphLeaders = [...projectData.nodes]
    .map((node) => {
      const connections = connectionMap.get(node.id) || { outgoing: [], incoming: [] };
      return {
        label: node.label,
        path: node.id,
        outgoing: connections.outgoing.length,
        incoming: connections.incoming.length,
        total: connections.outgoing.length + connections.incoming.length,
        outgoingTargets: connections.outgoing.slice(0, 6),
        incomingSources: connections.incoming.slice(0, 6)
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  const topRelations = projectData.links.slice(0, 20).map((link) => {
    const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
    const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
    const sourceNode = projectData.nodes.find((node) => node.id === sourceId);
    const targetNode = projectData.nodes.find((node) => node.id === targetId);
    return `${sourceNode?.label || sourceId} -> ${targetNode?.label || targetId}`;
  });

  const inferredPurpose = [
    capabilityList.length > 0 ? 'extraer contexto arquitectónico accionable para desarrolladores y agentes' : null,
    capabilityList.includes('Task Pack Builder') ? 'armar handoffs cortos y task packs por intención' : null,
    capabilityList.includes('Error-to-Context Pack') ? 'convertir errores en contexto corto de depuración' : null,
    capabilityList.includes('Semantic Search') ? 'ubicar módulos por propósito y no solo por nombre' : null,
    capabilityList.includes('Predictive Impact Analysis') ? 'anticipar impacto antes de modificar archivos' : null,
    backendFiles.some((path) => path.endsWith('main.py')) ? 'backend FastAPI para análisis y orquestación de IA' : null
  ].filter(Boolean).join(', ');

  const architectureSummary = [
    frontendFiles.length > 0 ? `Frontend detectado con ${frontendFiles.length} archivos principales de interfaz.` : null,
    backendFiles.length > 0 ? `Backend detectado con ${backendFiles.length} archivos de lógica/servicio.` : null,
    projectData.links.length > 0 ? `Se mapearon ${projectData.links.length} relaciones entre módulos.` : null,
    topHotspots.length > 0 ? `Los hotspots más conectados son ${getTopItems(topHotspots, 4)}.` : null,
    capabilityList.length > 0 ? `Las capacidades detectadas del producto son ${getTopItems(capabilityList, 8)}.` : null
  ].filter(Boolean).join(' ');

  let context = '### ARCHITECTURAL INTELLIGENCE SNAPSHOT\n';
  context += `Project Context: ${normalizedName}\n`;
  context += `Tech Stack: ${Array.from(stack).join(', ') || 'Standard Web/App Stack'}\n`;
  context += `Scale: ${projectData.files.length} Analyzed Modules\n\n`;
  context += buildExportMetadataBlock(normalizedName, 'snapshot.md');

  context += '### PROJECT IDENTITY\n';
  context += `One-line Description: ${normalizedName} es un proyecto enfocado en ${inferredPurpose || 'análisis y visualización de arquitectura de software'}.\n`;
  context += `Architecture Summary: ${architectureSummary || 'No se pudo inferir un resumen arquitectónico fuerte con el conjunto actual de archivos.'}\n`;
  context += `Primary Entry Points: ${getTopItems(formatProjectPaths(normalizedName, entryPoints), 8)}\n`;
  context += `Main Directories: ${getTopItems(Array.from(directories), 10)}\n`;
  context += `Dominant File Types: ${getTopItems(dominantExt, 5)}\n\n`;

  context += '### PRODUCT CAPABILITIES\n';
  context += `Core Product Capabilities: ${getTopItems(capabilityList, 10)}\n`;
  context += `Core Product Files: ${getTopItems(productCoreFileList, 8)}\n`;
  context += 'Analysis Mode Split: Deterministic local analysis first, optional AI enrichment second.\n';
  context += 'Important Framing: No describas este proyecto solo como visualizador de grafo si las capacidades detectadas muestran handoff, task packs, error packs, impacto, búsqueda semántica o memoria de proyecto.\n\n';

  context += '### EXPLICIT CONSTRAINTS\n';
  context += 'Deployment Model: local-first tool. No asumir SaaS, multiusuario ni servicio remoto salvo evidencia explícita.\n';
  context += 'Authentication: no se detectó autenticación, cuentas de usuario ni login como capacidad central del producto.\n';
  context += 'Persistence Model: la persistencia detectada es local. No afirmar almacenamiento en nube, base de datos de usuarios ni sincronización remota sin evidencia explícita.\n';
  context += 'Inference Rule: si una capacidad no aparece en archivos, rutas, dependencias o funciones detectadas, no la inventes.\n\n';
  context += buildSourcesOfTruthBlock(projectData, normalizedName);
  context += buildCriticalFlowsBlock(projectData, normalizedName);

  context += '### ESTRUCTURA DE DIRECTORIOS\n';
  context += `${generateTreeText(buildFileTree(filesWithRoot))}\n`;

  context += '### MODULE LAYER OVERVIEW\n';
  const layers: Record<string, string[]> = {};
  projectData.files.forEach((file) => {
    const parts = file.path.split('/');
    const layer = parts.length > 1 ? parts[0] : 'root';
    if (!layers[layer]) layers[layer] = [];
    if (layers[layer].length < 10) layers[layer].push(file.name);
  });

  Object.entries(layers).forEach(([layer, files]) => {
    context += `- [${layer.toUpperCase()}]: ${files.join(', ')}${files.length >= 10 ? '...' : ''}\n`;
  });

  context += '\n### EXECUTIVE SUMMARY FOR AGENTS\n';
  context += `- Project Goal: ${normalizedName} centraliza información del código para convertir un proyecto local en contexto accionable para humanos y agentes.\n`;
  context += '- Key Flows: Carga de archivos -> análisis local -> grafo y hotspots -> task packs / error packs / semantic search / impact analysis -> exportación de artefactos -> revisión con IA opcional.\n';
  context += `- Product Differentiators: ${getTopItems(capabilityList, 8)}\n`;
  context += `- Critical Hotspots: ${getTopItems(topHotspots, 6)}\n`;
  context += `- Sample Dependency Paths: ${getTopItems(topRelations, 8)}\n`;

  context += '\n### GRAPH INTERPRETATION GUIDE\n';
  context += 'Este grafo representa dependencias entre archivos. Si un archivo A apunta a B, normalmente significa que A importa, usa o depende de B.\n';
  context += 'Los nodos con muchas conexiones entrantes suelen ser piezas centrales o utilidades compartidas. Los nodos con muchas conexiones salientes suelen ser orquestadores, pantallas principales o servicios que coordinan otros módulos.\n';
  graphLeaders.forEach((leader) => {
    context += `- ${leader.label}: ${leader.total} conexiones totales (${leader.outgoing} salientes, ${leader.incoming} entrantes). `;
    context += `Usa -> ${getTopItems(leader.outgoingTargets, 4)}. `;
    context += `Es usado por -> ${getTopItems(leader.incomingSources, 4)}.\n`;
  });

  context += '\n### STRATEGIC CLASS/FILE RELATIONSHIPS\n';
  projectData.nodes.forEach((node) => {
    const deps = projectData.links
      .filter((link) => {
        const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
        return sourceId === node.id;
      })
      .map((link) => {
        const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
        const targetNode = projectData.nodes.find((candidate) => candidate.id === targetId);
        return targetNode?.label || targetId;
      });

    if (deps.length > 0) {
      context += `[${node.label}] calls -> (${deps.join(', ')})\n`;
    }
  });

  context += '\n### KEY SOURCE CODE (COMPRESSED TOP 12)\n';
  const keyFiles = [...projectData.files]
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .slice(0, 12);

  keyFiles.forEach((file) => {
    const lines = file.content.split('\n');
    const compressedCode = lines
      .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('/*'))
      .slice(0, 80)
      .join('\n');

    context += `\n--- SOURCE: ${rootPath(file.path)} ---\n\`\`\`${file.ext.replace('.', '')}\n${compressedCode}${lines.length > 80 ? '\n// ... code continues (truncated for efficiency)' : ''}\n\`\`\`\n`;
  });

  return context;
};

export const generateProjectBriefExport = (projectData: ProjectData, projectName: string) => {
  const languageCount = new Map<string, number>();
  const stack = new Set<string>();
  const dbSignals = new Set<string>();
  const runtimeSignals = new Set<string>();
  const uiSignals = new Set<string>();
  const entryPoints: string[] = [];
  const hotspotFiles = [...projectData.files]
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .slice(0, 8);

  projectData.files.forEach((file) => {
    const signals = detectTechStackSignals(file);
    const language = LANGUAGE_MAP[file.ext] || file.ext || 'Unknown';
    languageCount.set(language, (languageCount.get(language) || 0) + 1);

    signals.stack.forEach((item) => stack.add(item));
    signals.databases.forEach((item) => dbSignals.add(item));
    signals.runtime.forEach((item) => runtimeSignals.add(item));
    signals.ui.forEach((item) => uiSignals.add(item));

    if (ENTRY_FILE_NAMES.includes(file.name.toLowerCase())) {
      entryPoints.push(file.path);
    }
  });

  const topLanguages = [...languageCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([language, count]) => `${language} (${count})`);

  const detectedPurpose = [
    uiSignals.has('SPA Frontend') ? 'explorar visualmente la estructura de proyectos' : null,
    runtimeSignals.has('Backend Python') || runtimeSignals.has('Backend Node') ? 'procesar y enriquecer el análisis con servicios locales' : null,
    projectData.links.length > 0 ? 'mapear relaciones entre módulos' : null,
    stack.has('PWA') ? 'funcionar como aplicación instalable' : null
  ].filter(Boolean).join(', ');

  let brief = `# Project Brief: ${projectName}\n\n`;
  brief += buildExportMetadataBlock(projectName, 'brief.md');
  brief += '## Qué Hace\n';
  brief += `${projectName} parece estar diseñado para ${detectedPurpose || 'analizar código fuente y generar contexto reutilizable para agentes de programación'}.\n\n`;
  brief += '## Stack Detectado\n';
  brief += `- Frameworks y librerías: ${Array.from(stack).join(', ') || 'No detectado con alta confianza'}\n`;
  brief += `- Lenguajes principales: ${topLanguages.slice(0, 6).join(', ') || 'No detectado'}\n`;
  brief += `- Base de datos o persistencia: ${Array.from(dbSignals).join(', ') || 'No se detectó una base de datos clara'}\n`;
  brief += `- Runtime/capacidades: ${Array.from(new Set([...runtimeSignals, ...uiSignals])).join(', ') || 'No detectado'}\n\n`;
  brief += '## Arquitectura\n';
  brief += `- Archivos analizados: ${projectData.files.length}\n`;
  brief += `- Relaciones detectadas: ${projectData.links.length}\n`;
  brief += `- Entry points probables: ${formatProjectPaths(projectName, entryPoints).join(', ') || 'No detectados'}\n`;
  brief += `- Hotspots principales: ${hotspotFiles.map((file) => `${file.name} [${file.importance || 0}]`).join(', ') || 'No detectados'}\n\n`;
  brief += buildSourcesOfTruthBlock(projectData, projectName);
  brief += buildCriticalFlowsBlock(projectData, projectName);
  brief += '## Qué Pasarle A Otro Agente\n';
  brief += `- Este proyecto usa: ${topLanguages.slice(0, 4).join(', ') || 'lenguajes no detectados con claridad'}.\n`;
  brief += `- Componentes críticos: ${hotspotFiles.slice(0, 5).map((file) => withProjectRoot(projectName, file.path)).join(', ') || 'No detectados'}.\n`;
  brief += '- Resumen operativo: carga archivos del proyecto, detecta dependencias, construye un grafo, genera snapshots y puede pedir una auditoría con IA si hay proveedor configurado.\n';

  return brief;
};

export const generateProjectMetadataExport = (projectData: ProjectData, projectName: string) => {
  const languages: Record<string, number> = {};
  const technologies = new Set<string>();
  const databases = new Set<string>();
  const layers = {
    frontend: 0,
    backend: 0,
    workers: 0,
    storage: 0
  };

  projectData.files.forEach((file) => {
    const code = file.content.toLowerCase();
    const signals = detectTechStackSignals(file);
    const language = LANGUAGE_MAP[file.ext] || file.ext || 'Unknown';
    languages[language] = (languages[language] || 0) + 1;

    signals.stack.forEach((item) => technologies.add(item));
    signals.databases.forEach((item) => databases.add(item));

    if (['.tsx', '.jsx', '.vue', '.svelte', '.html', '.css', '.scss'].includes(file.ext)) layers.frontend++;
    if (['.py', '.go', '.java', '.cs', '.php', '.rb'].includes(file.ext) || file.path.toLowerCase().includes('server/')) layers.backend++;
    if (file.path.toLowerCase().includes('worker')) layers.workers++;
    if (code.includes('dexie') || code.includes('indexeddb') || code.includes('database')) layers.storage++;
  });

  const hotspots = [...projectData.files]
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .slice(0, 10)
    .map((file) => ({
      path: withProjectRoot(projectName, file.path),
      importance: file.importance || 0,
      ext: file.ext
    }));

  return JSON.stringify({
    projectName,
    generatedBy: 'ProjectGrapher local deterministic analysis',
    generatedAt: getGeneratedAtLabel(),
    validityNote: 'Usa este archivo como referencia estructural y valida contra el código activo antes de cambiar reglas de negocio.',
    summary: {
      files: projectData.files.length,
      links: projectData.links.length,
      nodes: projectData.nodes.length
    },
    languages,
    technologies: Array.from(technologies),
    databases: Array.from(databases),
    layers,
    entryPoints: projectData.files
      .filter((file) => ENTRY_FILE_NAMES.includes(file.name.toLowerCase()))
      .map((file) => withProjectRoot(projectName, file.path)),
    hotspots,
    sourcesOfTruth: getSourceOfTruthCandidates(projectData, projectName),
    criticalFlows: getCriticalFlowCandidates(projectData, projectName),
    agentHint: {
      purpose: 'Usa este archivo para darle a otro agente una ficha técnica rápida y determinista del proyecto.',
      recommendedFiles: hotspots.slice(0, 5).map((file) => file.path)
    }
  }, null, 2);
};

export const generateGraphGuideExport = (projectData: ProjectData, projectName: string) => {
  const rootPath = (path: string) => withProjectRoot(projectName, path);
  const connectionMap = new Map<string, { outgoing: string[]; incoming: string[]; path: string }>();

  projectData.nodes.forEach((node) => {
    connectionMap.set(node.id, { outgoing: [], incoming: [], path: node.id });
  });

  projectData.links.forEach((link) => {
    const sourceId = typeof link.source === 'object' ? (link.source as any).id : link.source;
    const targetId = typeof link.target === 'object' ? (link.target as any).id : link.target;
    const sourceNode = projectData.nodes.find((node) => node.id === sourceId);
    const targetNode = projectData.nodes.find((node) => node.id === targetId);

    if (connectionMap.has(sourceId)) {
      connectionMap.get(sourceId)!.outgoing.push(targetNode?.label || targetId);
    }
    if (connectionMap.has(targetId)) {
      connectionMap.get(targetId)!.incoming.push(sourceNode?.label || sourceId);
    }
  });

  const ranking = [...projectData.nodes]
    .map((node) => {
      const current = connectionMap.get(node.id)!;
      return {
        label: node.label,
        path: node.id,
        outgoing: current.outgoing,
        incoming: current.incoming,
        total: current.outgoing.length + current.incoming.length
      };
    })
    .sort((a, b) => b.total - a.total);

  const orchestrators = ranking.filter((node) => node.outgoing.length >= 2).slice(0, 12);
  const sharedCore = ranking.filter((node) => node.incoming.length >= 2).slice(0, 12);

  let guide = `# Graph Guide: ${projectName}\n\n`;
  guide += buildExportMetadataBlock(projectName, 'graph_guide.md');
  guide += '## Cómo Leer Este Archivo\n';
  guide += '- "Usa" significa que un archivo depende de otro.\n';
  guide += '- "Recibe uso de" significa que otros módulos dependen de ese archivo.\n';
  guide += '- Los módulos listados primero son los más relevantes para entender el flujo real del proyecto.\n\n';
  guide += '## Resumen del Grafo\n';
  guide += `- Nodos: ${projectData.nodes.length}\n`;
  guide += `- Relaciones: ${projectData.links.length}\n`;
  guide += `- Módulos más conectados: ${ranking.slice(0, 8).map((node) => `${node.label} (${node.total})`).join(', ') || 'N/A'}\n\n`;
  guide += buildSourcesOfTruthBlock(projectData, projectName);
  guide += '## Archivos Orquestadores\n';
  orchestrators.forEach((node) => {
    guide += `- ${node.label}\n`;
    guide += `  Path: ${rootPath(node.path)}\n`;
    guide += `  Usa: ${node.outgoing.slice(0, 8).join(', ') || 'Nadie'}\n`;
    guide += `  Recibe uso de: ${node.incoming.slice(0, 8).join(', ') || 'Nadie'}\n`;
  });
  guide += '\n## Núcleo Compartido\n';
  sharedCore.forEach((node) => {
    guide += `- ${node.label}\n`;
    guide += `  Path: ${rootPath(node.path)}\n`;
    guide += `  Recibe uso de: ${node.incoming.slice(0, 8).join(', ') || 'Nadie'}\n`;
    guide += `  Usa: ${node.outgoing.slice(0, 8).join(', ') || 'Nadie'}\n`;
  });
  guide += '\n## Recomendación Para Otro Agente\n';
  guide += 'Empieza por los archivos orquestadores, luego revisa el núcleo compartido y por último entra a archivos hoja. Este orden reduce tokens y acelera el entendimiento del sistema.\n';

  return guide;
};

export const generateCriticalFlowsExport = (projectData: ProjectData, projectName: string) => {
  let text = `# Critical Flows: ${projectName}\n\n`;
  text += buildExportMetadataBlock(projectName, 'critical_flows.md');
  text += '## Qué Es Este Archivo\n';
  text += 'Documento corto para separar flujos operativos y fuentes de verdad del resto del mapa técnico.\n\n';
  text += buildSourcesOfTruthBlock(projectData, projectName);
  text += buildCriticalFlowsBlock(projectData, projectName);
  text += '## Recomendación de Uso\n';
  text += '- Léelo antes de editar si la tarea toca reglas funcionales, contexto global o integraciones.\n';
  text += '- Cruza este archivo con snapshot y graph guide si necesitas más detalle estructural.\n';
  return text;
};

export const generateTreeOnlyExport = (projectData: ProjectData, projectName: string) => {
  const tree = buildFileTree(
    projectData.files.map((file) => ({
      ...file,
      path: withProjectRoot(projectName || 'Unknown Project', file.path)
    }))
  );

  return `### PROJECT STRUCTURE SNAPSHOT\n${generateTreeText(tree)}`;
};
