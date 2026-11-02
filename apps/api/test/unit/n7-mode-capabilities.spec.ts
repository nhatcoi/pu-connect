/**
 * Capability các chế độ: nghiên cứu, trực quan hóa, bài giảng video, tổng quan âm thanh, hoạt họa toán.
 */
import { capabilityFor } from '../../src/modules/ai/engine/capabilities'
import { researchCapability, reportIssues } from '../../src/modules/ai/engine/capabilities/research'
import { figureIssues, visualizeCapability } from '../../src/modules/ai/engine/capabilities/visualize'
import { audioOverviewCapability, dialogueIssues, manimIssues, mathAnimatorCapability, storyboardIssues, videoLessonCapability } from '../../src/modules/ai/engine/capabilities/media'
import type { LoopCapability } from '../../src/modules/ai/engine/capabilities'

const run = (cap: LoopCapability, name: string, args: object) => JSON.parse(cap.tools.find((t) => t.schema.function.name === name)!.run(args as never))
const words = (n: number) => Array.from({ length: n }, (_, i) => `từ${i}`).join(' ')

describe('Capability theo chế độ', () => {
  it('mỗi chế độ có capability riêng', () => {
    expect(capabilityFor('deep_research', false)?.id).toBe('research')
    expect(capabilityFor('visualize', false)?.id).toBe('visualize')
    expect(capabilityFor('video_lesson', false)?.id).toBe('video_lesson')
    expect(capabilityFor('audio_overview', false)?.id).toBe('audio_overview')
    expect(capabilityFor('math_animator', false)?.id).toBe('math_animator')
  })

  describe('Nghiên cứu', () => {
    const plan = { topic: 'Ảnh hưởng của giấc ngủ tới trí nhớ', subtopics: [{ title: 'Giấc ngủ và củng cố trí nhớ', query: 'sleep memory consolidation' }, { title: 'Thiếu ngủ và hiệu suất học', query: 'sleep deprivation learning' }] }
    it('từ chối kế hoạch thiếu ý con', () => {
      expect(run(researchCapability(), 'research_plan', { topic: 'x', subtopics: ['một'] }).error).toBeTruthy()
    })
    it('đánh số nguồn, dùng lại số khi trùng URL', () => {
      const c = researchCapability()
      run(c, 'research_plan', plan)
      const a = run(c, 'research_note', { subtopic_id: 't1', findings: 'Giấc ngủ sâu giúp củng cố trí nhớ khai báo qua sóng chậm.', sources: [{ title: 'A', url: 'http://a' }] })
      const b = run(c, 'research_note', { subtopic_id: 't2', findings: 'Thiếu ngủ làm giảm khả năng ghi nhớ thông tin mới khoảng 40%.', sources: [{ title: 'A', url: 'http://a' }, { title: 'B', url: 'http://b' }] })
      expect(a.source_numbers).toEqual([1])
      expect(b.source_numbers).toEqual([1, 2])
      expect(b.remaining).toEqual([])
    })
    it('chưa xong ý con ⇒ nhắc một lần; xong ⇒ kiểm trích dẫn', () => {
      const c = researchCapability()
      run(c, 'research_plan', plan)
      expect(c.policy!.checkFinish!('báo cáo')).toContain('Chưa nghiên cứu xong')
      expect(c.policy!.checkFinish!('báo cáo')).toBeNull()
    })
    it('báo cáo thiếu trích dẫn / trích dẫn ma / thiếu mục tham khảo', () => {
      const subs = [{ id: 't1', title: 'Giấc ngủ và trí nhớ', query: '', note: 'x' }]
      const src = [{ n: 1, title: 'A', url: 'http://a' }]
      expect(reportIssues(subs, src, 'Giấc ngủ và trí nhớ rất quan trọng.').join()).toContain('chưa có trích dẫn')
      expect(reportIssues(subs, src, 'Giấc ngủ và trí nhớ [3].\n## Tài liệu tham khảo\n[1] A').join()).toContain('không có trong danh sách')
      expect(reportIssues(subs, src, 'Giấc ngủ và trí nhớ [1].')).toEqual(['Thiếu mục "## Tài liệu tham khảo" liệt kê các nguồn đã trích dẫn kèm đường dẫn.'])
      expect(reportIssues(subs, src, 'Giấc ngủ và trí nhớ [1].\n## Tài liệu tham khảo\n[1] A')).toEqual([])
      expect(reportIssues(subs, [], 'Giấc ngủ và trí nhớ.').join()).toContain('kiến thức nền')
    })
  })

  describe('Trực quan hóa', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><defs><marker id="arrow"></marker></defs><g class="c-blue"><rect class="box" x="1" y="1" width="50" height="30"/><text class="t" x="10" y="10">A &amp; B</text></g></svg>'
    it('mermaid hợp lệ / sai từ khóa / thiếu khối', () => {
      expect(figureIssues('mermaid', '```mermaid\nflowchart TD\n a[Bắt đầu] --> b[Xong]\n```')).toEqual([])
      expect(figureIssues('mermaid', '```mermaid\nA --> B\n```')[0]).toContain('từ khóa')
      expect(figureIssues('mermaid', 'không có hình')[0]).toContain('Thiếu khối')
      expect(figureIssues('mermaid', '```mermaid\ngraph TD\nA-->B\n```\n```mermaid\ngraph TD\nC-->D\n```')[0]).toContain('MỘT')
    })
    it('svg hợp lệ và các lỗi hay gặp', () => {
      expect(figureIssues('svg', `\`\`\`svg\n${svg}\n\`\`\``)).toEqual([])
      expect(figureIssues('svg', `\`\`\`svg\n${svg.replace('viewBox', 'viewbox')}\n\`\`\``).join()).toContain('viewBox')
      expect(figureIssues('svg', `\`\`\`svg\n${svg.replace('A &amp; B', 'A & B')}\n\`\`\``).join()).toContain('&')
      expect(figureIssues('svg', `\`\`\`svg\n${svg.replace('<text class="t"', '<text')}\n\`\`\``).join()).toContain('class')
      expect(figureIssues('svg', `\`\`\`svg\n${svg.replace('</g>', '')}\n\`\`\``).join()).toContain('<g>')
      expect(figureIssues('svg', `\`\`\`svg\n${svg.replace('<g', '<script>1</script><g')}\n\`\`\``).join()).toContain('script')
    })
    it('chưa chọn loại ⇒ nhắc; sai ⇒ sửa tối đa 2 lần rồi cho qua', () => {
      const c = visualizeCapability()
      expect(c.policy!.checkFinish!('hi')).toContain('visualize_brief')
      expect(run(c, 'visualize_brief', { render_type: 'html' }).error).toBeTruthy()
      expect(run(c, 'visualize_brief', { render_type: 'mermaid' }).ok).toBe(true)
      expect(c.policy!.checkFinish!('x')).toContain('Thiếu khối')
      expect(c.policy!.checkFinish!('x')).toContain('Thiếu khối')
      expect(c.policy!.checkFinish!('x')).toBeNull()
    })
  })

  describe('Bài giảng video', () => {
    const scene = (n: number) => ({ title: `Cảnh ${n} tiêu đề`, visual: 'Hình minh họa', narration: `${words(30)} cảnh${n}` })
    it('kiểm số cảnh, độ dài lời, ký hiệu markdown; tính thời lượng', () => {
      expect(storyboardIssues({ scenes: [scene(1)] }).issues[0]).toContain('3–8')
      expect(storyboardIssues({ scenes: [scene(1), scene(2), { ...scene(3), narration: 'ngắn' }] }).issues.join()).toContain('Cảnh 3')
      expect(storyboardIssues({ scenes: [scene(1), scene(2), { ...scene(3), narration: `**đậm** ${words(30)}` }] }).issues.join()).toContain('markdown')
      const ok = storyboardIssues({ title: 'T', scenes: [scene(1), scene(2), scene(3)] })
      expect(ok.issues).toEqual([])
      expect(ok.value!.total).toBe(36)
    })
    it('sửa tối đa 3 lần rồi nhận; trình bày phải đủ cảnh', () => {
      const c = videoLessonCapability()
      const bad = { scenes: [scene(1)] }
      for (let i = 0; i < 3; i++) expect(run(c, 'lesson_storyboard', bad).error).toContain('chưa đạt')
      expect(run(c, 'lesson_storyboard', { scenes: [scene(1), scene(2), scene(3)] }).ok).toBe(true)
      expect(c.policy!.checkFinish!('chỉ nói Cảnh 1 tiêu đề')).toContain('thiếu cảnh')
    })
  })

  describe('Tổng quan âm thanh', () => {
    const turns = (n: number) => Array.from({ length: n }, (_, i) => ({ speaker: i % 2 ? 'B' : 'A', text: words(12) }))
    it('kiểm lượt, xen giọng, ký hiệu', () => {
      expect(dialogueIssues({ turns: turns(3) }).issues[0]).toContain('8–30')
      expect(dialogueIssues({ turns: turns(10) }).issues).toEqual([])
      const same = [...turns(8)]
      same[2] = { speaker: 'A', text: words(5) }
      same[1] = { speaker: 'A', text: words(5) }
      expect(dialogueIssues({ turns: same }).issues.join()).toContain('liên tiếp')
      expect(dialogueIssues({ turns: [{ speaker: 'A', text: 'xem [1] *đậm*' }, ...turns(9)] }).issues.join()).toContain('markdown')
      expect(dialogueIssues({ turns: [{ speaker: 'A', text: words(80) }, ...turns(9)] }).issues.join()).toContain('≤ 60')
    })
    it('trình bày phải đủ lượt "A:/B:"', () => {
      const c = audioOverviewCapability()
      expect(c.policy!.checkFinish!('x')).toContain('audio_script')
      expect(run(c, 'audio_script', { turns: turns(10) }).ok).toBe(true)
      expect(c.policy!.checkFinish!('A: một\nB: hai')).toContain('2/10')
    })
  })

  describe('Hoạt họa toán', () => {
    const code = 'from manim import *\n\nclass Sin(Scene):\n    def construct(self):\n        t = Text("Sin")\n        self.play(Write(t))\n        self.wait(1)\n'
    it('mã hợp lệ', () => expect(manimIssues({ code }).issues).toEqual([]))
    it('bắt các lỗi hay gặp', () => {
      expect(manimIssues({ code: code.replace('from manim import *\n', '') }).issues.join()).toContain('from manim')
      expect(manimIssues({ code: code.replace('(Scene)', '(object)') }).issues.join()).toContain('Scene')
      expect(manimIssues({ code: code.replace('self.play(Write(t))', 'pass') }).issues.join()).toContain('self.play')
      expect(manimIssues({ code: code + '\nimport os' }).issues.join()).toContain('os/sys')
      expect(manimIssues({ code: code.replace('Write(t)', 'Write(t') }).issues.join()).toContain('Ngoặc')
      expect(manimIssues({ code: code.replace('Text("Sin")', 'MathTex("Hàm sin")') }).issues.join()).toContain('tiếng Việt')
    })
    it('chấp nhận mã bọc fence; trình bày phải có khối python chứa lớp', () => {
      const c = mathAnimatorCapability()
      const r = run(c, 'manim_scene', { code: '```python\n' + code + '```' })
      expect(r.class_name).toBe('Sin')
      expect(c.policy!.checkFinish!('chưa có mã')).toContain('```python')
      expect(c.policy!.checkFinish!('x')).toBeNull()
    })
  })
})
