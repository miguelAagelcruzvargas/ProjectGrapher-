import { ProjectFile, GraphNode, GraphLink } from '../types';
import { getExtension, findDependencies, shouldProcessFile, createProjectFileResolver, normalizeProjectPath } from '../utils/analysis';

// Note: In a real Vite setup, you might need to import these differently if they are not worker-compatible.
// But since they are pure logic functions, they should be fine.

const getClusterName = (path: string) => {
  const parts = normalizeProjectPath(path).split('/').filter(Boolean);
  if (parts.length <= 1) return 'root';

  const [, ...relativeParts] = parts;
  const primary = relativeParts[0];
  const secondary = relativeParts[1];

  if (!primary) return 'root';
  if (['src', 'server'].includes(primary) && secondary) return `${primary}/${secondary}`;
  return primary;
};

self.onmessage = async (e: MessageEvent<{ files: { path: string, content: string, size: number, name: string }[] }>) => {
  const { files: rawFiles } = e.data;
  const validFiles: ProjectFile[] = [];
  let skippedCount = 0;

  // 1. Filter and process content
  for (const file of rawFiles) {
    if (!shouldProcessFile(file.path, file.size)) {
      skippedCount++;
      continue;
    }

    if (validFiles.length >= 1500) {
      skippedCount += rawFiles.length - validFiles.length - skippedCount;
      break;
    }

    validFiles.push({
      id: file.path,
      name: file.name,
      path: file.path,
      content: file.content,
      ext: getExtension(file.name),
      size: file.size,
      importance: 0
    });
  }

  // 2. Initial state (Calculamos links rápidos por Regex como base)
  const links: GraphLink[] = [];
  const importanceMap: Record<string, number> = {};
  const seenLinks = new Set<string>();
  const resolveProjectFile = createProjectFileResolver(validFiles);

  for (const file of validFiles) {
    const deps = findDependencies(file.content, file.name);
    for (const depName of deps) {
       const target = resolveProjectFile(depName, file.path);

       if (target && target.id !== file.id) {
          const sourceId = normalizeProjectPath(file.id);
          const targetId = normalizeProjectPath(target.id);
          const linkKey = `${sourceId}::${targetId}`;

          if (seenLinks.has(linkKey)) {
            continue;
          }

          seenLinks.add(linkKey);
          links.push({
             source: file.id,
             target: target.id
          });
          importanceMap[target.id] = (importanceMap[target.id] || 0) + 1;
       }
    }
  }

  // 3. Create Nodes
  const nodes: GraphNode[] = validFiles.map(f => {
    const cluster = getClusterName(f.path);
    
    let hash = 0;
    for (let i = 0; i < f.id.length; i++) {
      hash = ((hash << 5) - hash) + f.id.charCodeAt(i);
      hash |= 0; 
    }
    const posX = 400 + (hash % 200);
    const posY = 300 + ((hash >> 8) % 150);

    return {
      id: f.id,
      label: f.name,
      group: f.ext,
      cluster: cluster,
      size: Math.max(12, Math.min(32, 10 + (importanceMap[f.id] || 0) * 4)),
      data: { ...f, importance: importanceMap[f.id] || 0 },
      x: posX,
      y: posY
    };
  });

  self.postMessage({ projectData: { files: validFiles, nodes, links }, skippedCount });
};
