import type { StoreApi } from 'zustand';
import { db } from '../db/projectDB';
import { buildDeepAnalysisGraph, prepareProjectFilesForWorker } from './projectProcessing';
import type { ProjectState } from './projectStore.types';
import { generateAIContextExport, generateGraphGuideExport, generateProjectBriefExport, generateProjectMetadataExport, generateTreeOnlyExport } from './projectExports';
import { buildAIArchitectureNarrative, buildAIAgentHandoff, buildAIRefactorPriorities, buildAIVisionDocument, buildErrorContextPack, buildErrorContextPackData, buildExecutiveContext, buildHotspotReport, buildImpactAnalysisData, buildSemanticSearchResults, buildSmartDiffData, buildSystemView, buildTaskPack, buildTaskPackData, extractProjectInsights, formatProjectPaths } from './projectInsights';

type SetState = StoreApi<ProjectState>['setState'];
type GetState = StoreApi<ProjectState>['getState'];

const getProjectInsights = (get: GetState) => {
  const state = get();
  if (!state.projectData) return null;

  const projectName = state.projectName || 'Unknown Project';
  return {
    projectData: state.projectData,
    projectName,
    aiReview: state.aiReview,
    insights: extractProjectInsights(state.projectData, projectName)
  };
};

export const createUiSlice = (set: SetState) => ({
  searchQuery: '',
  treeSearch: '',
  activeTab: 'details' as const,
  isFocusMode: false,
  showFileModal: false,
  showIAModal: false,
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setTreeSearch: (query: string) => set({ treeSearch: query }),
  setActiveTab: (tab: ProjectState['activeTab']) => set({ activeTab: tab }),
  setIsFocusMode: (mode: boolean) => set({ isFocusMode: mode }),
  setShowFileModal: (show: boolean) => set({ showFileModal: show }),
  setShowIAModal: (show: boolean) => set({ showIAModal: show })
});

export const createAiSlice = (set: SetState, get: GetState) => ({
  isReviewing: false,
  aiReview: null,
  aiError: null,
  aiProvider: 'gemini' as const,
  aiModel: 'gemini-1.5-flash',
  customUrl: '',
  customKey: '',
  customKeys: {},
  envKeys: {},
  envKeyDetails: {},
  setAiProvider: (provider: ProjectState['aiProvider']) => {
    const { customKeys } = get();
    set({
      aiProvider: provider,
      customKey: customKeys[provider] || ''
    });
  },
  setAiModel: (model: string) => set({ aiModel: model }),
  setCustomUrl: (url: string) => set({ customUrl: url }),
  setCustomKey: (key: string) => {
    const { aiProvider, customKeys } = get();
    set({
      customKey: key,
      customKeys: {
        ...customKeys,
        [aiProvider]: key
      }
    });
  },
  checkEnvKeys: async () => {
    try {
      const res = await fetch('/api/ai/config');
      if (!res.ok) {
        throw new Error(`No se pudo consultar la configuración AI del servidor (${res.status})`);
      }

      const raw = await res.text();
      if (!raw.trim()) {
        throw new Error('El servidor devolvió una respuesta vacía al consultar las llaves');
      }

      const data = JSON.parse(raw);
      set({
        envKeys: data.env_keys || {},
        envKeyDetails: data.providers || {}
      });
    } catch (err) {
      console.error('Error checking env keys:', err);
      set({
        envKeys: {},
        envKeyDetails: {}
      });
    }
  },
  generateAIReview: async () => {
    const { generateAIContext, isReviewing, projectData } = get();
    if (!projectData || isReviewing) return;

    set({ isReviewing: true, aiError: null, aiReview: null });

    try {
      const { aiProvider, aiModel, customUrl, customKey } = get();
      const context = generateAIContext();
      const response = await fetch('/api/ai/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          provider: aiProvider,
          model: aiModel,
          customUrl,
          customKey
        })
      });

      const rawText = await response.text();
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = rawText ? { error: rawText } : {};
      }

      if (!response.ok) {
        const backendMessage = data.detail || data.error || 'Error en el servidor de IA';
        const normalizedProvider = aiProvider.toUpperCase();
        if (response.status === 401) {
          throw new Error(`${backendMessage} Verifica ${normalizedProvider}_API_KEY o la llave escrita en la configuracion.`);
        }
        if (response.status === 429) {
          throw new Error(`${backendMessage} Espera un momento o cambia de proveedor/modelo.`);
        }
        throw new Error(backendMessage);
      }

      if (!data.text) throw new Error('No se recibió respuesta del modelo');
      set({ aiReview: data.text });
    } catch (err: any) {
      console.error('AI Error:', err);
      set({ aiError: `Error: ${err.message}` });
    } finally {
      set({ isReviewing: false });
    }
  },
  generateAIVisionDocument: () => {
    const context = getProjectInsights(get);
    if (!context?.aiReview) return '';
    return buildAIVisionDocument(
      context.projectName,
      context.aiReview,
      context.insights.stack,
      formatProjectPaths(context.projectName, context.insights.entryPoints)
    );
  },
  generateAIArchitectureNarrative: () => {
    const context = getProjectInsights(get);
    if (!context?.aiReview) return '';
    return buildAIArchitectureNarrative(context.projectName, context.aiReview, context.insights.topRelations, context.insights.topHotspots);
  },
  generateAIRefactorPriorities: () => {
    const context = getProjectInsights(get);
    if (!context?.aiReview) return '';
    return buildAIRefactorPriorities(context.projectName, context.aiReview, context.insights.topHotspots);
  },
  generateAIAgentHandoff: (task: string) => {
    const context = getProjectInsights(get);
    if (!context?.aiReview) return '';
    const taskPack = buildTaskPack(context.projectData, context.insights, task, context.aiReview);
    return buildAIAgentHandoff(context.projectName, context.aiReview, taskPack);
  }
});

