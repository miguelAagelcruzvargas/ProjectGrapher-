
import React, { memo, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphLink } from '../types';

interface GraphCanvasProps {
  nodes: GraphNode[];
  links: GraphLink[];
  onNodeClick: (node: GraphNode) => void;
  selectedNodeId: string | null;
  isFocusMode: boolean;
  graphDensityMode: 'auto' | 'focused' | 'expanded';
}

const GraphCanvasComponent: React.FC<GraphCanvasProps> = ({ nodes, links, onNodeClick, selectedNodeId, isFocusMode, graphDensityMode }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const simulationRef = useRef<d3.Simulation<GraphNode, undefined> | null>(null);
  const nodeSelectionRef = useRef<d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null);
  const linkSelectionRef = useRef<d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null>(null);
  const svgSelectionRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const connectedNodeMapRef = useRef<Map<string, Set<string>>>(new Map());
  const positionCacheRef = useRef<Map<string, { x?: number; y?: number; vx?: number; vy?: number }>>(new Map());

  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (!containerRef.current) return;
      const nextWidth = containerRef.current.clientWidth;
      const nextHeight = containerRef.current.clientHeight;
      setContainerSize((current) => {
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);
    window.addEventListener('orientationchange', updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', updateSize);
    };
  }, []);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const isPhone = width < 640;
    const isCompact = width < 900;
    const isTablet = width < 1200;
    const isTouchLayout = isTablet;
    const horizontalPadding = isPhone ? 18 : isCompact ? 28 : isTablet ? 40 : 48;
    const verticalPadding = isPhone ? 26 : isCompact ? 34 : isTablet ? 44 : 48;
    const labelOffset = isPhone ? 14 : 16;
    const labelBottomPadding = isPhone ? 26 : 30;
    const mobileLabelImportanceThreshold = isPhone ? 3 : 2;
    const importanceValues = nodes.map((node) => node.data.importance || 0);
    const maxImportance = Math.max(...importanceValues, 1);
    const highImportanceThreshold = Math.max(5, Math.ceil(maxImportance * 0.45));
    const mediumImportanceThreshold = Math.max(2, Math.ceil(maxImportance * 0.2));
    const visibleNodeIds = new Set(nodes.map((node) => node.id));
    const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
    const activeLinks = links.filter((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });
    const connectedNodeMap = new Map<string, Set<string>>();
    const isLargeGraph = nodes.length > 120 || activeLinks.length > 220;
    const effectiveDensityMode = graphDensityMode === 'auto'
      ? (isLargeGraph ? 'focused' : 'expanded')
      : graphDensityMode;
    const showArrowheads = !isCompact && !isLargeGraph;
    const simulationTicksPerFrame = isLargeGraph ? 2 : 1;

    activeLinks.forEach((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;

      if (!connectedNodeMap.has(sourceId)) connectedNodeMap.set(sourceId, new Set<string>());
      if (!connectedNodeMap.has(targetId)) connectedNodeMap.set(targetId, new Set<string>());

      connectedNodeMap.get(sourceId)!.add(targetId);
      connectedNodeMap.get(targetId)!.add(sourceId);
    });
    const clusterNames = Array.from(new Set(nodes.map((node) => node.cluster || 'root'))).sort();
    const clusterTargets = new Map<string, { x: number; y: number }>();
    const effectiveClusterCount = Math.max(clusterNames.length, 1);
    const orbitRadiusX = Math.max(width * (isPhone ? 0.22 : isCompact ? 0.26 : 0.3), 70);
    const orbitRadiusY = Math.max(height * (isPhone ? 0.18 : isCompact ? 0.2 : 0.24), 54);

    clusterNames.forEach((clusterName, index) => {
      if (clusterName === 'root') {
        clusterTargets.set(clusterName, { x: width / 2, y: height / 2 });
        return;
      }

      const angle = (-Math.PI / 2) + ((Math.PI * 2) * index) / effectiveClusterCount;
      clusterTargets.set(clusterName, {
        x: width / 2 + Math.cos(angle) * orbitRadiusX,
        y: height / 2 + Math.sin(angle) * orbitRadiusY
      });
    });

    nodes.forEach((node) => {
      const cached = positionCacheRef.current.get(node.id);
      if (!cached) return;
      if (Number.isFinite(cached.x)) node.x = cached.x;
      if (Number.isFinite(cached.y)) node.y = cached.y;
      if (Number.isFinite(cached.vx)) node.vx = cached.vx;
      if (Number.isFinite(cached.vy)) node.vy = cached.vy;
    });

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svgSelectionRef.current = svg;

    const defs = svg.append('defs');

    const backgroundGradient = defs.append('radialGradient')
      .attr('id', 'graph-background-gradient')
      .attr('cx', '50%')
      .attr('cy', '45%')
      .attr('r', '75%');

    backgroundGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#0f172a');

    backgroundGradient.append('stop')
      .attr('offset', '58%')
      .attr('stop-color', '#08101f');

    backgroundGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#040812');

    const vignetteGradient = defs.append('radialGradient')
      .attr('id', 'graph-vignette-gradient')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '70%');

    vignetteGradient.append('stop')
      .attr('offset', '50%')
      .attr('stop-color', 'rgba(0, 0, 0, 0)');

    vignetteGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', 'rgba(2, 6, 23, 0.58)');

    defs.append('filter')
      .attr('id', 'soft-glow')
      .append('feGaussianBlur')
      .attr('stdDeviation', isCompact ? 8 : 12);

    svg.append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', 'url(#graph-background-gradient)');

    svg.append('rect')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('fill', 'url(#graph-vignette-gradient)')
      .style('pointer-events', 'none');

    const g = svg.append('g');

    const clusterAtmosphereGroup = g.append('g')
      .attr('class', 'cluster-atmosphere')
      .style('pointer-events', 'none');

    // Arrowhead definition
    if (showArrowheads) {
      defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('xoverflow', 'visible')
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
      .attr('fill', '#4b5563')
      .style('stroke', 'none');
    }

    // Zoom setup
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.18, 8])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Forces
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(activeLinks)
        .id(d => d.id)
        .distance(d => {
          const sNode = nodeById.get(typeof d.source === 'string' ? d.source : d.source.id);
          const tNode = nodeById.get(typeof d.target === 'string' ? d.target : d.target.id);
          return sNode?.cluster === tNode?.cluster
            ? (isPhone ? 52 : isCompact ? 66 : isTablet ? 86 : 110)
            : (isPhone ? 110 : isCompact ? 136 : isTablet ? 180 : 250);
        })
        .strength(d => {
           const sNode = nodeById.get(typeof d.source === 'string' ? d.source : d.source.id);
           const tNode = nodeById.get(typeof d.target === 'string' ? d.target : d.target.id);
           return sNode?.cluster === tNode?.cluster ? 0.9 : (isTouchLayout ? 0.18 : 0.24);
        }))
      .force('charge', d3.forceManyBody().strength(
        isLargeGraph
          ? (isPhone ? -120 : isCompact ? -180 : isTablet ? -220 : -320)
          : (isPhone ? -180 : isCompact ? -260 : isTablet ? -340 : -600)
      ))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX((d) => clusterTargets.get((d as GraphNode).cluster || 'root')?.x ?? width / 2).strength(isPhone ? 0.36 : isCompact ? 0.3 : isTablet ? 0.22 : 0.12))
      .force('y', d3.forceY((d) => clusterTargets.get((d as GraphNode).cluster || 'root')?.y ?? height / 2).strength(isPhone ? 0.32 : isCompact ? 0.28 : isTablet ? 0.2 : 0.12))
      .force('radial', d3.forceRadial(0, width / 2, height / 2).strength(d => {
        return (d as GraphNode).data.importance > 10 ? (isPhone ? 0.05 : isCompact ? 0.07 : 0.1) : (isLargeGraph ? 0.004 : 0.008);
      }))
      .force('collision', d3.forceCollide().radius(d => {
        const node = d as GraphNode;
        const labelRoom = (!isCompact || node.id === selectedNodeId || node.data.importance >= mobileLabelImportanceThreshold) ? (isLargeGraph ? 8 : 14) : 6;
        return node.size + (isPhone ? 12 : isCompact ? 16 : isTablet ? 24 : (isLargeGraph ? 22 : 40)) + labelRoom;
      }).iterations(isLargeGraph ? 2 : (isPhone ? 3 : 4)))
      .force('cluster', (alpha: number) => {
        nodes.forEach(n => {
          const target = clusterTargets.get(n.cluster || 'root');
          if (!target) return;
          n.vx = (n.vx || 0) + (target.x - (n.x || 0)) * alpha * (isTouchLayout ? 0.18 : 0.12);
          n.vy = (n.vy || 0) + (target.y - (n.y || 0)) * alpha * (isTouchLayout ? 0.18 : 0.12);
        });
      });
    simulation.velocityDecay(isLargeGraph ? 0.42 : 0.32);
    simulation.alphaDecay(isLargeGraph ? 0.06 : 0.035);
    simulationRef.current = simulation;

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(activeLinks)
      .enter().append('line')
      .attr('stroke', '#334155')
      .attr('stroke-width', d => {
        const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
        const targetId = typeof d.target === 'string' ? d.target : d.target.id;
        const sourceImportance = nodeById.get(sourceId)?.data.importance || 0;
        const targetImportance = nodeById.get(targetId)?.data.importance || 0;
        const connectionImportance = Math.max(sourceImportance, targetImportance);
        return connectionImportance >= highImportanceThreshold ? 1.2 : 0.9;
      })
      .attr('stroke-opacity', d => {
        const sourceId = typeof d.source === 'string' ? d.source : d.source.id;
        const targetId = typeof d.target === 'string' ? d.target : d.target.id;
        const sourceImportance = nodeById.get(sourceId)?.data.importance || 0;
        const targetImportance = nodeById.get(targetId)?.data.importance || 0;
        const connectionImportance = Math.max(sourceImportance, targetImportance);
        return connectionImportance >= highImportanceThreshold
          ? (isCompact ? 0.24 : 0.32)
          : (isCompact ? 0.14 : 0.2);
      })
      .attr('marker-end', showArrowheads ? 'url(#arrowhead)' : null);
    linkSelectionRef.current = link;

    // Nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        onNodeClick(d);
      })
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', (event) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          event.subject.fx = event.subject.x;
          event.subject.fy = event.subject.y;
        })
        .on('drag', (event) => {
          event.subject.fx = event.x;
          event.subject.fy = event.y;
        })
        .on('end', (event) => {
          if (!event.active) simulation.alphaTarget(0);
          event.subject.fx = null;
          event.subject.fy = null;
        }) as any);
    nodeSelectionRef.current = node;

    node.append('circle')
      .attr('r', d => d.size + (d.data.importance >= highImportanceThreshold ? 6 : 4))
      .attr('fill', d => withAlpha(getNodeFillColor(d, selectedNodeId, highImportanceThreshold, mediumImportanceThreshold), d.id === selectedNodeId ? 0.18 : d.data.importance >= highImportanceThreshold ? 0.12 : 0.06))
      .attr('class', 'node-depth-halo')
      .style('pointer-events', 'none');

    node.append('circle')
      .attr('r', d => Math.max(2, d.size - 1.8))
      .attr('fill', d => withAlpha('#ffffff', d.id === selectedNodeId ? 0.2 : d.data.importance >= highImportanceThreshold ? 0.12 : 0.05))
      .attr('cy', d => -Math.max(1.2, d.size * 0.18))
      .style('pointer-events', 'none');

    // Node Circles
    node.append('circle')
      .attr('r', d => d.size)
      .attr('fill', d => getNodeFillColor(d, selectedNodeId, highImportanceThreshold, mediumImportanceThreshold))
      .attr('stroke', d => getNodeStrokeColor(d, selectedNodeId, highImportanceThreshold, mediumImportanceThreshold))
      .attr('stroke-width', d => d.id === selectedNodeId ? 3 : d.data.importance >= highImportanceThreshold ? 2.6 : 2)
      .style('filter', d => d.id === selectedNodeId ? 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.6))' : 'drop-shadow(0 2px 5px rgba(0, 0, 0, 0.22))');

    // Importance Aura (for highly connected nodes)
    node.filter(d => d.data.importance >= highImportanceThreshold)
      .append('circle')
      .attr('r', d => d.size + 4)
      .attr('fill', 'none')
      .attr('stroke', d => getNodeStrokeColor(d, selectedNodeId, highImportanceThreshold, mediumImportanceThreshold))
      .attr('stroke-opacity', 0.28)
      .attr('stroke-width', 1.2);

    // Labels
    node.append('text')
      .attr('dy', d => d.size + labelOffset)
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.id === selectedNodeId ? '#fff' : d.data.importance >= highImportanceThreshold ? '#e8eef9' : '#9ca3af')
      .attr('font-size', isPhone ? '7px' : isCompact ? '8px' : '10px')
      .attr('font-weight', d => d.id === selectedNodeId || d.data.importance >= highImportanceThreshold ? 'bold' : 'normal')
      .attr('font-family', 'var(--font-mono)')
      .text(d => d.label)
      .style('pointer-events', 'none')
      .attr('opacity', d => {
        if (effectiveDensityMode === 'focused') {
          if (d.id === selectedNodeId) return 1;
          return d.data.importance >= highImportanceThreshold ? 0.96 : 0;
        }
        if (effectiveDensityMode === 'expanded') {
          if (d.id === selectedNodeId) return 1;
          if (isCompact) return d.data.importance >= mediumImportanceThreshold ? 0.88 : 0;
          return 1;
        }
        if (isLargeGraph) {
          if (d.id === selectedNodeId) return 1;
          return d.data.importance >= Math.max(mobileLabelImportanceThreshold, 5) ? 0.92 : 0;
        }
        if (!isCompact) return 1;
        if (d.id === selectedNodeId) return 1;
        return d.data.importance >= mobileLabelImportanceThreshold ? 0.94 : 0;
      })
      .style('text-shadow', '0 1px 2px rgba(0,0,0,0.8)');

    // Interaction Effects: Highlight connected edges
    const updateHighlights = () => {
      // Create a grayscale filter if it doesn't exist
      if (svg.select('#grayscale').empty()) {
        svg.append('defs').append('filter').attr('id', 'grayscale')
          .append('feColorMatrix')
          .attr('type', 'matrix')
          .attr('values', '0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0 0 0 1 0');
      }

      const activeFocusId = selectedNodeId;

      if (!activeFocusId) {
        link.transition().duration(500)
          .attr('stroke', '#374151')
          .attr('stroke-opacity', 0.3)
          .attr('stroke-width', 1);
        node.transition().duration(500)
          .attr('opacity', 1)
          .style('filter', 'none');
        node.selectAll('text').transition().duration(500).attr('opacity', 1);
        
        svg.select('.focus-overlay').transition().duration(500).attr('opacity', 0);
        return;
      }

      // Add a dark immersive overlay if it doesn't exist
      if (svg.select('.focus-overlay').empty()) {
        svg.insert('rect', ':first-child')
          .attr('class', 'focus-overlay')
          .attr('width', '100%')
          .attr('height', '100%')
          .attr('fill', '#000')
          .attr('opacity', 0)
          .style('pointer-events', 'none');
      }

      svg.select('.focus-overlay')
        .transition().duration(500)
        .attr('opacity', isFocusMode ? 0.85 : 0.4);

      const connectedNodes = new Set<string>([
        activeFocusId,
        ...(connectedNodeMap.get(activeFocusId) || new Set<string>())
      ]);

      link.each(function(l: any) {
        const sId = l.source.id || l.source;
        const tId = l.target.id || l.target;
        const isConnected = sId === activeFocusId || tId === activeFocusId;
        d3.select(this)
          .transition().duration(300)
          .attr('stroke', isConnected ? '#6366f1' : '#111827')
          .attr('stroke-opacity', isConnected ? (isFocusMode ? 1 : 0.8) : 0.05)
          .attr('stroke-width', isConnected ? (isFocusMode ? 2.5 : 2) : 0.5);
      });

      node.transition().duration(300)
        .attr('opacity', (d: any) => connectedNodes.has(d.id) ? 1 : (isFocusMode ? 0.05 : 0.1))
        .style('filter', (d: any) => {
          if (d.id === activeFocusId) return 'drop-shadow(0 0 15px rgba(99, 102, 241, 0.8))';
          return connectedNodes.has(d.id) ? 'none' : 'url(#grayscale)';
        });

      // Hide text for non-connected nodes to reduce clutter
      node.selectAll('text')
        .transition().duration(300)
        .attr('opacity', (d: any) => connectedNodes.has(d.id) ? 1 : 0);
    };

    connectedNodeMapRef.current = connectedNodeMap;
    updateHighlights();

    // Cluster labels group
    const clusterLabelGroup = g.append('g').attr('class', 'cluster-labels');

    const fitGraphToViewport = (animate: boolean) => {
      if (!nodes.length) return;

      const positionedNodes = nodes.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y));
      if (!positionedNodes.length) return;

      const minX = d3.min(positionedNodes, (node) => (node.x ?? 0) - node.size - 10) ?? 0;
      const maxX = d3.max(positionedNodes, (node) => (node.x ?? 0) + node.size + 10) ?? width;
      const minY = d3.min(positionedNodes, (node) => (node.y ?? 0) - node.size - 24) ?? 0;
      const maxY = d3.max(positionedNodes, (node) => (node.y ?? 0) + node.size + labelBottomPadding) ?? height;

      const boundsWidth = Math.max(maxX - minX, 1);
      const boundsHeight = Math.max(maxY - minY, 1);
      const scale = Math.max(
        0.18,
        Math.min(
          isPhone ? 2.6 : isCompact ? 2.2 : isTablet ? 1.9 : 1.3,
          0.98 / Math.max(boundsWidth / Math.max(width - horizontalPadding * 2, 1), boundsHeight / Math.max(height - verticalPadding * 2, 1))
        )
      );

      const targetX = width / 2 - ((minX + maxX) / 2) * scale;
      const targetY = height / 2 - ((minY + maxY) / 2) * scale;
      const transform = d3.zoomIdentity.translate(targetX, targetY).scale(scale);

      if (animate) {
        svg.transition().duration(450).call(zoom.transform, transform);
        return;
      }

      svg.call(zoom.transform, transform);
    };

    let hasAutoFitted = false;
    
    let frameCount = 0;
    let rafId: number | null = null;
    const renderFrame = () => {
      // Update links
      link
        .attr('x1', (d: any) => d.source.x!)
        .attr('y1', (d: any) => d.source.y!)
        .attr('x2', (d: any) => d.target.x!)
        .attr('y2', (d: any) => d.target.y!);

      // Update nodes
      node.attr('transform', (d: any) => `translate(${d.x}, ${d.y})`);

      // Update cluster labels
      const centroids: Record<string, { x: number, y: number, count: number }> = {};
      nodes.forEach(n => {
        if (!n.cluster) return;
        if (!centroids[n.cluster]) centroids[n.cluster] = { x: 0, y: 0, count: 0 };
        centroids[n.cluster].x += n.x || 0;
        centroids[n.cluster].y += n.y || 0;
        centroids[n.cluster].count++;
      });
      
      const clusterData = Object.entries(centroids).map(([name, c]) => ({
        name,
        x: Math.min(Math.max(c.x / c.count, horizontalPadding), width - horizontalPadding),
        y: Math.max(verticalPadding * 0.72, (c.y / c.count) - (isCompact ? 34 : 60))
      })).filter(c => c.name !== 'root');

      const atmosphere = clusterAtmosphereGroup.selectAll<SVGCircleElement, any>('circle')
        .data(clusterData, d => d.name);

      atmosphere.enter().append('circle')
        .attr('fill', d => withAlpha(getClusterColor(d.name), isCompact ? 0.08 : 0.12))
        .attr('filter', 'url(#soft-glow)')
        .merge(atmosphere as any)
        .attr('cx', d => d.x)
        .attr('cy', d => d.y + (isCompact ? 26 : 40))
        .attr('r', d => {
          const clusterCount = centroids[d.name]?.count || 1;
          const baseRadius = isCompact ? 28 : 44;
          return baseRadius + Math.min(clusterCount * (isCompact ? 1.8 : 2.6), isCompact ? 44 : 72);
        });

      atmosphere.exit().remove();
      
      const labels = clusterLabelGroup.selectAll<SVGTextElement, any>('text')
        .data(clusterData, d => d.name);
        
      labels.enter().append('text')
        .attr('text-anchor', 'middle')
        .attr('fill', '#4b5563')
        .attr('font-size', isCompact ? '10px' : '14px')
        .attr('font-weight', 'bold')
        .attr('font-family', 'var(--font-display)')
        .attr('opacity', isCompact ? 0.28 : 0.4)
        .attr('pointer-events', 'none')
        .merge(labels as any)
        .attr('x', d => d.x)
        .attr('y', d => d.y)
        .text(d => d.name);

      labels.exit().remove();

      if (!hasAutoFitted && simulation.alpha() < 0.18) {
        hasAutoFitted = true;
        fitGraphToViewport(true);
      }
    };

    simulation.on('tick', () => {
      frameCount += 1;
      if (frameCount % simulationTicksPerFrame !== 0) return;
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        renderFrame();
      });
    });

    const fallbackFit = window.setTimeout(() => {
      if (!hasAutoFitted) {
        hasAutoFitted = true;
        fitGraphToViewport(false);
      }
    }, isCompact ? 350 : 200);

    simulation.alpha(0.9).restart();

    return () => {
      nodes.forEach((graphNode) => {
        positionCacheRef.current.set(graphNode.id, {
          x: graphNode.x,
          y: graphNode.y,
          vx: graphNode.vx,
          vy: graphNode.vy
        });
      });
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.clearTimeout(fallbackFit);
      simulation.stop();
    };
  }, [nodes, links, onNodeClick, containerSize]);

  useEffect(() => {
    const svg = svgSelectionRef.current;
    const node = nodeSelectionRef.current;
    const link = linkSelectionRef.current;
    const connectedNodeMap = connectedNodeMapRef.current;
    const importanceValues = nodes.map((graphNode) => graphNode.data.importance || 0);
    const maxImportance = Math.max(...importanceValues, 1);
    const highImportanceThreshold = Math.max(5, Math.ceil(maxImportance * 0.45));
    const mediumImportanceThreshold = Math.max(2, Math.ceil(maxImportance * 0.2));
    const isCompact = containerSize.width < 900;
    const isLargeGraph = nodes.length > 120 || links.length > 220;
    const effectiveDensityMode = graphDensityMode === 'auto'
      ? (isLargeGraph ? 'focused' : 'expanded')
      : graphDensityMode;

    if (!svg || !node || !link) return;

    const updateHighlights = () => {
      if (svg.select('#grayscale').empty()) {
        svg.append('defs').append('filter').attr('id', 'grayscale')
          .append('feColorMatrix')
          .attr('type', 'matrix')
          .attr('values', '0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0 0 0 1 0');
      }

      const activeFocusId = selectedNodeId;

      if (!activeFocusId) {
        link.interrupt().transition().duration(180)
          .attr('stroke', '#374151')
          .attr('stroke-opacity', 0.3)
          .attr('stroke-width', 1);
        node.selectAll('circle').interrupt().transition().duration(180)
          .attr('stroke', (_d: any, index: number, groups: any[]) => {
            const current = d3.select(groups[index].parentNode).datum() as GraphNode;
            return getNodeStrokeColor(current, selectedNodeId, highImportanceThreshold, mediumImportanceThreshold);
          })
          .attr('stroke-width', (_d: any, index: number, groups: any[]) => {
            const current = d3.select(groups[index].parentNode).datum() as GraphNode;
            return current.id === selectedNodeId ? 3 : current.data.importance >= highImportanceThreshold ? 2.6 : 2;
          });
        node.interrupt().transition().duration(180)
          .attr('opacity', 1)
          .style('filter', 'none');
        node.selectAll('text').interrupt().transition().duration(180).attr('opacity', (d: any) => {
          if (effectiveDensityMode === 'focused') {
            if (d.id === selectedNodeId) return 1;
            return d.data.importance >= highImportanceThreshold ? 0.96 : 0;
          }
          if (effectiveDensityMode === 'expanded') {
            if (d.id === selectedNodeId) return 1;
            if (isCompact) return d.data.importance >= mediumImportanceThreshold ? 0.88 : 0;
            return 1;
          }
          return 1;
        });
        svg.select('.focus-overlay').interrupt().transition().duration(180).attr('opacity', 0);
        return;
      }

      if (svg.select('.focus-overlay').empty()) {
        svg.insert('rect', ':first-child')
          .attr('class', 'focus-overlay')
          .attr('width', '100%')
          .attr('height', '100%')
          .attr('fill', '#000')
          .attr('opacity', 0)
          .style('pointer-events', 'none');
      }

      svg.select('.focus-overlay')
        .interrupt().transition().duration(180)
        .attr('opacity', isFocusMode ? 0.85 : 0.4);

      const connectedNodes = new Set<string>([
        activeFocusId,
        ...(connectedNodeMap.get(activeFocusId) || new Set<string>())
      ]);

      link.each(function(l: any) {
        const sId = l.source.id || l.source;
        const tId = l.target.id || l.target;
        const isConnected = sId === activeFocusId || tId === activeFocusId;
        d3.select(this)
          .interrupt()
          .transition().duration(180)
          .attr('stroke', isConnected ? '#6366f1' : '#111827')
          .attr('stroke-opacity', isConnected ? (isFocusMode ? 1 : 0.8) : 0.05)
          .attr('stroke-width', isConnected ? (isFocusMode ? 2.5 : 2) : 0.5);
      });

      node.interrupt().transition().duration(180)
        .attr('opacity', (d: any) => connectedNodes.has(d.id) ? 1 : (isFocusMode ? 0.05 : 0.1))
        .style('filter', (d: any) => {
          if (d.id === activeFocusId) return 'drop-shadow(0 0 15px rgba(99, 102, 241, 0.8))';
          return connectedNodes.has(d.id) ? 'none' : 'url(#grayscale)';
        });

      node.selectAll('circle')
        .interrupt()
        .transition().duration(180)
        .attr('stroke', (_d: any, index: number, groups: any[]) => {
          const current = d3.select(groups[index].parentNode).datum() as GraphNode;
          return getNodeStrokeColor(current, activeFocusId, highImportanceThreshold, mediumImportanceThreshold);
        })
        .attr('stroke-width', (_d: any, index: number, groups: any[]) => {
          const current = d3.select(groups[index].parentNode).datum() as GraphNode;
          return current.id === activeFocusId ? 3 : current.data.importance >= highImportanceThreshold ? 2.6 : 2;
        });

      node.selectAll('text')
        .interrupt()
        .transition().duration(180)
        .attr('opacity', (d: any) => {
          if (connectedNodes.has(d.id)) return 1;
          if (effectiveDensityMode === 'expanded' && d.data.importance >= highImportanceThreshold && !isFocusMode) return 0.65;
          return 0;
        });
    };

    updateHighlights();
  }, [nodes, selectedNodeId, isFocusMode, graphDensityMode, containerSize.width]);

  return (
    <div ref={containerRef} className="w-full h-full bg-brand-bg relative overflow-hidden select-none">
      <svg ref={svgRef} width="100%" height="100%" className="w-full h-full" />
    </div>
  );
};

