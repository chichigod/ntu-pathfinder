/** 以 React Flow 呈現學習路徑的課程先修關係圖。 */
import { useMemo } from 'react'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import type { Course, PathDetail } from '../api'
import { useStore } from '../store'

type MapNodeData = { course: Course; status: Status; selected: boolean }
type Status = 'done' | 'planned' | 'available' | 'locked'
type MapNode = Node<MapNodeData, 'course'>

function CourseNode({ data }: NodeProps<MapNode>) {
  const { course, status, selected } = data
  return (
    <div className={`map-node ${status}${selected ? ' selected' : ''}`} title={course.description}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div className="n">{course.name}</div>
      <div className="c">{course.code} · {course.credits} 學分 · {course.level}</div>
      <div className="c">
        {status === 'done' && '✔ 已修'}
        {status === 'planned' && '📅 已排入計畫'}
        {status === 'available' && '可修（先修已完成）'}
        {status === 'locked' && '需先完成先修'}
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}

const nodeTypes = { course: CourseNode }

export default function LearningMap({
  path,
  selectedId,
  onSelect,
}: {
  path: PathDetail
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { state } = useStore()
  const completed = state.completed
  const planned = useMemo(() => new Set(state.semesters.flatMap((s) => s.course_ids)), [state.semesters])

  const { nodes, edges } = useMemo(() => {
    const byId = new Map(path.courses.map((c) => [c.id, c]))
    // 欄位：依階段（學年學期）排；同一階段內依序往下排
    const columnOf = new Map<string, number>()
    path.stages.forEach((st, i) => st.course_ids.forEach((cid) => { if (!columnOf.has(cid)) columnOf.set(cid, i) }))
    path.courses.forEach((c) => { if (!columnOf.has(c.id)) columnOf.set(c.id, path.stages.length) })
    const rows = new Map<number, number>()
    const nodes: MapNode[] = path.courses.map((c) => {
      const col = columnOf.get(c.id) ?? 0
      const row = rows.get(col) ?? 0
      rows.set(col, row + 1)
      const hardPre = c.prerequisites.filter((p) => p.type === 'hard').map((p) => p.course_id)
      let status: Status = 'available'
      if (completed.includes(c.id)) status = 'done'
      else if (planned.has(c.id)) status = 'planned'
      else if (hardPre.some((p) => !completed.includes(p) && byId.has(p))) status = 'locked'
      return {
        id: c.id,
        type: 'course',
        position: { x: col * 230, y: row * 105 },
        data: { course: c, status, selected: selectedId === c.id },
      }
    })
    const edges: Edge[] = path.edges.map((e) => ({
      id: `${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      animated: e.type === 'suggested',
      style: { stroke: e.type === 'hard' ? '#1f4e9c' : '#8a94a6', strokeWidth: e.type === 'hard' ? 2 : 1.5, strokeDasharray: e.type === 'hard' ? undefined : '6 4' },
      markerEnd: { type: MarkerType.ArrowClosed, color: e.type === 'hard' ? '#1f4e9c' : '#8a94a6' },
      label: e.type === 'hard' ? '' : '建議',
      labelStyle: { fontSize: 10, fill: '#8a94a6' },
    }))
    return { nodes, edges }
  }, [path, completed, planned, selectedId])

  return (
    <>
      <div className="map-wrap">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_, n) => onSelect(n.id)}
          minZoom={0.3}
        >
          <Background gap={18} color="#e6eaf2" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <div className="legend">
        <span><i className="done" />已修</span>
        <span><i className="planned" />已排入計畫</span>
        <span><i className="available" />先修已完成，可修</span>
        <span><i className="locked" />需先完成先修</span>
        <span><span className="edge" style={{ borderColor: '#1f4e9c' }} />硬性先修</span>
        <span><span className="edge dashed" />建議先修</span>
        <span>由左至右為建議修課順序，點選節點查看詳情。</span>
      </div>
    </>
  )
}
