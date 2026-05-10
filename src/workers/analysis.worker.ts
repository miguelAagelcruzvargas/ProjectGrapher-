import { ProjectFile, GraphNode, GraphLink } from '../types';
import { getExtension, findDependencies, shouldProcessFile } from '../utils/analysis';

// Note: In a real Vite setup, you might need to import these differently if they are not worker-compatible.
// But since they are pure logic functions, they should be fine.

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

  for (const file of validFiles) {
    const deps = findDependencies(file.content, file.name);
    for (const depName of deps) {
       // Buscamos si la dependencia coincide con algún archivo del proyecto
       // Limpiamos el nombre de la dep para búsqueda flexible
       const cleanDep = depName.split('/').pop()?.split('.')[0] || depName;
       
       const target = validFiles.find(f => 
          f.id.includes(depName) || 
          f.name.toLowerCase().includes(cleanDep.toLowerCase())
       );

       if (target && target.id !== file.id) {
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
    const pathParts = f.path.split('/');
    const cluster = pathParts.length > 2 ? pathParts.slice(0, -1).join('/') : 'root';
    
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