export const GraphCanvas = memo(GraphCanvasComponent, (prevProps, nextProps) => {
  return (
    prevProps.nodes === nextProps.nodes &&
    prevProps.links === nextProps.links &&
    prevProps.onNodeClick === nextProps.onNodeClick &&
    prevProps.selectedNodeId === nextProps.selectedNodeId &&
    prevProps.isFocusMode === nextProps.isFocusMode &&
    prevProps.graphDensityMode === nextProps.graphDensityMode
  );
});

function getFillColor(ext: string) {
  const colors: Record<string, string> = {
    '.js': '#f59e0b',
    '.jsx': '#f59e0b',
    '.ts': '#3b82f6',
    '.tsx': '#3b82f6',
    '.py': '#10b981',
    '.html': '#ec4899',
    '.css': '#06b6d4',
    '.json': '#8b5cf6',
  };
  return colors[ext] || '#6366f1';
}

function getClusterColor(clusterName: string) {
  const palette = ['#38bdf8', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
  const seed = clusterName
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[seed % palette.length];
}

function getNodeFillColor(
  node: GraphNode,
  selectedNodeId: string | null,
  highImportanceThreshold: number,
  mediumImportanceThreshold: number
) {
  if (node.id === selectedNodeId) return '#6366f1';
  if ((node.data.importance || 0) >= highImportanceThreshold) return '#f59e0b';
  if ((node.data.importance || 0) >= mediumImportanceThreshold) return getFillColor(node.group);
  return withAlpha(getFillColor(node.group), 0.85);
}

function getNodeStrokeColor(
  node: GraphNode,
  selectedNodeId: string | null,
  highImportanceThreshold: number,
  mediumImportanceThreshold: number
) {
  if (node.id === selectedNodeId) return '#c4b5fd';
  if ((node.data.importance || 0) >= highImportanceThreshold) return '#fde68a';
  if ((node.data.importance || 0) >= mediumImportanceThreshold) return '#111827';
  return '#1f2937';
}

function withAlpha(color: string, alpha: number) {
  const normalized = color.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;

  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