export const createProjectSlice = (set: SetState, get: GetState) => ({
  projectData: null,
  projectName: '',
  skippedCount: 0,
  selectedNode: null,
  smartDiffData: null,
  projectMemory: {},
  isProcessing: false,
  useDeepAnalysis: true,
  setProjectData: (data: ProjectState['projectData']) => set({ projectData: data }),
  setSkippedCount: (count: number) => set({ skippedCount: count }),
  setSelectedNode: (node: ProjectState['selectedNode']) => set({ selectedNode: node }),
  setProjectGlobalMemory: (note: string) => {
    const { projectName, projectMemory } = get();
    if (!projectName) return;
    const existing = projectMemory[projectName] || { globalNote: '', fileNotes: {} };
    set({
      projectMemory: {
        ...projectMemory,
        [projectName]: {
          ...existing,
          globalNote: note
        }
      }
    });
  },
  setProjectFileMemory: (filePath: string, note: string) => {
    const { projectName, projectMemory } = get();
    if (!projectName) return;
    const existing = projectMemory[projectName] || { globalNote: '', fileNotes: {} };
    set({
      projectMemory: {
        ...projectMemory,
        [projectName]: {
          ...existing,
          fileNotes: {
            ...existing.fileNotes,
            [filePath]: note
          }
        }
      }
    });
  },
  setUseDeepAnalysis: (mode: boolean) => set({ useDeepAnalysis: mode }),
  closeProject: async () => {
    set({
      projectData: null,
      projectName: '',
      skippedCount: 0,
      selectedNode: null,
      smartDiffData: null,
      aiReview: null,
      aiError: null,
      activeTab: 'details'
    });
    await db.projects.clear();
  },
  refreshSmartDiff: async () => {
    const { projectData, projectName } = get();
    if (!projectData || !projectName) {
      set({ smartDiffData: null });
      return;
    }

    const history = (await db.projects.orderBy('timestamp').reverse().toArray())
      .filter((item) => item.name === projectName);

    if (history.length < 2) {
      set({ smartDiffData: null });
      return;
    }

    const currentRecord = history[0];
    const previousRecord = history[1];
    const baselineLabel = new Date(previousRecord.timestamp).toLocaleString();
    const currentLabel = new Date(currentRecord.timestamp).toLocaleString();

    set({
      smartDiffData: buildSmartDiffData(previousRecord.data, currentRecord.data, projectName, baselineLabel, currentLabel)
    });
  },
  performDeepAnalysis: async () => {
    const { projectData } = get();
    if (!projectData || projectData.files.length === 0) return;

    set({ isProcessing: true });
    try {
      const filesToAnalyze = projectData.files.map((file) => ({
        path: file.path,
        content: file.content,
        ext: file.ext.replace('.', '')
      }));

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: filesToAnalyze })
      });

      const data = await response.json();
      const nextGraph = buildDeepAnalysisGraph(projectData, data.analysis);
      set({ projectData: { ...projectData, nodes: nextGraph.nodes, links: nextGraph.links } });
    } catch (err) {
      console.error('Deep Analysis Error:', err);
    } finally {
      set({ isProcessing: false });
    }
  },
  loadLastProject: async () => {
    const lastProject = await db.projects.orderBy('timestamp').last();
    if (!lastProject) return;
    set({ projectData: lastProject.data, projectName: lastProject.name || '' });
    await get().refreshSmartDiff();
  },
  processFiles: async (fileList: FileList) => {
    set({ isProcessing: true, projectData: null, selectedNode: null, skippedCount: 0, smartDiffData: null });

    if (!fileList.length) {
      set({ isProcessing: false });
      return;
    }

    const { projectName, skippedCount, workerInput } = await prepareProjectFilesForWorker(fileList);
    if (!workerInput.length) {
      set({ isProcessing: false, projectName, skippedCount });
      return;
    }

    set({ projectName });

    const worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
    worker.postMessage({ files: workerInput });

    worker.onmessage = async (e) => {
      const { projectData } = e.data;
      set({ projectData, skippedCount });

      await db.projects.add({
        name: projectName,
        data: projectData,
        timestamp: Date.now()
      });

      worker.terminate();
      await get().refreshSmartDiff();
      await get().performDeepAnalysis();
    };

    worker.onerror = (err) => {
      console.error('Worker Error:', err);
      set({ isProcessing: false });
      worker.terminate();
    };
  },
  generateAIContext: () => {
    const { projectData, projectName } = get();
    if (!projectData) return '';
    return generateAIContextExport(projectData, projectName || 'Unknown Project');
  },
  generateExecutiveView: () => {
    const context = getProjectInsights(get);
    if (!context) return '';
    return buildExecutiveContext(context.insights, context.projectData.files.length, context.projectData.links.length, context.aiReview);
  },
  generateSystemView: () => {
    const context = getProjectInsights(get);
    if (!context) return '';
    return buildSystemView(context.insights, context.aiReview);
  },
  generateHotspotReport: () => {
    const context = getProjectInsights(get);
    if (!context) return '';
    return buildHotspotReport(context.insights, context.aiReview);
  },
  generateTaskPackData: (task: string) => {
    const context = getProjectInsights(get);
    if (!context) return null;
    return buildTaskPackData(context.projectData, context.insights, task);
  },
  generateTaskPack: (task: string) => {
    const context = getProjectInsights(get);
    if (!context) return '';
    return buildTaskPack(context.projectData, context.insights, task, context.aiReview);
  },
  generateErrorContextPackData: (rawError: string) => {
    const context = getProjectInsights(get);
    if (!context) return null;
    return buildErrorContextPackData(context.projectData, context.insights, rawError);
  },
  generateErrorContextPack: (rawError: string) => {
    const context = getProjectInsights(get);
    if (!context) return '';
    return buildErrorContextPack(context.projectData, context.insights, rawError);
  },
  generateSemanticSearchResults: (query: string) => {
    const context = getProjectInsights(get);
    if (!context) return null;
    return buildSemanticSearchResults(context.projectData, context.projectName, query);
  },
  generateImpactAnalysisData: (nodeId: string) => {
    const context = getProjectInsights(get);
    if (!context) return null;
    return buildImpactAnalysisData(context.projectData, context.projectName, nodeId);
  },
  generateProjectBrief: () => {
    const { projectData, projectName } = get();
    if (!projectData) return '';
    return generateProjectBriefExport(projectData, projectName || 'Unknown Project');
  },
  generateProjectMetadata: () => {
    const { projectData, projectName } = get();
    if (!projectData) return '';
    return generateProjectMetadataExport(projectData, projectName || 'Unknown Project');
  },
  generateGraphGuide: () => {
    const { projectData, projectName } = get();
    if (!projectData) return '';
    return generateGraphGuideExport(projectData, projectName || 'Unknown Project');
  },
  generateTreeOnly: () => {
    const { projectData, projectName } = get();
    if (!projectData) return '';
    return generateTreeOnlyExport(projectData, projectName || 'Unknown Project');
  }
});
