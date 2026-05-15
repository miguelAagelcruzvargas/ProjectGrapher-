import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calculateAAMetrics } from '../utils/analysis';
import { useProjectStore } from '../store/useProjectStore';

export function useAppController() {
  const {
    projectData, skippedCount, selectedNode, smartDiffData, projectMemory, isProcessing, isReviewing,
    searchQuery, treeSearch, activeTab, isFocusMode, aiReview, aiError,
    showFileModal, showIAModal,
    setProjectData, setSelectedNode, setSearchQuery, setTreeSearch,
    setActiveTab, setIsFocusMode, processFiles, loadLastProject,
    generateAIReview, generateAIContext, generateExecutiveView, generateSystemView, generateHotspotReport, generateTaskPackData, generateTaskPack, generateErrorContextPackData, generateErrorContextPack, generateSemanticSearchResults, generateImpactAnalysisData, generateProjectBrief, generateProjectMetadata, generateGraphGuide, generateTreeOnly, setShowFileModal, setShowIAModal,
    generateAIVisionDocument, generateAIArchitectureNarrative, generateAIRefactorPriorities, generateAIAgentHandoff,
    aiProvider, aiModel, customUrl, customKey, envKeys, checkEnvKeys,
    setAiProvider, setAiModel, setCustomUrl, setCustomKey, setProjectGlobalMemory, setProjectFileMemory, projectName,
    closeProject
  } = useProjectStore();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [graphDensityMode, setGraphDensityMode] = useState<'auto' | 'focused' | 'expanded'>('auto');
  const [agentTask, setAgentTask] = useState('Ajusta el perfil del usuario y encuentra los archivos que debo modificar.');
  const [errorTraceInput, setErrorTraceInput] = useState('TypeError: Cannot read properties of undefined (reading \'map\')\n    at src/components/GraphCanvas.tsx:128:18\n    at src/App.tsx:512:7');
  const [semanticQuery, setSemanticQuery] = useState('dónde vive autenticación');
  const [exportSection, setExportSection] = useState<'guided' | 'task' | 'errors' | 'ai' | 'exports'>('guided');
  const [isSavingAIDocs, setIsSavingAIDocs] = useState(false);
  const [aiDocsSaveStatus, setAIDocsSaveStatus] = useState<string | null>(null);
  const lastAutoSavedReviewRef = useRef<string | null>(null);

  useEffect(() => {
    loadLastProject();
    checkEnvKeys();
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const updateLayout = () => {
      const desktop = media.matches;
      setIsDesktopLayout(desktop);
      if (desktop) {
        setShowMobilePanel(false);
      }
    };

    updateLayout();
    media.addEventListener('change', updateLayout);
    return () => media.removeEventListener('change', updateLayout);
  }, []);

  const hasServerKey = !!envKeys[aiProvider];
  const hasEffectiveKey = aiProvider === 'ollama' || !!customKey || hasServerKey;
  const aiReady = hasEffectiveKey && !!projectData;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedNode(null);
        setIsFocusMode(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [setSelectedNode, setIsFocusMode]);

  const filteredNodes = useMemo(() => {
    if (!projectData) return [];
    let baseNodes = projectData.nodes;

    if (searchQuery) {
      baseNodes = baseNodes.filter((node) =>
        node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        node.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (isFocusMode && selectedNode) {
      const neighbors = new Set<string>([selectedNode.id]);
      projectData.links.forEach((link: any) => {
        const sId = typeof link.source === 'string' ? link.source : (link.source as any).id;
        const tId = typeof link.target === 'string' ? link.target : (link.target as any).id;
        if (sId === selectedNode.id) neighbors.add(tId);
        if (tId === selectedNode.id) neighbors.add(sId);
      });
      return baseNodes.filter((node) => neighbors.has(node.id));
    }

    return baseNodes;
  }, [projectData, searchQuery, isFocusMode, selectedNode]);

  const architectureMetrics = useMemo(() => {
    if (!projectData) return null;
    return calculateAAMetrics(projectData.files, projectData.links);
  }, [projectData]);

  const handleGraphNodeClick = useCallback((node: any) => {
    setSelectedNode(node);
    setShowFileModal(true);
  }, [setSelectedNode, setShowFileModal]);

  const getAIDocumentExports = useCallback(() => {
    if (!aiReview) return [];

    return [
      { filename: `${projectName}_vision_ai.md`, content: generateAIVisionDocument() },
      { filename: `${projectName}_architecture_narrative_ai.md`, content: generateAIArchitectureNarrative() },
      { filename: `${projectName}_refactor_priorities_ai.md`, content: generateAIRefactorPriorities() },
      { filename: `${projectName}_agent_handoff_ai.md`, content: generateAIAgentHandoff(agentTask) }
    ].filter((file) => file.content.trim().length > 0);
  }, [
    aiReview,
    projectName,
    agentTask,
    generateAIVisionDocument,
    generateAIArchitectureNarrative,
    generateAIRefactorPriorities,
    generateAIAgentHandoff
  ]);

  const saveFilesToContext = useCallback(async (files: { filename: string; content: string }[], mode: 'auto' | 'manual' = 'manual') => {
    if (!files.length) return;

    setIsSavingAIDocs(true);
    if (mode === 'manual') {
      setAIDocsSaveStatus(null);
    }

    try {
      const response = await fetch('/api/context/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName, files })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || 'No se pudieron guardar los documentos IA en contexto/');
      }

      const targetDirectory = payload.relative_directory || 'contexto/';
      setAIDocsSaveStatus(`Guardados en ${targetDirectory}: ${payload.saved.join(', ')}`);
    } catch (error: any) {
      console.error('Error saving AI docs to contexto:', error);
      setAIDocsSaveStatus(error.message || 'No se pudieron guardar los documentos IA en contexto/');
    } finally {
      setIsSavingAIDocs(false);
    }
  }, [projectName]);

  useEffect(() => {
    if (!aiReview) {
      lastAutoSavedReviewRef.current = null;
      return;
    }

    if (lastAutoSavedReviewRef.current === aiReview) {
      return;
    }

    const files = getAIDocumentExports();
    if (!files.length) return;

    lastAutoSavedReviewRef.current = aiReview;
    void saveFilesToContext(files, 'auto');
  }, [aiReview, getAIDocumentExports, saveFilesToContext]);

  const handleDownloadFile = useCallback((content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const openPanelTab = useCallback((tab: 'details' | 'context' | 'files' | 'ia' | 'settings') => {
    setActiveTab(tab);
    if (!isDesktopLayout) {
      setShowMobilePanel(true);
    }
  }, [isDesktopLayout, setActiveTab]);

  const isContextTab = activeTab === 'context';
  const isDetailsTab = activeTab === 'details';
  const taskPackData = useMemo(() => (
    isContextTab && exportSection === 'task' ? generateTaskPackData(agentTask) : null
  ), [isContextTab, exportSection, generateTaskPackData, agentTask]);
  const taskPackPreview = useMemo(() => (
    isContextTab && exportSection === 'task' ? generateTaskPack(agentTask) : ''
  ), [isContextTab, exportSection, generateTaskPack, agentTask]);
  const errorContextPackData = useMemo(() => (
    isContextTab && exportSection === 'errors' ? generateErrorContextPackData(errorTraceInput) : null
  ), [isContextTab, exportSection, generateErrorContextPackData, errorTraceInput]);
  const errorContextPackPreview = useMemo(() => (
    isContextTab && exportSection === 'errors' ? generateErrorContextPack(errorTraceInput) : ''
  ), [isContextTab, exportSection, generateErrorContextPack, errorTraceInput]);
  const semanticSearchResults = useMemo(() => (
    isContextTab && exportSection === 'guided' ? generateSemanticSearchResults(semanticQuery) : null
  ), [isContextTab, exportSection, generateSemanticSearchResults, semanticQuery]);
  const impactAnalysisData = useMemo(() => (
    isDetailsTab && selectedNode ? generateImpactAnalysisData(selectedNode.id) : null
  ), [isDetailsTab, selectedNode, generateImpactAnalysisData]);
  const architectureSnapshot = useMemo(() => (
    generateAIContext()
  ), [generateAIContext]);
  const architectureSnapshotPreview = useMemo(() => (
    architectureSnapshot.split('\n').slice(0, 32).join('\n')
  ), [architectureSnapshot]);
  const architectureSnapshotTokenEstimate = useMemo(() => (
    Math.round(architectureSnapshot.length / 4)
  ), [architectureSnapshot]);
  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(architectureSnapshot);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [architectureSnapshot]);
  const activeProjectMemory = projectMemory[projectName || ''] || { globalNote: '', fileNotes: {} };
  const selectedNodeMemory = selectedNode ? (activeProjectMemory.fileNotes[selectedNode.id] || '') : '';

  const focusNodeByProjectPath = useCallback((projectPath: string) => {
    if (!projectData || !projectPath) return;

    const normalized = projectPath.replace(/\\/g, '/').toLowerCase();
    const projectPrefix = `${(projectName || '').replace(/\\/g, '/').toLowerCase()}/`;
    const relativePath = normalized.startsWith(projectPrefix) ? normalized.slice(projectPrefix.length) : normalized;

    const node = projectData.nodes.find((item) => {
      const nodePath = item.id.replace(/\\/g, '/').toLowerCase();
      return nodePath === relativePath || nodePath === normalized || normalized.endsWith(`/${nodePath}`);
    });

    if (!node) return;
    setSelectedNode(node);
    setIsFocusMode(true);
    setActiveTab('details');
  }, [projectData, projectName, setActiveTab, setIsFocusMode, setSelectedNode]);

  return {
    projectData,
    skippedCount,
    selectedNode,
    smartDiffData,
    projectMemory,
    isProcessing,
    isReviewing,
    searchQuery,
    treeSearch,
    activeTab,
    isFocusMode,
    aiReview,
    aiError,
    showFileModal,
    showIAModal,
    setProjectData,
    setSelectedNode,
    setSearchQuery,
    setTreeSearch,
    setActiveTab,
    setIsFocusMode,
    processFiles,
    loadLastProject,
    generateAIReview,
    generateAIContext,
    generateExecutiveView,
    generateSystemView,
    generateHotspotReport,
    generateTaskPackData,
    generateTaskPack,
    generateErrorContextPackData,
    generateErrorContextPack,
    generateSemanticSearchResults,
    generateImpactAnalysisData,
    generateProjectBrief,
    generateProjectMetadata,
    generateGraphGuide,
    generateTreeOnly,
    setShowFileModal,
    setShowIAModal,
    generateAIVisionDocument,
    generateAIArchitectureNarrative,
    generateAIRefactorPriorities,
    generateAIAgentHandoff,
    aiProvider,
    aiModel,
    customUrl,
    customKey,
    envKeys,
    checkEnvKeys,
    setAiProvider,
    setAiModel,
    setCustomUrl,
    setCustomKey,
    setProjectGlobalMemory,
    setProjectFileMemory,
    projectName,
    closeProject,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    copied,
    showSettingsModal,
    setShowSettingsModal,
    isDesktopLayout,
    showMobilePanel,
    setShowMobilePanel,
    graphDensityMode,
    setGraphDensityMode,
    agentTask,
    setAgentTask,
    errorTraceInput,
    setErrorTraceInput,
    semanticQuery,
    setSemanticQuery,
    exportSection,
    setExportSection,
    isSavingAIDocs,
    aiDocsSaveStatus,
    setAIDocsSaveStatus,
    hasServerKey,
    hasEffectiveKey,
    aiReady,
    filteredNodes,
    architectureMetrics,
    handleGraphNodeClick,
    saveFilesToContext,
    handleDownloadFile,
    copyToClipboard,
    openPanelTab,
    taskPackData,
    taskPackPreview,
    errorContextPackData,
    errorContextPackPreview,
    semanticSearchResults,
    impactAnalysisData,
    architectureSnapshot,
    architectureSnapshotPreview,
    architectureSnapshotTokenEstimate,
    activeProjectMemory,
    selectedNodeMemory,
    focusNodeByProjectPath
  };
}
