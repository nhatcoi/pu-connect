import { z } from 'zod'
import type { FlashcardContent, FlashcardTemplate, SpeechLang } from '@pu/schemas'
import { STUDY_AI_MAX_ITEMS, type StudyKindDef } from './study-kind'

// @pu/schemas chỉ import type ở API ⇒ khai báo lại hằng runtime (satisfies giữ khớp)
const FLASHCARD_TEMPLATES = ['basic', 'vocab', 'cloze'] as const satisfies readonly FlashcardTemplate[]
const SPEECH_LANGS = ['en-US', 'en-GB', 'vi-VN', 'zh-CN', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE', 'es-ES', 'ru-RU'] as const satisfies readonly SpeechLang[]

// Điền chỗ trống: {{đáp án}} / {{đáp án::gợi ý}} trong mặt trước (= CLOZE_PATTERN ở @pu/schemas)
const hasCloze = (text: string) => /\{\{[^{}]+?\}\}/.test(text)
const backOrCloze = (c: { front: string; back: string }) => c.back.length > 0 || hasCloze(c.front)
const BACK_MESSAGE = { message: 'Mặt sau trống', path: ['back'] }

// Thẻ ghi nhớ: mô tả từng trường (.describe) đi thẳng vào JSON Schema N7AI nhận
const FlashcardBase = z.object({
  front: z
    .string()
    .trim()
    .min(1, { message: 'Mặt trước trống' })
    .max(500)
    .describe('Term, word or short question (Markdown / $LaTeX$). Vocabulary: the word + part of speech, e.g. "Spaceship (n)". Cloze deck: a sentence with the hidden part(s) wrapped as {{answer}} or {{answer::hint}}'),
  back: z.string().trim().max(2000).default('').describe('Short answer or meaning, ≤ 2 sentences, in the user\'s language. Cloze cards: optional extra note (may be empty)'),
  phonetic: z.string().trim().max(120).optional().describe('IPA / pinyin / romaji for vocabulary, e.g. "/ˈspeɪs.ʃɪp/"; omit otherwise'),
  example: z.string().trim().max(600).optional().describe('One short example sentence using the term (vocabulary, formulas); omit when not useful'),
  image: z.string().trim().url({ message: 'Link ảnh không hợp lệ' }).max(500).startsWith('https://', { message: 'Ảnh phải là link https' }).optional()
})
export const FlashcardContentSchema = FlashcardBase.refine(backOrCloze, BACK_MESSAGE)
// N7AI không đặt ảnh (link bịa dễ hỏng) ⇒ schema riêng bỏ trường image
const FlashcardAiSchema = FlashcardBase.omit({ image: true }).refine(backOrCloze, BACK_MESSAGE)

const FlashcardOptionsSchema = z.object({
  template: z.enum(FLASHCARD_TEMPLATES).optional().catch(undefined).describe('"vocab" for foreign-language vocabulary (shows phonetic, example, pronunciation); "cloze" for fill-in-the-blank sentences; otherwise "basic"'),
  lang: z.enum(SPEECH_LANGS).optional().catch(undefined).describe('Language of the FRONT side for text-to-speech, e.g. "en-US"; omit if mixed or Vietnamese-only')
})

export const flashcardsKind: StudyKindDef<FlashcardContent> = {
  kind: 'flashcards',
  label: 'Flashcard',
  itemLabel: 'thẻ',
  item: FlashcardContentSchema,
  aiItem: FlashcardAiSchema,
  options: FlashcardOptionsSchema,
  fence: 'flashcards',
  itemsKey: 'cards',
  ai: {
    tool: 'create_flashcards',
    description:
      'Create a flashcard deck and save it to the user\'s PU Connect Tools › Flashcard (spaced-repetition review). Use when the user wants to memorise terms, vocabulary, formulas or key concepts, or asks for flashcards.',
    instructions: [
      `Topic only ⇒ 8–12 core cards. The user gives a concrete list (vocabulary, terms, a photo of a word list) or a number ⇒ include EVERY item, no merging or dropping (max ${STUDY_AI_MAX_ITEMS}).`,
      'Foreign-language vocabulary ⇒ template "vocab", set lang, fill phonetic and a short example for every card; the back holds the Vietnamese meaning.',
      'Fill-in-the-blank / sentence or definition memorisation ⇒ template "cloze": each front is a full sentence with 1–2 key parts wrapped as {{answer}}; back optional.',
      'Do not invent facts beyond the user\'s material or well-established knowledge.'
    ].join(' '),
    defaultTitle: 'Flashcard từ N7AI'
  }
}
