import { GraphLink, GraphNode, ProjectData } from '../types';
import { createProjectFileResolver, normalizeProjectPath, shouldProcessFile } from '../utils/analysis';

const MAX_GRAPH_FILES = 1500;
const FILE_READ_BATCH_SIZE = 40;
const FILE_SCAN_BATCH_SIZE = 500;

const prioritizeFile = (path: string, name: string) => {
  const normalizedPath = path.toLowerCase();
  const normalizedName = name.toLowerCase();

  if (
    normalizedName === 'main.tsx' ||
    normalizedName === 'main.jsx' ||
    normalizedName === 'app.tsx' ||
    normalizedName === 'app.jsx' ||
    normalizedName === 'main.py' ||
    normalizedName === 'server.js' ||
    normalizedName === 'index.ts' ||
    normalizedName === 'index.js'
  ) {
    return 0;
  }

  if (normalizedPath.includes('/src/') || normalizedPath.includes('/server/')) return 1;
  if (normalizedPath.includes('/components/') || normalizedPath.includes('/store/') || normalizedPath.includes('/utils/')) return 2;
  return 3;
};

const readFileAsText = (file: File) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });

const yieldToBrowser = () =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });

type WorkerInputFile = {
  path: string;
  name: string;
  size: number;
  content: string;
};

type DeepAnalysisResult = {
  path: string;
  dependencies: string[];
};

export const prepareProjectFilesForWorker = async (fileList: FileList) => {
  const firstFile = fileList.item(0);
  if (!firstFile) {
    return {
      projectName: '',
      skippedCount: 0,
      workerInput: [] as WorkerInputFile[]
    };
  }

  const projectName = (firstFile as any).webkitRelativePath.split('/')[0] || 'Project';
  const candidateFiles: { file: File; path: string; name: string; size: number }[] = [];

  for (let index = 0; index < fileList.length; index += FILE_SCAN_BATCH_SIZE) {
    const limit = Math.min(index + FILE_SCAN_BATCH_SIZE, fileList.length);

    for (let innerIndex = index; innerIndex < limit; innerIndex++) {
      const file = fileList.item(innerIndex);
      if (!file) continue;

      const path = (file as any).webkitRelativePath || file.name;
      if (!shouldProcessFile(path, file.size)) continue;

      candidateFiles.push({
        file,
        path,
        name: file.name,
        size: file.size
      });
    }

    await yieldToBrowser();
  }

  candidateFiles.sort((a, b) => {
    const priorityDiff = prioritizeFile(a.path, a.name) - prioritizeFile(b.path, b.name);
    if (priorityDiff !== 0) return priorityDiff;
    return a.path.localeCompare(b.path);
  });

  const selectedCandidates = candidateFiles.slice(0, MAX_GRAPH_FILES);
  const skippedCount = fileList.length - selectedCandidates.length;
  const workerInput: WorkerInputFile[] = [];

  for (let index = 0; index < selectedCandidates.length; index += FILE_READ_BATCH_SIZE) {
    const batch = selectedCandidates.slice(index, index + FILE_READ_BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async ({ file, path, name, size }) => ({
        path,
        name,
        size,
        content: await readFileAsText(file)
      }))
    );

    workerInput.push(...batchResults);
    await yieldToBrowser();
  }

  return {
    projectName,
    skippedCount,
    workerInput
  };
};

export const buildDeepAnalysisGraph = (projectData: ProjectData, analysisResults: DeepAnalysisResult[]) => {
  const newLinks: GraphLink[] = [];
  const importanceMap: Record<string, number> = {};
  const seenLinks = new Set<string>();
  const resolveProjectFile = createProjectFileResolver(projectData.files);

  analysisResults.forEach((result) => {
    result.dependencies.forEach((dep) => {
      const targetFile = resolveProjectFile(dep, result.path);

      if (targetFile && targetFile.id !== result.path) {
        const linkKey = `${normalizeProjectPath(result.path)}::${normalizeProjectPath(targetFile.id)}`;
        if (seenLinks.has(linkKey)) return;
        seenLinks.add(linkKey);
        newLinks.push({ source: result.path, target: targetFile.id });
        importanceMap[targetFile.id] = (importanceMap[targetFile.id] || 0) + 1;
      }
    });
  });

  const newNodes: GraphNode[] = projectData.nodes.map((node) => ({
    ...node,
    size: Math.max(12, Math.min(32, 10 + (importanceMap[node.id] || 0) * 4)),
    data: { ...node.data, importance: importanceMap[node.id] || 0 }
  }));

  return {
    links: newLinks,
    nodes: newNodes
  };
};
