
import React, { memo, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphLink } from '../types';

interface GraphCanvasProps {
  nodes: GraphNode[];
  links: GraphLink[];
  onNodeClick: (node: GraphNode) => void;
  selectedNodeId: string | null;
  isFocusMode: boolean;
}

const GraphCanvasComponent: React.FC<GraphCanvasProps> = ({ nodes, links, onNodeClick, selectedNodeId, isFocusMode }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

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
    const visibleNodeIds = new Set(nodes.map((node) => node.id));
    const activeLinks = links.filter((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
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

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg.append('g');

    // Arrowhead definition
    svg.append('defs').append('marker')
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
          const sNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : d.source.id));
          const tNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : d.target.id));
          return sNode?.cluster === tNode?.cluster
            ? (isPhone ? 52 : isCompact ? 66 : isTablet ? 86 : 110)
            : (isPhone ? 110 : isCompact ? 136 : isTablet ? 180 : 250);
        })
        .strength(d => {
           const sNode = nodes.find(n => n.id === (typeof d.source === 'string' ? d.source : d.source.id));
           const tNode = nodes.find(n => n.id === (typeof d.target === 'string' ? d.target : d.target.id));
           return sNode?.cluster === tNode?.cluster ? 0.9 : (isTouchLayout ? 0.18 : 0.24);
        }))
      .force('charge', d3.forceManyBody().strength(isPhone ? -180 : isCompact ? -260 : isTablet ? -340 : -600))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX((d) => clusterTargets.get(d.cluster || 'root')?.x ?? width / 2).strength(isPhone ? 0.36 : isCompact ? 0.3 : isTablet ? 0.22 : 0.12))
      .force('y', d3.forceY((d) => clusterTargets.get(d.cluster || 'root')?.y ?? height / 2).strength(isPhone ? 0.32 : isCompact ? 0.28 : isTablet ? 0.2 : 0.12))
      .force('radial', d3.forceRadial(0, width / 2, height / 2).strength(d => {
        return (d as GraphNode).data.importance > 10 ? (isPhone ? 0.05 : isCompact ? 0.07 : 0.1) : 0.008;
      }))
      .force('collision', d3.forceCollide().radius(d => {
        const node = d as GraphNode;
        const labelRoom = (!isCompact || node.id === selectedNodeId || node.data.importance >= mobileLabelImportanceThreshold) ? 14 : 6;
        return node.size + (isPhone ? 12 : isCompact ? 16 : isTablet ? 24 : 40) + labelRoom;
      }).iterations(isPhone ? 3 : 4))
      .force('cluster', (alpha: number) => {
        nodes.forEach(n => {
          const target = clusterTargets.get(n.cluster || 'root');
          if (!target) return;
          n.vx = (n.vx || 0) + (target.x - (n.x || 0)) * alpha * (isTouchLayout ? 0.18 : 0.12);
          n.vy = (n.vy || 0) + (target.y - (n.y || 0)) * alpha * (isTouchLayout ? 0.18 : 0.12);
        });
      });

    // Links
    const link = g.append('g')
      .selectAll('line')
      .data(activeLinks)
      .enter().append('line')
      .attr('stroke', '#374151')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', isCompact ? 0.2 : 0.3)
      .attr('marker-end', 'url(#arrowhead)');

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

    // Node Circles
    node.append('circle')
      .attr('r', d => d.size)
      .attr('fill', d => getFillColor(d.group))
      .attr('stroke', d => d.id === selectedNodeId ? '#6366f1' : '#111827')
      .attr('stroke-width', d => d.id === selectedNodeId ? 3 : 2)
      .style('filter', d => d.id === selectedNodeId ? 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.6))' : 'none');

    // Importance Aura (for highly connected nodes)
    node.filter(d => d.data.importance > 5)
      .append('circle')
      .attr('r', d => d.size + 4)
      .attr('fill', 'none')
      .attr('stroke', d => getFillColor(d.group))
      .attr('stroke-opacity', 0.2)
      .attr('stroke-width', 1)
      .attr('class', 'animate-pulse');

    // Labels
    node.append('text')
      .attr('dy', d => d.size + labelOffset)
      .attr('text-anchor', 'middle')
      .attr('fill', d => d.id === selectedNodeId ? '#fff' : '#9ca3af')
      .attr('font-size', isPhone ? '7px' : isCompact ? '8px' : '10px')
      .attr('font-weight', d => d.id === selectedNodeId ? 'bold' : 'normal')
      .attr('font-family', 'var(--font-mono)')
      .text(d => d.label)
      .style('pointer-events', 'none')
      .attr('opacity', d => {
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

      const connectedNodes = new Set<string>([activeFocusId]);
      activeLinks.forEach(l => {
        const sId = typeof l.source === 'string' ? l.source : (l.source as any).id;
        const tId = typeof l.target === 'string' ? l.target : (l.target as any).id;
        const sIdStr = typeof sId === 'object' ? sId.id : sId;
        const tIdStr = typeof tId === 'object' ? tId.id : tId;
        
        if (sIdStr === activeFocusId) connectedNodes.add(tIdStr);
        if (tIdStr === activeFocusId) connectedNodes.add(sIdStr);
      });

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
    
    simulation.on('tick', () => {
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
    });

    const fallbackFit = window.setTimeout(() => {
      if (!hasAutoFitted) {
        hasAutoFitted = true;
        fitGraphToViewport(false);
      }
    }, isCompact ? 350 : 200);

    simulation.alpha(0.9).restart();

    return () => {
      window.clearTimeout(fallbackFit);
      simulation.stop();
    };
  }, [nodes, links, selectedNodeId, isFocusMode, onNodeClick, containerSize]);

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
    prevProps.isFocusMode === nextProps.isFocusMode
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
